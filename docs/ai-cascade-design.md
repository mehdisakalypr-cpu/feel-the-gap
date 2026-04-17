# AI Engine Cascade — Ultimate Tier Design Document

**Project:** Feel The Gap (FTG)
**Feature:** Multi-provider AI cascade for the Ultimate tier (299 EUR / mo, 250 Fill-the-Gap opportunities / mo)
**Status:** Draft v1
**Owner:** FTG Platform
**Last updated:** 2026-04-17

---

## 1. Objective

- Serve the Ultimate tier quota of **250 Fill-the-Gap opportunities per user per month** (each opp ~= 3 LLM calls: classify, enrich, draft) while keeping the direct AI cost per user **under 100 EUR / mo** (target gross margin ~= 66 %).
- Eliminate usage-based surprise bills by running a **FIXED / HYBRID cost model** (per `feedback_cost_min_fixed.md`): flat subscriptions + free tiers, never pay-as-you-go as the primary path.
- Stay **legally clean**: only provider accounts we legitimately own (one per LLC entity), no bot-driven mass signup (per `feedback_ai_scaling_legal.md`).

---

## 2. Provider Matrix

Ranked by priority in the default cascade. "Cap" is the monthly throughput we can safely extract per account under normal Terms of Service.

| # | Provider | Plan | Monthly cap (approx) | Unit cost (EUR / 1M tokens) | Latency p50 | Notes |
|---|---|---|---|---|---|---|
| 1 | **Groq Cloud** | Pro (flat 50 EUR / mo) | ~30 M tokens / mo (Llama 3.3 70B, Mixtral, Kimi-K2) | 0 marginal (flat fee) | 200 ms | Anchor of the cascade. Extremely fast, flat price fits FIXED model. One account per LLC. |
| 2 | **Google Gemini 2.5 Flash** | Free tier | 1 500 RPD x N accounts; ~2 M tokens / day | 0 | 400 ms | Very generous free tier. Use for lightweight classify / rerank. |
| 3 | **OpenRouter** | Free Llama / Qwen / DeepSeek routes | 20 req/min, ~200 req/day per key | 0 | 600 ms | Multiple free models behind one API. Good fallback when Groq cooldown. |
| 4 | **Mistral La Plateforme** | Free tier (Experiment) | 1 req/s, 500k tokens/day | 0 | 500 ms | EU-hosted, GDPR-friendly bonus. Good for French copy. |
| 5 | **Cloudflare Workers AI** | Free (10k neurons / day) then Workers Paid 5 USD/mo | ~1 M tokens / day free | 0 then marginal | 300 ms | Edge-local, cheap overflow. Llama 3.1, Mistral 7B. |
| 6 | **HuggingFace Inference** | PRO 9 USD / mo | ~2 M tokens / mo serverless | flat | 800 ms | Backup for exotic models (rerankers, embeddings). |
| 7 | **OpenAI gpt-4o-mini / gpt-5 Nano** | Pay-as-you-go (capped) | N/A | ~0.15 in / 0.60 out per 1M | 350 ms | **Paid fallback** only. Hard monthly cap 30 EUR per LLC account. |
| 8 | **Anthropic Claude 4 Haiku** | Pay-as-you-go (capped) | N/A | ~0.80 in / 4.00 out per 1M | 500 ms | Last-resort quality fallback for critical drafts. Hard cap 20 EUR / mo per LLC. |
| 9 | **OpenRouter (paid)** | Pay-as-you-go (capped) | N/A | varies | 600 ms | Safety net for outages. Hard cap 15 EUR / mo. |

**Aggregate monthly capacity** (single LLC, HYBRID scenario): ~30 M Groq + ~60 M free tiers ~= **90 M tokens / month** for ~50 EUR fixed + max 65 EUR variable cap => **~115 EUR / mo absolute ceiling**, targeting ~50 EUR typical.

---

## 3. Routing Algorithm

### 3.1 Per-request decision tree (pseudocode)

```
function routeRequest(userId, task, prompt, options):
    # 1. Per-user rate limit
    if rateLimit.exceeded(userId, "60 req/min"):
        return 429

    # 2. Pick cascade for this task kind
    cascade = cascadeFor(task)
        # "classify"  -> [Groq, Gemini, OR-free, Mistral, CF, Nano]
        # "enrich"    -> [Groq, Gemini, OR-free, Nano, Haiku]
        # "draft"     -> [Groq, Haiku, Nano, Gemini, OR-free]
        # "embed"     -> [Gemini-embed, HF, OpenAI-embed]

    for provider in cascade:
        usage = providerUsage.get(provider, currentMonth)
        if usage.pct >= 0.90:
            continue                     # cooldown until next month
        if provider.circuitBreaker.open():
            continue                     # recent failures
        if provider.hardCostCap.reached():
            continue                     # safety net

        try:
            resp = provider.call(prompt, options, timeout=provider.timeout)
            providerUsage.increment(provider, resp.tokensIn, resp.tokensOut)
            requestLog.insert(userId, provider, task, resp, costEur=resp.cost)
            return resp
        except RateLimitError:
            provider.circuitBreaker.trip(60s)
            continue
        except ServerError, TimeoutError:
            provider.circuitBreaker.trip(300s)
            continue

    # All providers exhausted
    alert.fire("cascade_exhausted", userId, task)
    return 503
```

### 3.2 Budget tracker

State is kept in **Supabase** (table `ai_provider_usage`, authoritative for billing) and mirrored in **Upstash Redis** (hot cache, atomic INCR for every request).

- Every successful call -> `INCR tokens_in` / `INCR tokens_out` / `INCRBYFLOAT cost_eur`.
- Redis keys are monthly: `ai:usage:{provider}:{account_id}:{YYYY-MM}`.
- Background job (cron every 5 min) flushes Redis deltas to Supabase.
- When Redis counter crosses **90 % of monthly cap** -> set key `ai:cooldown:{provider}:{account_id}:{YYYY-MM} = 1` with TTL until 1st of next month.

### 3.3 Per-user rate limiting

- **Sliding window 60 req / min per user** for LLM calls, enforced in Redis (token bucket).
- **Hard daily cap** = (Ultimate quota / 30) x 3 safety = **~25 opps / day / user** (soft) then 403 with retry-after.
- Quota usage displayed live in the user dashboard (per `feedback_no_lazy_max_mode.md`).

### 3.4 Task -> model mapping

| Task kind | Preferred model | Why |
|---|---|---|
| classify / tag / route | Llama 3.1 8B (Groq), Gemini 2.5 Flash | Cheapest, fastest, high enough accuracy |
| enrich / extract fields | Llama 3.3 70B (Groq), Mistral Large free | Needs reasoning |
| draft / email / pitch | Kimi-K2 (Groq), Claude 4 Haiku | Quality-critical, user-facing output |
| rerank | HF BGE-reranker, Gemini | Cheap, specialized |
| embed | Gemini text-embedding-004, OpenAI small | Embeddings cached 90 days |

---

## 4. Multi-account / Multi-LLC Strategy

**Legal path only.** Each provider account is tied to a separate real LLC we own:

- Wyoming LLC #1 — FTG (primary, see `project_llc_wyoming_strategy.md`)
- Wyoming LLC #2 — One For All (OFA)
- Future LLC #3 — AI Ops (dedicated, optional after 50 paying Ultimate users)

Rules:

1. **One provider account per LLC.** Billing card = the LLC's Mercury card. No "catch-all personal emails" for paid plans.
2. **No automated signup.** A human creates each account, accepts ToS, confirms KYC if required.
3. **Free tiers via catch-all aliases (`reference_ai_free_tier_stack.md`) are OK** for *free* plans where providers allow alias emails per ToS (Gemini, OpenRouter, Mistral). We document in a register which alias belongs to which LLC.
4. **Fail loudly** when a provider flags suspicious activity — immediately retire that account and rotate. Never appeal with fake identity.
5. **Traffic splitting** across LLC accounts is load-balanced via `account_id` partition key in `ai_provider_usage`. The router picks the least-loaded account for a given provider.

Scaling trigger: when the cascade hits **> 70 % of Groq Pro cap on LLC #1 for 2 consecutive weeks**, provision Groq Pro on LLC #2 (OFA) and start round-robin.

---

## 5. Cost Tracking

### 5.1 Schema

```sql
-- Aggregate by provider x account x month (billing truth)
CREATE TABLE ai_provider_usage (
    id           bigserial PRIMARY KEY,
    provider     text NOT NULL,          -- 'groq','gemini','openrouter',...
    account_id   text NOT NULL,          -- LLC account identifier
    month        date NOT NULL,          -- first day of month
    tokens_in    bigint NOT NULL DEFAULT 0,
    tokens_out   bigint NOT NULL DEFAULT 0,
    requests     bigint NOT NULL DEFAULT 0,
    cost_eur     numeric(10,4) NOT NULL DEFAULT 0,
    cap_tokens   bigint,                 -- soft cap for cooldown
    cap_cost_eur numeric(10,4),          -- hard cap
    status       text NOT NULL DEFAULT 'active', -- active | cooldown | disabled
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, account_id, month)
);

-- Per-request log (sampled at 100 % for Ultimate, 10 % for lower tiers)
CREATE TABLE ai_request_log (
    id           bigserial PRIMARY KEY,
    user_id      uuid NOT NULL REFERENCES auth.users(id),
    tier         text NOT NULL,          -- 'free','pro','ultimate'
    opp_id       uuid,                   -- Fill-the-Gap opportunity ref
    task         text NOT NULL,          -- 'classify','enrich','draft',...
    provider     text NOT NULL,
    account_id   text NOT NULL,
    model        text NOT NULL,
    tokens_in    int NOT NULL,
    tokens_out   int NOT NULL,
    latency_ms   int NOT NULL,
    cost_eur     numeric(8,6) NOT NULL,
    status       text NOT NULL,          -- 'ok','fallback','error'
    error_code   text,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON ai_request_log (user_id, created_at DESC);
CREATE INDEX ON ai_request_log (created_at) WHERE status != 'ok';
```

### 5.2 Cost per user per month

```sql
SELECT user_id,
       date_trunc('month', created_at) AS month,
       count(*)                        AS requests,
       sum(cost_eur)                   AS direct_cost_eur,
       sum(cost_eur) / count(DISTINCT opp_id) AS cost_per_opp
FROM ai_request_log
WHERE tier = 'ultimate'
  AND created_at >= date_trunc('month', now())
GROUP BY 1, 2;
```

Allocation rule for flat-fee providers (Groq 50 EUR): distribute pro rata tokens consumed by each user across all users that month.

### 5.3 Dashboards

- **/admin/ai-cascade** (Command Center): real-time gauge per provider (% cap used, EUR spent, cooldown status), leaderboard top 10 users by cost, cost-per-opp histogram.
- Alerts: Slack webhook when any provider > 75 %, > 90 %, or hard cost cap reached.

---

## 6. Failure Modes

| Mode | Detection | Automatic fallback | Human action |
|---|---|---|---|
| **Provider rate-limit burst** (429) | HTTP 429 within 1 min | Circuit breaker 60 s, next provider | None unless repeats > 5x/h |
| **Provider outage** (5xx, timeout) | 3 consecutive errors | Circuit breaker 5 min, next provider | Page on 2 providers down simultaneously |
| **Billing disabled / card declined** | 402 / auth error | Disable `account_id`, next LLC account | Treasurer updates Mercury card |
| **Monthly cap hit** (soft 90 %) | `ai_provider_usage.cost_eur >= cap * 0.9` | Cooldown flag, skip for month | Review if consistent across months |
| **ToS violation warning** (email from provider) | Human review | Disable account in registry | Retire account, no appeal, rotate |
| **Quality regression** (hallucination uptick) | Eval harness nightly | Demote model in cascade | Investigate, swap model |
| **Cascade exhausted** (all tried) | Router returns 503 | Queue request for retry in 5 min | Page SEV2 if > 10 / min |
| **Prompt injection / abuse** | WAF + content filter | Reject 400 | Ban user, review |
| **Cost overrun** (runaway loop) | User > 3 sigma daily | Hard stop, 429 | Manual review, credit if false positive |

---

## 7. Cost Scenarios — FREE / FIXED / HYBRID

Per `feedback_cost_min_fixed.md`, every feature ships with three cost variants. Baseline: **20 paying Ultimate users** each consuming 250 opps/mo x 3 LLM calls x ~2 kt tokens = ~**3 M tokens / user / mo**, **60 M tokens / mo total**.

### 7.1 FREE (no spend, launch-day)

- Stack: Gemini Flash free + OpenRouter free + Mistral free + Cloudflare free + HF free.
- Capacity: ~60-80 M tokens / mo across 3-4 LLC accounts (with rotation).
- Pros: 0 EUR direct AI cost -> 100 % margin.
- Cons: Latency variance (600-1500 ms p95), rate-limit brittleness, limited to Llama-class quality (no Claude / GPT-4 class). Risk of provider policy changes.
- Verdict: acceptable for **< 10 paying Ultimate users** as a bootstrap phase.

### 7.2 FIXED (flat subscriptions only)

- Stack: **Groq Pro 50 EUR x 2 LLC = 100 EUR / mo** + HuggingFace Pro 9 USD = ~108 EUR / mo total.
- Capacity: ~60 M tokens / mo Groq + HF overflow. Matches baseline demand exactly.
- Pros: Perfectly predictable cost, no surprise bill, best latency (Groq is fastest in industry).
- Cons: No top-tier quality model (no Claude). Single-model risk (Groq TOS).
- Verdict: target state when **Ultimate > 50 paying users** (revenue 15k EUR / mo >> 108 EUR AI cost).

### 7.3 HYBRID (flat + free + tightly capped variable) — **RECOMMENDED FOR LAUNCH**

- Stack: **Groq Pro 50 EUR** (LLC #1) + all free tiers cascaded + OpenAI Nano with **30 EUR hard cap** + Claude Haiku with **20 EUR hard cap**.
- Total ceiling: **100 EUR / mo** worst case; ~50-60 EUR typical.
- Capacity: ~90 M tokens / mo (covers baseline 1.5x).
- Pros: Best quality floor (Haiku for drafts), robust (many fallbacks), still largely flat.
- Cons: Slight variability in the 0-50 EUR band.
- Margin at 20 Ultimate users: 20 x 299 EUR = 5 980 EUR revenue; AI cost 100 EUR worst case = **98.3 % AI gross margin**.

**Decision: ship HYBRID on day one. Re-evaluate monthly; pivot to pure FIXED once 50 paying Ultimate users is crossed AND Groq Pro proves stable for 60 consecutive days.**

---

## 8. Implementation Checklist

- [ ] Create `ai_provider_usage` and `ai_request_log` tables + migrations in Supabase.
- [ ] Build provider adapters (Groq, Gemini, OpenRouter, Mistral, Cloudflare, HF, OpenAI, Claude) behind a single `AIProvider` interface with `call()`, `embed()`, `tokensCost()`, `healthcheck()`.
- [ ] Implement router with circuit breakers, per-account partitioning, and per-task cascade tables.
- [ ] Wire Upstash Redis for hot usage counters + Supabase flush cron (every 5 min).
- [ ] Per-user rate limiter (60 req/min sliding window) and daily cap enforcement.
- [ ] Register each LLC's provider accounts in a secure vault (reuse Command Center credentials vault, `project_social_credentials_vault.md`).
- [ ] Admin dashboard `/admin/ai-cascade` with real-time gauges, per-provider cooldown, top-cost users.
- [ ] Slack alerts at 75 % / 90 % cap and on circuit breaker trips > 3 / hour.
- [ ] Nightly eval harness (50 golden prompts per task kind) to catch quality regressions before users notice.
- [ ] Document runbook for "provider outage", "billing disabled", "ToS warning received".
- [ ] Load test: simulate 20 Ultimate users bursting 50 opps simultaneously; verify cascade stays < 100 EUR / mo.
- [ ] Kill-switch env var `AI_CASCADE_DISABLE_PAID=true` to force FREE mode in emergency.

---

## Appendix A — Worked Economic Example

Assume month M, HYBRID scenario, 20 paying Ultimate users.

- Revenue: 20 x 299 EUR = **5 980 EUR**
- Volume: 20 x 250 opps x 3 LLM calls = **15 000 calls / mo**
- Average tokens / call: 2 000 in + 1 500 out ~= **3 500 tokens**
- Total tokens: 15 000 x 3 500 = **52.5 M tokens**

Cascade allocation (typical distribution):

| Step | Provider | Share of calls | Tokens | Direct cost |
|---|---|---|---|---|
| 1 | Groq Pro (flat) | 78 % | ~41 M | 50 EUR (flat) |
| 2 | Gemini free | 10 % | ~5 M | 0 |
| 3 | OpenRouter free | 4 % | ~2 M | 0 |
| 4 | Mistral free | 3 % | ~1.5 M | 0 |
| 5 | Cloudflare free | 2 % | ~1 M | 0 |
| 6 | OpenAI Nano (capped) | 2 % | ~1 M | ~6 EUR |
| 7 | Claude Haiku (capped) | 1 % | ~0.5 M | ~4 EUR |

- **Total AI direct cost: ~60 EUR / mo** for 20 users.
- Per-user cost: **3 EUR / user / mo** (vs 299 EUR revenue).
- AI gross margin: **98.99 %** (before Supabase / Redis / Vercel overhead).

Sensitivity: if Groq Pro degrades and cascade pushes more traffic to Claude Haiku, worst case is 100 EUR / mo -> margin still 98.3 %. This validates HYBRID for the launch phase.

---

## Appendix B — Rollout Plan

**Week 1 (launch foundations)**
- Schema migrations + provider adapters + router skeleton.
- Single account per provider (LLC #1 only).
- Cascade live behind feature flag `AI_CASCADE_V1` for internal testers.

**Week 2 (observability + hardening)**
- Dashboards, alerts, eval harness.
- Load test with synthetic traffic.
- Publish runbook.

**Week 3 (soft launch)**
- Enable for first 5 Ultimate beta users.
- Daily cost + latency review.
- Tune cascade order per task kind.

**Week 4 (general availability)**
- Flip flag for all Ultimate users.
- Weekly cost review with Nami (treasury agent).

**Month 2+ (scale)**
- Provision LLC #2 Groq Pro when LLC #1 > 70 % cap.
- Start mirroring heavy users across LLC accounts (round-robin).
- Consider pivoting to pure FIXED if Ultimate paying users > 50.

---

## Appendix C — Glossary

- **Opp** — one Fill-the-Gap opportunity (market gap + contact + drafted pitch).
- **Cascade** — ordered list of providers tried until one succeeds.
- **Cooldown** — provider temporarily skipped for the rest of the month after 90 % cap.
- **Circuit breaker** — short-term skip after transient failures (60-300 s).
- **LLC account** — a provider account owned by a real legal entity we control.

## Appendix D — Related memory references

- `project_production_3_0.md` — Ultimate tier 299 EUR / 250 opps pricing.
- `feedback_ai_scaling_legal.md` — no mass auto-signup, multi-LLC is the path.
- `reference_ai_free_tier_stack.md` — existing cascade groundwork.
- `feedback_cost_min_fixed.md` — FREE / FIXED / HYBRID rule.
- `feedback_cost_tiers.md` — T0 free-first, T1 <= 100 EUR / mo progressive.
- `feedback_time_aware_planner.md` — always present T0 vs T1 tradeoff.
- `reference_autoscale_scenarios.md` — per-agent partition keys and quota blockers.
