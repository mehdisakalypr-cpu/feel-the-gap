# FTG Outreach Setup — Deliverability · Sequences · Personas · Monitoring

> **Contrat** : le produit parle, Mehdi reste invisible. Chaque touchpoint sort
> d'une persona d'outreach, jamais depuis `mehdi@feel-the-gap.com`.

---

## 1. Architecture — who does what

```
┌──────────────────────────────────────────────────────────────────────┐
│                       LEAD LIFECYCLE                                 │
│                                                                      │
│  Apollo / PhantomBuster / referrals → ftg_leads (pending)            │
│           ↓                                                          │
│  Kushina + gap-match scoring (lib/leads/gap-match.ts)                │
│           ↓                                                          │
│  /admin/lead-approval (Mehdi validates swipe or bulk)                │
│           ↓                                                          │
│  Lead status = approved → enrollable in sequences                    │
│           ↓                                                          │
│  Assign persona (alex / maria / thomas) — matches Hancock voice      │
│           ↓                                                          │
│  Enroll in sequence (ftg_sequence_enrollments)                       │
│           ↓                                                          │
│  */15 min sequence-dispatcher fires due touches                      │
│           ↓                                                          │
│  Email via Instantly | LinkedIn via PhantomBuster | WhatsApp Twilio  │
│           ↓                                                          │
│  Stop-on-reply → demo booked → Mehdi visible only at demo            │
└──────────────────────────────────────────────────────────────────────┘
```

**Mehdi surfaces only at**: demo meetings, customer calls, signed contracts.
**Mehdi never surfaces at**: cold outreach, nurture sequences, follow-ups.

---

## 2. Tool stack — buy vs build

| Layer | Tool | Why it's bought not built | Cost |
|-------|------|---------------------------|-----:|
| Contact DB (275M B2B) | **Apollo.io Basic** | 3 years of scraping + compliance = unreplicable | $49/mo |
| Email verification | **Hunter.io Starter** | Anti-bounce — 1% invalid = flagged sender | $34/mo |
| LinkedIn infra | **PhantomBuster Starter** | ToS-navigated proxies, cookie rotation, illegal to build | $69/mo |
| Cold email engine | **Instantly Growth** | Warmup + SPF/DKIM auto + IP reputation = 6-12 months dark art | $37/mo |
| Dedicated cold domain | Namecheap/Cloudflare | Main domain must never be burned by cold ever | $10/yr |
| **Orchestrator + personas + gap-match + approval UI** | **WE BUILD** | Our IP: business-first, not channel-first | $0 (internal) |

**Total OpEx**: $189/mo + $10/yr — covered by 2 FTG Strategy clients.

---

## 3. Deliverability setup — the non-negotiable prep

### 3.1 Buy the dedicated cold email domain

**Never use `feel-the-gap.com` for cold email.** One spam complaint = 6 months of burned reputation, and your main domain serves the product page + transactional emails.

Choose a variant:
- `gapup.io`
- `feelthegap.io`
- `thegapio.com`
- `tradegapfeeler.com`

Check availability on **Namecheap** or **Cloudflare Registrar** (~$10/yr).

### 3.2 DNS records to configure on the dedicated domain

Configure **on Cloudflare DNS** (or your registrar's DNS panel):

#### A. MX record (inbound — catches bounces + unsubscribes)
```
Name: @
Type: MX
Priority: 10
Value: mx.instantly.ai   (Instantly will provide the exact value)
TTL: auto
```

#### B. SPF (TXT, authorizes sending IPs)
```
Name: @
Type: TXT
Value: v=spf1 include:instantly.ai include:sendgrid.net ~all
TTL: auto
```

#### C. DKIM (2 TXT CNAMEs — cryptographic signature)
Instantly generates 2 selectors per sending account. Example:
```
Name: ins1._domainkey
Type: CNAME
Value: ins1._domainkey.instantly.ai
```
```
Name: ins2._domainkey
Type: CNAME
Value: ins2._domainkey.instantly.ai
```

#### D. DMARC (TXT, authentication policy)
```
Name: _dmarc
Type: TXT
Value: v=DMARC1; p=none; rua=mailto:dmarc@gapup.io; aspf=r; adkim=r; pct=100
TTL: auto
```
- `p=none` during warmup (monitoring only)
- Switch to `p=quarantine` after 30 days clean sending
- Never `p=reject` during cold — too risky on legitimate bounces

#### E. Optional but recommended: BIMI (brand logo in Gmail)
```
Name: default._bimi
Type: TXT
Value: v=BIMI1; l=https://gapup.io/logo.svg; a=
```
Requires VMC cert ($1k+/yr) for Gmail to display — skip v1.

### 3.3 Verification

Test each record with free tools:
- SPF: https://dmarcian.com/spf-survey/
- DKIM: https://mxtoolbox.com/dkim.aspx
- DMARC: https://dmarcian.com/dmarc-inspector/
- Full audit: https://mail-tester.com (send a test email, get score /10)

**Target score: 9/10 minimum before any campaign.**

### 3.4 Warmup — the 4-week ramp

Instantly handles warmup automatically, but you must respect the ramp:

| Week | Daily sends/account | Total daily (5 accounts) | Goal |
|------|--------------------:|------------------------:|------|
| 1 | 10-20 | 50-100 | Inbox placement, no spam flags |
| 2 | 30-50 | 150-250 | Warmup stable, test A/B subject lines |
| 3 | 70-100 | 350-500 | First real campaign prep |
| 4 | 100-150 | 500-750 | Production volume |
| 5+ | 150-200 | 750-1000 | Scale — monitor health daily |

**Stop if**:
- Bounce rate > 3%
- Spam complaint rate > 0.3%
- Reply rate drops to 0 for 2 consecutive days
→ Pause 48h, debug, restart at week-2 volume.

### 3.5 Sender personas — 3 branded identities

Each persona = 1 Instantly sending account on the dedicated domain:

| Persona | Email | Voice | Best for segment |
|---------|-------|-------|------------------|
| `alex@gapup.io` | Alex Martin | direct, data-first | Trading company, investor |
| `maria@gapup.io` | Maria Santos | narrative, empathic | Entrepreneur, founder in reconversion |
| `thomas@gapup.io` | Thomas Weber | formal, strategic | Corporate procurement, enterprise |

Stored in `ftg_outreach_personas` table. Hancock's persona recommendation
(voice_style + language) auto-routes the lead to the matching sender.

---

## 4. Sequence playbook — the science of successive touches

### 4.1 Canonical 7-touch sequence (generic cold email)

| # | Day | Channel | Content archetype | Stop-if |
|---|----:|---------|-------------------|---------|
| 1 | J0 | Email | Perso pitch with gap data hook (60-100 words) | replied |
| 2 | J+3 | LinkedIn | Connect + short note referencing their recent post | replied OR connected & replied |
| 3 | J+5 | LinkedIn | Like 1 of their recent posts (engagement, no message) | — |
| 4 | J+7 | Email | Social proof + new data angle (different from J0) | replied |
| 5 | J+11 | Video pitch | 30s Seedance video with their opp visualized | replied |
| 6 | J+15 | LinkedIn DM | Audio 15s ElevenLabs (voice note) | replied |
| 7 | J+22 | Email | Break-up email — "last message, should I close your file?" | replied |

After J+22 without reply → move to nurture (monthly newsletter "Trade Gap of the Week").

### 4.2 Breathing rules

- **Never 2 touches in the same day** (spam filter pattern)
- **Min 2 days between email touches** (recipient fatigue)
- **Max 3 LinkedIn touches/week** (LinkedIn algorithm flag)
- **Weekend skip** — disable Saturday + Sunday sends (Instantly config)
- **Timezone adapt** — send Mon-Fri 08:00-11:00 recipient's local time
- **Public holiday skip** — disable on Christmas, July 4, Eid, etc. per country

### 4.3 Stop conditions (respect signal)

Auto-stop the sequence when:
- `status = replied` (any reply, positive or negative)
- `status = demo_booked`
- `status = unsubscribed` OR recipient clicks unsubscribe link
- `status = bounced` (hard bounce only)
- OOO (out of office) detected → pause 10 days, resume at next step
- 3 consecutive `opened` no-reply → de-prioritize, try different angle next round

### 4.4 Personalization levers (from low to high effort)

| Level | Personalization | Prep time | Expected reply lift |
|------:|----------------|----------:|--------------------:|
| 1 | `{firstName}` + `{companyName}` only | 0s | baseline |
| 2 | + country gap data (Hancock) | 5s (LLM) | +30% |
| 3 | + reference to recent LinkedIn post | 15s (PB scrape) | +60% |
| 4 | + 3 specific opps for their country × sector | 30s (LLM) | +120% |
| 5 | + voice note / video perso (Seedance+ElevenLabs) | 2min | +250-400% |
| 6 | + warm intro via Mehdi's 1st degree | 5-10min manuel | +500-800% |

**Rule**: level 1-2 for first 3 touches (volume), level 4-5 for tier-high leads
(priority ≥ 4), level 6 for dream accounts (manual Mehdi path).

---

## 5. Integration with our agents

### 5.1 Lead Intelligence (Apollo ingest)
`agents/ftg-lead-intelligence.ts` runs every 30 min. When `APOLLO_API_KEY` is
set, fetches new contacts matching 5 rotating ICP queries across priority
countries, upserts to `ftg_leads` with `approval_status = pending`.

### 5.2 Kushina (daily kaizen)
08:00 UTC — audits per-agent metrics including **reply rate**, **bounce
rate**, **deliverability health**. Proposals often target sequence
template tweaks and persona voice adjustments.

### 5.3 Might Guy (variants)
10:00 UTC — generates 5-8 variants of the top proposal, including cold
email subject lines, opening hooks, CTA variations. A/B tested via
Instantly's built-in split test.

### 5.4 Merlin (new businesses)
11:00 UTC — business ideas INCLUDING proposed outreach squads: which
agents (Hancock voice? Kurama logo? Seedance video?) clone for the
new venture's outreach.

### 5.5 Sequence dispatcher
Every 15 min — fires due touches. Logs to `ftg_sequence_touches` with
provider_external_id for reply ingestion via webhook.

---

## 6. Monitoring — health checks daily

### 6.1 `/admin/eishi-coverage` + `/admin/kaizen` + `/admin/merlin`
Kushina summarizes deliverability metrics. Watch these:

| Metric | Green | Yellow | Red |
|--------|------:|-------:|----:|
| Bounce rate (7d) | < 2% | 2-4% | > 4% |
| Spam complaint rate | < 0.1% | 0.1-0.3% | > 0.3% |
| Reply rate (first touch) | > 6% | 3-6% | < 3% |
| Unsubscribe rate | < 1% | 1-2% | > 2% |
| Inbox placement (mail-tester) | 9+/10 | 7-8/10 | < 7/10 |

### 6.2 Webhooks to wire (phase 2)
- Instantly → `/api/webhooks/instantly` : sent/opened/replied/bounced
- PhantomBuster CSV → `/api/webhooks/pb-export` : cron polls results
- Twilio → `/api/webhooks/twilio` : WhatsApp/SMS delivery receipts

Until webhooks live, **daily manual check via Instantly dashboard** is OK.

---

## 7. Common failure modes + fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Reply rate drops overnight to 0 | Domain blacklisted | Check https://mxtoolbox.com/blacklists.aspx; contact ISP if listed |
| Bounce rate > 5% | Apollo returning stale emails | Enable Hunter verification (HUNTER_API_KEY) before each send |
| Spam complaints spike | Subject lines too sales-y | Run Kushina proposal audit; rewrite with fewer "you/free/urgent" |
| LinkedIn account restricted | Too many connects per day | Cap to 25/day; add human-random delays 5-15min between actions |
| Google Workspace blocks sending | SPF mismatch / missing DKIM | Re-verify DNS via dmarcian.com; wait 24h propagation |
| Instantly account paused | Trust score too low | Restart warmup week 1; send only warmup-emails for 7 days |

---

## 8. Compliance

### 8.1 GDPR (EU recipients)
- **Legitimate interest** clause at footer of every email:
  > "We found your profile as a relevant trade-industry professional.
  > If you'd prefer not to hear from us: [unsubscribe]. We store only
  > your name, email, and public LinkedIn data. See our privacy policy."
- Honor unsubscribe within 24h (Instantly auto)
- Maintain a `ftg_leads.do_not_contact = true` suppression list
- Do NOT scrape private data (phone, home address, salary)

### 8.2 CAN-SPAM (US recipients)
- Physical postal address in every email footer (use the LLC Wyoming address once established)
- Clear sender identification (persona name + company name)
- Functional unsubscribe link
- No deceptive subject lines

### 8.3 LinkedIn ToS
- **Scraping**: PhantomBuster navigates the gray zone — ToS technically
  prohibits, but enforcement rare at low volume. Stay under 100 actions/day.
- **Automation on personal profile**: risky for your main LinkedIn. Long-term,
  hire a VA under "Sales at FTG" title whose account we pilot, OR create
  FTG company page + use only Company Page Actions (posts, newsletters, ads).
- **Never use fake profiles** — LinkedIn actively bans, can cascade.

### 8.4 Twilio WhatsApp
- Opt-in required for broadcast (Business API)
- 24h session rule (can only send template messages after 24h of inactivity)
- Avoid for cold — use for warm follow-ups only

---

## 9. Launch checklist — before first 100 sends

- [ ] Dedicated cold domain bought (`gapup.io` or similar)
- [ ] 4 DNS records live (MX + SPF + 2×DKIM + DMARC)
- [ ] DMARC report email inbox set up (dmarc@gapup.io)
- [ ] mail-tester.com score ≥ 9/10
- [ ] 3 sender personas created in Instantly + `ftg_outreach_personas` populated
- [ ] Each persona has unique First name + Last name + email signature
- [ ] Warmup started (week 1 active, 10-20 emails/day)
- [ ] APOLLO_API_KEY + HUNTER_API_KEY + PHANTOMBUSTER_API_KEY + INSTANTLY_API_KEY in `.env.local`
- [ ] `ftg-lead-intelligence.sh` cron confirmed running (logs at `/root/monitor/logs/ftg-lead-intelligence.log`)
- [ ] First 50 leads approved in `/admin/lead-approval`
- [ ] First sequence defined in `ftg_sequences` (draft)
- [ ] 10 test enrollments in dry-run mode
- [ ] Webhooks tested OR manual daily monitoring process documented
- [ ] Unsubscribe page hosted at `https://gapup.io/unsubscribe`
- [ ] Privacy policy + terms published
- [ ] Physical address (LLC Wyoming) in email footer

After all checked → activate first sequence. Monitor daily for 7 days.
Scale volume only when week-1 metrics are green.

---

## 10. Phase 2 roadmap (post-MVP)

- [ ] Webhooks Instantly → auto-update `ftg_sequence_touches.status`
- [ ] Calendly integration for demo booking
- [ ] Twilio WhatsApp sandbox → opt-in flow
- [ ] Seedance pitch video auto-generated per lead (gap data visualized)
- [ ] A/B test engine for subject lines (Might Guy Hachimon gates)
- [ ] `/admin/sequences` UI — CRUD sequences + stats per step
- [ ] Attribution dashboard — channel → demo → paid

---

## References

- Instantly docs: https://developer.instantly.ai/api
- Apollo API: https://apolloio.github.io/apollo-api-docs
- PhantomBuster phantoms: https://phantombuster.com/phantoms
- Hunter API: https://hunter.io/api-documentation/v2
- DMARC guide: https://dmarc.org/overview/
- CAN-SPAM FTC: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business

---

_Last updated: 2026-04-21. Maintained by Kushina 🌀 — updated each day after
her kaizen run if deliverability metrics shift or new failure modes detected._
