-- Outreach pipeline health snapshots — daily counts for trend analysis.
-- Populated by /api/cron/outreach-health-snapshot (Vercel cron, gated by CRON_SECRET).
-- Displayed on /admin/outreach-enrichment as a 7-day trend strip with deltas.

create table if not exists outreach_health_snapshots (
  id          uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  -- entrepreneur_demos counts
  demos_total           int not null,
  demos_blocked_email   int not null,  -- status=generated AND email IS NULL AND outreach_sent_at IS NULL
  demos_with_email      int not null,
  demos_sent_total      int not null,  -- outreach_sent_at IS NOT NULL
  demos_sent_24h        int not null,  -- outreach_sent_at > now() - 24h
  -- entrepreneurs_directory
  dir_total             int not null,
  dir_with_email        int not null,
  dir_with_website      int not null,
  dir_with_linkedin     int not null,
  -- marketplace
  marketplace_matches_total int not null,
  marketplace_matches_24h   int not null,
  -- misc
  notes text
);

create index if not exists idx_outreach_health_snapshots_captured
  on outreach_health_snapshots (captured_at desc);

comment on table outreach_health_snapshots is
  'Daily outreach pipeline snapshots — populated by Vercel cron, read by /admin/outreach-enrichment.';

-- Secondary matview index for filtered Market Pulse queries. Current usage scans
-- the whole matview (~31k rows), which is fine at current scale but this index
-- pays off when country/category filters are used.
create index if not exists idx_ftg_pcpa_country_category
  on ftg_product_country_pair_agg (country_iso, product_id);
