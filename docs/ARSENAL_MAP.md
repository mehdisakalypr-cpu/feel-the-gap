# FTG Arsenal — Agent Architecture Map

> High-level map of all agents running on FTG. Update when adding/removing.
> For deep-dive see individual `agents/*.ts` files and memory `project_minato_arsenal.md`.

## Top Triangle (strategic layer)

```
                    ⚡ MINATO
                  (orchestrator —
                   active task routing)
                    /        \
                   /          \
                  /            \
          🌀 KUSHINA ────── 🧙 MERLIN
        (compound kaizen    (sage infinity:
         on all agents)      business ideas
                            + code optim
                            + squad cloning)
                   \            /
                    \          /
                     🟢 MIGHT GUY
                    (Hachimon variants
                     max effort)
```

## Execution Layer

| Agent | File | Cron | Purpose |
|-------|------|------|---------|
| 🪞 Shisui | `agents/content-orchestrator.ts` | `*/5 min` | Content job queue dispatcher (4 workers) |
| 🎥 Rock Lee v2 | `agents/rock-lee-v2-runner.ts` | `*/10 min` | YouTube video dedup (product×country) |
| 🍴 Eishi Layer 1 | `agents/eishi-base-runner.ts` | `*/15 min` | Base LLM content (Shikamaru+Itachi+Hancock dedup) |
| 💎 Eishi Layer 2 | `lib/eishi-adaptor.ts` | on paid event | Per-opp personalization (Stripe webhook) |
| 🎯 Lead Intel | `agents/ftg-lead-intelligence.ts` | `*/30 min` | Apollo ingest + gap-match scoring |
| 📧 Sequence Dispatcher | `agents/sequence-dispatcher.ts` | `*/15 min` | Multi-channel outreach dispatcher |

## Intelligence Layer

| Agent | File | Cron | Purpose |
|-------|------|------|---------|
| 🌀 Kushina | `agents/kushina-kaizen.ts` | `08:00 UTC` | Daily kaizen multi-agent |
| 🟢 Might Guy | `agents/guy-night-gates.ts` | `10:00 UTC` | Hachimon A/B variants |
| 🧙 Merlin (ideas) | `agents/merlin-business-ideas.ts` | `11:00 UTC` | Business idea generator |
| 🧙 Merlin (code) | `agents/merlin-code-audit.ts` | `11:00 UTC` | Code simplification proposals |

## Content Agents (called via Shisui + Eishi Layer 1)

| Agent | File | Role |
|-------|------|------|
| 🧠 Shikamaru | `agents/content-shikamaru.ts` | Production methods (3 variants: artisanal/mécanisé/AI) |
| 👁️‍🗨️ Itachi | `agents/content-itachi.ts` | Business plans (3 scenarios garanti/médian/high) |
| 👸 Hancock | `agents/content-hancock.ts` | Potential B2B clients (Google Places when configured) |
| 🎥 Rock Lee | `agents/content-rock-lee.ts` (legacy) | Deprecated — use rock-lee-v2 |

## Data Sources / Adapters

| Source | File | Status |
|--------|------|-------|
| Apollo.io | `lib/leads/apollo.ts` | Ready-to-key (APOLLO_API_KEY) |
| Hunter.io | `lib/leads/hunter.ts` | Ready-to-key (HUNTER_API_KEY) |
| PhantomBuster | `lib/leads/phantombuster.ts` | Ready-to-key (PHANTOMBUSTER_API_KEY) |
| Instantly.ai | `lib/leads/instantly.ts` | Ready-to-key (INSTANTLY_API_KEY) |
| Google Places | `lib/google-places.ts` | Ready-to-key (GOOGLE_PLACES_API_KEY) |
| yt-transcript | `lib/youtube-transcripts.ts` | VPS CLI — working |
| YouTube Data API | `lib/youtube-api.ts` | 5 keys active |
| Gemini / Groq / Mistral / OpenAI | `agents/providers.ts` | 13-provider cascade |

## Tables (Supabase)

### Content caches
- `ftg_opportunity_content` — legacy per-opp cache (Layer 2 personalization target)
- `ftg_product_country_content` — Eishi Layer 1 base (shared per product×country×lang)
- `ftg_product_country_videos` — Rock Lee v2 video dedup cache
- `ftg_content_jobs` — priority queue for Shisui (priority 10-100)

### Outreach
- `ftg_leads` — unified pool with approval_status gate
- `ftg_campaigns` — outbound definitions
- `ftg_campaign_sends` — send events
- `ftg_sequences` — workflow definitions (steps jsonb)
- `ftg_sequence_enrollments` — lead × sequence state (Hancock persona cached)
- `ftg_sequence_touches` — individual send log
- `ftg_outreach_personas` — sending identities (alex/maria/thomas)

### Intelligence
- `ftg_kaizen_proposals` — Kushina daily proposals
- `ftg_guy_experiments` — Might Guy A/B variants
- `business_ideas` — Merlin-generated ideas with projections
- `code_optimizations` — Merlin code audit proposals
- `agent_squads` — cloned agent instances per business

## Admin UIs

| Page | Purpose |
|------|---------|
| `/admin/content-generation` | Trigger content gen (Shisui queue) |
| `/admin/eishi-coverage` | Live coverage dashboard (videos + base + legacy) |
| `/admin/kaizen` | Kushina daily proposals with Apply/Defer/Reject |
| `/admin/merlin` | Business ideas + code optimizations tabs |
| `/admin/lead-approval` | Swipe/bulk approve pending leads |
| `/admin/ftg-campaigns` (in CC) | Campaign orchestrator + templates |
| `/admin/simulator` (in CC) | 3-scenario trajectory per product + portfolio cumul |
| `/admin/fraud-events` | Stripe Radar events |

## Cron schedule (VPS)

```
*/5 min   — ftg-content-orchestrator.sh   (Shisui)
*/10 min  — ftg-rock-lee-v2.sh            (Rock Lee v2)
*/15 min  — ftg-eishi-base.sh             (Eishi Layer 1)
*/15 min  — ftg-sequence-dispatcher.sh    (outreach dispatcher)
*/30 min  — ftg-lead-intelligence.sh      (Apollo ingest + scoring)
0 4 * * * — ftg-stale-refresh.sh          (mark content > 60d stale)
0 8 * * * — ftg-kushina-kaizen.sh         (daily kaizen)
0 10 * * * — ftg-might-guy.sh             (daily A/B variants)
0 11 * * * — ftg-merlin.sh                (daily ideas + code audit)
```

All scripts use `flock` to prevent overlap. Logs at `/root/monitor/logs/ftg-*.log`.

## Philosophy captured in memory

- `project_minato_arsenal.md` — full character roster + level taxonomy
- `feedback_paid_synthesis_priority.md` — Eishi hybrid cache + personalization rule
- `project_ftg_content_generation.md` — 3-cache architecture detail
- `feedback_kakashi_reuse.md` — anti-duplication scan before coding
- `feedback_infinite_overshoot.md` — never idle, overshoot targets
- `feedback_shonen_agents.md` — self-improvement, cooperation, top 1% benchmark
