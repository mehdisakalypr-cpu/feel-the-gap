-- Feel The Gap — Market Trends + Email Templates
-- Tables manquantes pour agents R&B (trend-hunter + email-nurture)

-- ── Market Trends (trend-hunter.ts / Killua — Mode Sage) ──────────────────────
create table if not exists market_trends (
  id              uuid primary key default gen_random_uuid(),
  product         text not null,
  country_iso     text,
  region          text,
  trend_type      text not null check (trend_type in ('rising_demand', 'new_regulation', 'seasonal', 'infrastructure', 'cultural', 'price_shift', 'supply_disruption')),
  description     text not null,
  market_size_usd numeric,
  urgency         int not null default 5 check (urgency between 1 and 10),
  confidence      int not null default 5 check (confidence between 1 and 10),
  suggested_action text,
  keywords        text[] not null default '{}',
  detected_at     timestamptz not null default now(),
  expires_at      timestamptz,
  status          text not null default 'active' check (status in ('active', 'expired', 'acted_on', 'dismissed')),
  created_at      timestamptz not null default now(),
  unique(product, country_iso)
);

create index if not exists idx_market_trends_urgency on market_trends(urgency desc);
create index if not exists idx_market_trends_status on market_trends(status);
create index if not exists idx_market_trends_type on market_trends(trend_type);

alter table market_trends enable row level security;
create policy "trends_public_read" on market_trends for select using (true);

comment on table market_trends is 'Tendances marché détectées par trend-hunter.ts (Mode Sage). Urgence 1-10, confiance 1-10.';

-- ── Email Templates (email-nurture.ts / Todoroki) ────────────────────────────
create table if not exists email_templates (
  id              uuid primary key default gen_random_uuid(),
  sequence        text not null check (sequence in ('welcome', 'activation', 'conversion', 'retention', 'winback')),
  email_index     int not null,
  day             int not null,           -- J+N after trigger
  lang            text not null,
  subject_a       text not null,          -- A/B test variant A
  subject_b       text,                   -- A/B test variant B
  preview_text    text,
  html_body       text not null,
  cta_text        text,
  cta_url         text,
  -- Performance
  sent_count      int not null default 0,
  open_rate_a     numeric not null default 0,
  open_rate_b     numeric not null default 0,
  click_rate      numeric not null default 0,
  conversion_rate numeric not null default 0,
  -- Meta
  status          text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(sequence, email_index, lang)
);

create index if not exists idx_email_templates_seq on email_templates(sequence);
create index if not exists idx_email_templates_lang on email_templates(lang);
create index if not exists idx_email_templates_status on email_templates(status);

alter table email_templates enable row level security;
create policy "email_tpl_public_read" on email_templates for select using (true);

comment on table email_templates is 'Templates email nurture 15 langues generés par email-nurture.ts. 5 séquences × 10 emails × 15 langues.';
