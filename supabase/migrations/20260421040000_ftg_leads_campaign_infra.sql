-- FTG growth infrastructure:
--   ftg_leads           -- unified lead pool (Apollo + Hunter + LinkedIn + scrape + signup)
--   ftg_campaigns       -- outbound campaign definitions + state
--   ftg_campaign_sends  -- individual send events + responses
--
-- Design goals:
--   - Adapter-friendly: source='apollo'|'hunter'|'phantombuster'|'linkedin'|'organic'|'referral'|'import'
--   - Gap-match scoring: link each lead to the opportunities it's most likely to convert on
--   - Pipeline: sourced → enriched → scored → queued → sent → responded → demo → paid
--   - Attribution: utm + referrer + first_touch tracking

create table if not exists ftg_leads (
  id uuid primary key default gen_random_uuid(),

  -- Identity
  email text,
  linkedin_url text,
  phone text,
  full_name text,
  first_name text,
  last_name text,

  -- Firmographic
  company_name text,
  company_domain text,
  company_size_range text,       -- e.g. "11-50"
  company_country_iso text,      -- ISO3
  title text,

  -- Source provenance (adapter-aware)
  source text not null check (source in ('apollo', 'hunter', 'phantombuster', 'linkedin_scrape', 'crunchbase', 'osm', 'trade_show', 'organic', 'referral', 'paid_ads', 'import')),
  source_external_id text,       -- Apollo contact_id, LinkedIn public_id, etc.
  source_payload jsonb,          -- raw payload snapshot for debugging

  -- Enrichment layer
  enriched_at timestamptz,
  verification_status text check (verification_status in ('unverified', 'valid', 'invalid', 'risky', 'unknown') or verification_status is null),
  verification_provider text,    -- 'hunter', 'neverbounce', etc.

  -- Gap-match intelligence score (0-100)
  gap_match_score int default 0,
  gap_match_opps jsonb,          -- top 3 opportunities this lead should see first
  signals jsonb default '{}'::jsonb,  -- {likes_trade:true, bio_mentions:['export','commodities'], ...}

  -- Pipeline state
  status text not null default 'sourced' check (status in ('sourced','enriched','scored','queued','sent','opened','responded','demo_booked','demo_done','paid','lost','unsubscribed','bounced')),
  status_changed_at timestamptz default now(),

  -- Attribution
  utm_source text, utm_medium text, utm_campaign text, utm_content text,
  first_touch_at timestamptz,
  converted_user_id uuid,         -- links to auth.users when they sign up

  -- Flags
  tier_target text,               -- 'data'|'strategy'|'premium'|'ultimate' based on signals
  segment text,                   -- 'entrepreneur'|'trading_company'|'investor'|'student'
  is_priority boolean default false,
  do_not_contact boolean default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for typical queries
create unique index if not exists uq_ftg_leads_email on ftg_leads(lower(email)) where email is not null;
create unique index if not exists uq_ftg_leads_linkedin on ftg_leads(linkedin_url) where linkedin_url is not null;
create index if not exists idx_ftg_leads_status on ftg_leads(status);
create index if not exists idx_ftg_leads_score on ftg_leads(gap_match_score desc);
create index if not exists idx_ftg_leads_segment on ftg_leads(segment);
create index if not exists idx_ftg_leads_country on ftg_leads(company_country_iso);
create index if not exists idx_ftg_leads_priority on ftg_leads(is_priority) where is_priority = true;

-- Auto updated_at + status_changed_at
create or replace function ftg_leads_touch() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.status is distinct from old.status then new.status_changed_at = now(); end if;
  return new;
end;
$$;
drop trigger if exists trg_ftg_leads_touch on ftg_leads;
create trigger trg_ftg_leads_touch before update on ftg_leads
for each row execute function ftg_leads_touch();

-- ─── Campaigns ─────────────────────────────────────────────────────────
create table if not exists ftg_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null check (channel in ('email_cold','linkedin_inmail','linkedin_connect','phone','retarget_ads','multi')),
  segment text,                   -- which lead segment to target
  country_iso_filter text[],
  gap_match_min int default 50,
  template_subject text,
  template_body text,             -- mustache-like placeholders: {{firstName}}, {{opp.gap_value_m}}, …
  provider text not null check (provider in ('instantly','apollo','phantombuster','custom')),
  provider_config jsonb default '{}'::jsonb,  -- sequence_id, ramp, etc.
  status text default 'draft' check (status in ('draft','warming','active','paused','done','archived')),
  budget_eur numeric(10,2) default 0,
  spent_eur numeric(10,2) default 0,
  metrics jsonb default '{}'::jsonb,  -- {sent, opened, responded, demos, paid}
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists ftg_campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references ftg_campaigns(id) on delete cascade,
  lead_id uuid not null references ftg_leads(id) on delete cascade,
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued','sent','delivered','opened','clicked','replied','bounced','unsubscribed','failed')),
  sent_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  reply_text text,
  reply_sentiment text check (reply_sentiment in ('positive','neutral','negative','oou') or reply_sentiment is null),
  error text,
  created_at timestamptz default now()
);

create index if not exists idx_ftg_sends_campaign on ftg_campaign_sends(campaign_id, status);
create index if not exists idx_ftg_sends_lead on ftg_campaign_sends(lead_id);

-- ─── RLS ───────────────────────────────────────────────────────────────
alter table ftg_leads enable row level security;
alter table ftg_campaigns enable row level security;
alter table ftg_campaign_sends enable row level security;

-- Admin-only (service role bypasses RLS for background agents)
drop policy if exists "admins manage leads" on ftg_leads;
create policy "admins manage leads" on ftg_leads for all
  using (exists (select 1 from profiles where id = auth.uid() and tier in ('ultimate','custom')));

drop policy if exists "admins manage campaigns" on ftg_campaigns;
create policy "admins manage campaigns" on ftg_campaigns for all
  using (exists (select 1 from profiles where id = auth.uid() and tier in ('ultimate','custom')));

drop policy if exists "admins read sends" on ftg_campaign_sends;
create policy "admins read sends" on ftg_campaign_sends for select
  using (exists (select 1 from profiles where id = auth.uid() and tier in ('ultimate','custom')));

-- ─── Helper RPC: top N unsent leads for a campaign ─────────────────────
create or replace function ftg_next_campaign_targets(p_campaign_id uuid, p_limit int default 100)
returns setof ftg_leads language sql stable as $$
  select l.*
    from ftg_leads l
    join ftg_campaigns c on c.id = p_campaign_id
   where l.status in ('scored','enriched','sourced')
     and l.do_not_contact = false
     and (c.segment is null or l.segment = c.segment)
     and (c.country_iso_filter is null or l.company_country_iso = any(c.country_iso_filter))
     and l.gap_match_score >= c.gap_match_min
     and not exists (
       select 1 from ftg_campaign_sends s
        where s.campaign_id = p_campaign_id and s.lead_id = l.id
     )
   order by l.gap_match_score desc, l.enriched_at desc nulls last
   limit p_limit;
$$;

comment on table ftg_leads is
  'Unified FTG lead pool. Fed by adapters (Apollo, Hunter, PhantomBuster, organic). Scored by gap_match_intelligence agent. Consumed by ftg_campaigns via send orchestrator.';
