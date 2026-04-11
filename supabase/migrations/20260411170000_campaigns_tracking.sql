-- Campaigns & Funnel Tracking — V/R par canal, typologie, campagne

-- ── Campaigns ─────────────────────────────────────────────
create table if not exists campaigns (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  -- Targeting
  channel         text not null check (channel in ('email', 'linkedin', 'whatsapp', 'sms', 'seo', 'social', 'ads', 'referral')),
  target_type     text not null check (target_type in ('entrepreneur', 'commerce', 'investor', 'influencer', 'buyer')),
  country_iso     text,
  sector          text,
  -- Objectives (Vision)
  target_sent     int default 0,
  target_opened   int default 0,
  target_clicked  int default 0,
  target_replied  int default 0,
  target_visited  int default 0,
  target_signup   int default 0,
  target_converted int default 0,
  -- Expected rates (Vision %)
  expected_open_rate    numeric default 0,
  expected_click_rate   numeric default 0,
  expected_reply_rate   numeric default 0,
  expected_visit_rate   numeric default 0,
  expected_signup_rate  numeric default 0,
  expected_convert_rate numeric default 0,
  -- Status
  status          text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed', 'archived')),
  started_at      timestamptz,
  completed_at    timestamptz,
  -- Meta
  notes           text,
  agent_id        text,  -- which agent manages this campaign
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_campaigns_channel on campaigns(channel);
create index if not exists idx_campaigns_target_type on campaigns(target_type);
create index if not exists idx_campaigns_status on campaigns(status);

-- ── Campaign Contacts (each person in a campaign) ────────
create table if not exists campaign_contacts (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references campaigns(id) on delete cascade,
  -- Contact info
  email           text,
  name            text,
  company         text,
  country_iso     text,
  -- Funnel stages (timestamps)
  sent_at         timestamptz,
  opened_at       timestamptz,
  clicked_at      timestamptz,
  replied_at      timestamptz,
  visited_at      timestamptz,   -- visited the demo/site
  signup_at       timestamptz,   -- created account
  converted_at    timestamptz,   -- became paying
  -- Tracking
  demo_token      text,          -- links to entrepreneur_demos.token
  site_slug       text,          -- links to generated_sites.slug
  user_id         uuid,          -- links to profiles.id if signed up
  -- Status
  stage           text not null default 'queued' check (stage in (
    'queued', 'sent', 'opened', 'clicked', 'replied', 'visited', 'signup', 'converted', 'unsubscribed', 'bounced'
  )),
  -- Revenue attribution
  mrr_attributed  numeric default 0,
  -- Meta
  created_at      timestamptz not null default now()
);

create index if not exists idx_cc_campaign on campaign_contacts(campaign_id);
create index if not exists idx_cc_stage on campaign_contacts(stage);
create index if not exists idx_cc_email on campaign_contacts(email);

-- ── Campaign Daily Metrics (aggregated) ──────────────────
create table if not exists campaign_metrics (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references campaigns(id) on delete cascade,
  date            date not null,
  sent            int default 0,
  opened          int default 0,
  clicked         int default 0,
  replied         int default 0,
  visited         int default 0,
  signups         int default 0,
  converted       int default 0,
  mrr_generated   numeric default 0,
  created_at      timestamptz not null default now(),
  unique(campaign_id, date)
);

-- ── RLS ──────────────────────────────────────────────────
alter table campaigns enable row level security;
create policy "campaigns_admin" on campaigns for all using (true);

alter table campaign_contacts enable row level security;
create policy "cc_admin" on campaign_contacts for all using (true);

alter table campaign_metrics enable row level security;
create policy "cm_admin" on campaign_metrics for all using (true);

-- ── Seed default campaigns (the 5 main pipelines) ───────
insert into campaigns (name, channel, target_type, target_sent, expected_open_rate, expected_click_rate, expected_reply_rate, expected_signup_rate, expected_convert_rate, status) values
  ('Scout Entrepreneurs — Email',    'email',    'entrepreneur', 19661, 25, 12, 8, 5, 3, 'active'),
  ('OFA Commerce Pitch — Email',     'email',    'commerce',     33472, 22, 10, 5, 3, 2, 'active'),
  ('OFA Commerce Pitch — WhatsApp',  'whatsapp', 'commerce',     10000, 85, 25, 15, 8, 4, 'draft'),
  ('Scout Entrepreneurs — LinkedIn', 'linkedin', 'entrepreneur', 5000,  40, 15, 10, 6, 4, 'draft'),
  ('Investor Outreach — Email',      'email',    'investor',     2000,  35, 18, 12, 8, 5, 'draft'),
  ('Influencer Recruit — Social',    'social',   'influencer',   5000,  60, 20, 10, 7, 3, 'draft'),
  ('SEO Organic — Landing Pages',    'seo',      'buyer',        64800, 100, 8, 0, 2, 1, 'active'),
  ('Social Content — Multi-platform','social',   'buyer',        50000, 100, 5, 0, 1.5, 0.5, 'active')
on conflict do nothing;

comment on table campaigns is 'Marketing campaigns with V/R tracking — target rates vs actual funnel metrics';
comment on table campaign_contacts is 'Individual contacts within campaigns, tracking each funnel stage with timestamps';
comment on table campaign_metrics is 'Daily aggregated metrics per campaign for trend analysis';
