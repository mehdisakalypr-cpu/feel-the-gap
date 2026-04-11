-- Feel The Gap — Daily Performance Tracking
-- Suivi journalier des conversions, acquisition et revenus
-- L'agent performance-tracker adapte l'intensité des leviers en fonction des taux réels

create table if not exists daily_performance (
  id              uuid primary key default gen_random_uuid(),
  date            date not null unique,
  -- Acquisition
  visitors        int not null default 0,
  signups_free    int not null default 0,
  signups_source  jsonb not null default '{}'::jsonb,  -- {"organic": 45, "social": 30, "seo": 15, "referral": 10}
  -- Conversion
  conversions_free_to_paid int not null default 0,
  conversions_by_plan jsonb not null default '{}'::jsonb,  -- {"data": 5, "strategy": 3, "premium": 1}
  upgrades        int not null default 0,                   -- existing users upgrading
  downgrades      int not null default 0,
  churned         int not null default 0,
  -- Revenue
  mrr_start       numeric not null default 0,
  mrr_new         numeric not null default 0,        -- from new subscriptions
  mrr_expansion   numeric not null default 0,        -- from upgrades
  mrr_contraction numeric not null default 0,        -- from downgrades
  mrr_churn       numeric not null default 0,        -- from churned users
  mrr_end         numeric not null default 0,
  -- Rates
  conversion_rate numeric not null default 0,        -- free_to_paid / signups
  churn_rate      numeric not null default 0,        -- churned / total_paying
  arpu            numeric not null default 0,        -- mrr / paying_users
  -- Channel performance
  channel_metrics jsonb not null default '{}'::jsonb,
  -- {
  --   "seo": {"impressions": 5000, "clicks": 200, "signups": 15, "conversions": 2, "cost": 0},
  --   "social": {"posts": 135, "impressions": 50000, "clicks": 400, "signups": 30, "conversions": 3, "cost": 0},
  --   "influencers": {"posts": 1800, "impressions": 200000, "clicks": 1600, "signups": 45, "conversions": 5, "cost": 0},
  --   "email": {"sent": 500, "opened": 200, "clicked": 50, "conversions": 8, "cost": 0},
  --   "referral": {"invites": 100, "signups": 20, "conversions": 4, "cost": 0},
  --   "ads": {"spend": 0, "impressions": 0, "clicks": 0, "signups": 0, "conversions": 0, "cost": 0}
  -- }
  -- Targets vs actuals
  targets         jsonb not null default '{}'::jsonb,
  -- {"signups": 90, "conversions": 10, "mrr_growth": 5000, "churn_max": 3}
  performance_score numeric not null default 0,      -- 0-100, calculated
  -- Agent decisions
  intensity_adjustments jsonb not null default '{}'::jsonb,
  -- {"seo": 1.5, "social": 1.2, "influencers": 0.8, "email": 1.0} — multiplier on cadence
  actions_taken   text[] not null default '{}',
  created_at      timestamptz not null default now()
);

create index if not exists idx_daily_perf_date on daily_performance(date);

-- Levers intensity control — tracks how much each lever should be amplified
create table if not exists lever_intensity (
  id              uuid primary key default gen_random_uuid(),
  lever           text unique not null,  -- 'seo', 'social', 'influencers', 'email', 'referral', 'ads', 'products', 'deals'
  base_cadence    text not null,         -- '300K pages', '135 posts/day', '1800 posts/day'
  current_multiplier numeric not null default 1.0,  -- 1.0 = baseline, 2.0 = double effort
  max_multiplier  numeric not null default 5.0,
  cost_per_unit   numeric not null default 0,       -- marginal cost of increasing this lever
  effectiveness_score numeric not null default 50,  -- 0-100, updated daily
  roi_per_unit    numeric not null default 0,       -- estimated EUR revenue per unit of effort
  last_adjusted   timestamptz not null default now(),
  auto_adjust     boolean not null default true,    -- allow auto-optimizer to modify
  notes           text
);

-- Seed initial lever config
insert into lever_intensity (lever, base_cadence, current_multiplier, cost_per_unit, effectiveness_score, roi_per_unit, notes) values
  ('seo', '300K pages total', 1.0, 0.001, 70, 0.28, 'SEO factory — cost = AI tokens only'),
  ('social', '135 posts/day', 1.0, 0, 65, 0.48, 'Social autopilot — free (Gemini + Groq)'),
  ('influencers', '1800 posts/day (300 personas)', 1.0, 0, 80, 1.73, 'AI influencers — highest ROI, free'),
  ('email', '500 emails/day', 1.0, 0.001, 75, 2.10, 'Email nurture — highest conversion rate'),
  ('referral', 'organic from users', 1.0, 0, 60, 3.50, 'Referral — zero cost, high LTV'),
  ('ads', '0 spend (not active)', 0, 0.50, 0, 0.15, 'Paid ads — only activate if organic insufficient'),
  ('products', '600+ catalog', 1.0, 0.01, 70, 0.05, 'Product enrichment — improves conversion'),
  ('deals', '120+ deal flows', 1.0, 0.01, 65, 0.08, 'Deal flow generation — attracts investors')
on conflict (lever) do nothing;

-- Targets progression — auto-ratchet upward when met
create table if not exists performance_targets (
  id              uuid primary key default gen_random_uuid(),
  metric          text unique not null,
  current_target  numeric not null,
  original_target numeric not null,
  times_exceeded  int not null default 0,
  last_exceeded   date,
  ratchet_pct     numeric not null default 10,  -- increase target by 10% when exceeded 3 days in a row
  notes           text,
  updated_at      timestamptz not null default now()
);

insert into performance_targets (metric, current_target, original_target, ratchet_pct, notes) values
  ('daily_signups', 90, 90, 15, 'Free signups per day — ratchet +15% when exceeded 3 consecutive days'),
  ('daily_conversions', 10, 10, 10, 'Free-to-paid conversions per day'),
  ('daily_mrr_growth', 5000, 5000, 10, 'MRR growth per day in EUR'),
  ('daily_churn_max', 3, 3, -10, 'Max churned users per day — ratchet DOWN (tighter) when met'),
  ('conversion_rate', 2.5, 2.5, 5, 'Conversion rate % — ratchet up when exceeded'),
  ('social_signups', 30, 30, 20, 'Signups from social media per day'),
  ('seo_signups', 15, 15, 20, 'Signups from SEO per day'),
  ('influencer_signups', 45, 45, 15, 'Signups from AI influencers per day')
on conflict (metric) do nothing;

alter table daily_performance enable row level security;
create policy "daily_perf_public_read" on daily_performance for select using (true);

alter table lever_intensity enable row level security;
create policy "lever_public_read" on lever_intensity for select using (true);

alter table performance_targets enable row level security;
create policy "targets_public_read" on performance_targets for select using (true);

comment on table daily_performance is 'Suivi journalier conversions, acquisition, revenus. L agent performance-tracker adapte les leviers en temps réel.';
comment on table lever_intensity is 'Contrôle d intensité des leviers de croissance. Multiplier auto-ajusté par l agent.';
comment on table performance_targets is 'Objectifs de performance auto-ratchet. Quand un objectif est atteint 3 jours de suite, il est relevé automatiquement.';
