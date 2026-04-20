-- Pre-computed content per (opportunity × country × language).
-- Public pages SELECT-only from this cache. Generation is background-only (admin-triggered).

-- ═══════════════════════════════════════════════════════════════════
-- 1. CACHE TABLE — stores the aggregated content
-- ═══════════════════════════════════════════════════════════════════

create table if not exists ftg_opportunity_content (
  id uuid primary key default gen_random_uuid(),
  opp_id uuid not null references opportunities(id) on delete cascade,
  country_iso text not null,
  lang text not null default 'fr',

  -- Content buckets (each agent writes its own jsonb)
  production_methods jsonb,      -- Shikamaru: template logique + filled variants
  business_plans jsonb,          -- Itachi: 3 scenarios (garanti/median/high)
  potential_clients jsonb,       -- Hancock: B2B leads with contact + score
  youtube_videos jsonb,          -- Rock Lee: top 10 curated videos

  -- Metadata
  status text not null default 'pending' check (status in ('pending','generating','ready','stale','failed')),
  generated_at timestamptz,
  stale_at timestamptz,
  cost_eur numeric(10,4) default 0,
  last_error text,
  agent_versions jsonb default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (opp_id, country_iso, lang)
);

create index if not exists idx_opp_content_lookup on ftg_opportunity_content (country_iso, status, lang);
create index if not exists idx_opp_content_opp on ftg_opportunity_content (opp_id);
create index if not exists idx_opp_content_stale on ftg_opportunity_content (stale_at) where stale_at is not null;

-- ═══════════════════════════════════════════════════════════════════
-- 2. JOB QUEUE — Shisui orchestrator dispatches from here
-- ═══════════════════════════════════════════════════════════════════

create table if not exists ftg_content_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in (
    'full',                  -- run all 4 agents
    'production_methods',
    'business_plans',
    'potential_clients',
    'youtube_videos'
  )),
  opp_id uuid references opportunities(id) on delete cascade,
  country_iso text not null,
  lang text not null default 'fr',

  status text not null default 'pending' check (status in ('pending','running','done','failed','cancelled')),
  priority int not null default 100,
  attempts int not null default 0,
  max_attempts int not null default 3,

  source text not null default 'manual' check (source in ('manual','cron','full_refresh','per_country','per_opportunity','per_pair','auto_stale')),
  triggered_by uuid references auth.users(id),

  last_error text,
  cost_eur numeric(10,4) default 0,

  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists idx_content_jobs_dispatch on ftg_content_jobs (status, priority desc, created_at) where status = 'pending';
create index if not exists idx_content_jobs_lookup on ftg_content_jobs (opp_id, country_iso, status);
create index if not exists idx_content_jobs_source on ftg_content_jobs (source, created_at desc);

-- ═══════════════════════════════════════════════════════════════════
-- 3. RLS — public read when ready, admin write
-- ═══════════════════════════════════════════════════════════════════

alter table ftg_opportunity_content enable row level security;
alter table ftg_content_jobs enable row level security;

-- Public read: only ready rows
drop policy if exists "content_public_read_ready" on ftg_opportunity_content;
create policy "content_public_read_ready" on ftg_opportunity_content
  for select
  using (status = 'ready');

-- Admin write (service_role bypass RLS, so admins need to hit via service role)
drop policy if exists "content_admin_all" on ftg_opportunity_content;
create policy "content_admin_all" on ftg_opportunity_content
  for all
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
  );

-- Jobs: admin-only (no public access)
drop policy if exists "jobs_admin_all" on ftg_content_jobs;
create policy "jobs_admin_all" on ftg_content_jobs
  for all
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
  );

-- ═══════════════════════════════════════════════════════════════════
-- 4. HELPER: claim-next-job RPC (atomic, prevents double-claim)
-- ═══════════════════════════════════════════════════════════════════

create or replace function claim_next_content_job()
returns ftg_content_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed ftg_content_jobs;
begin
  update ftg_content_jobs
     set status = 'running',
         started_at = now(),
         attempts = attempts + 1
   where id = (
     select id from ftg_content_jobs
      where status = 'pending'
      order by priority desc, created_at asc
      limit 1
      for update skip locked
   )
  returning * into claimed;
  return claimed;
end;
$$;

revoke all on function claim_next_content_job() from public;
grant execute on function claim_next_content_job() to service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 5. TRIGGER: auto-update updated_at on content table
-- ═══════════════════════════════════════════════════════════════════

create or replace function touch_opportunity_content_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_opp_content_touch on ftg_opportunity_content;
create trigger trg_opp_content_touch
  before update on ftg_opportunity_content
  for each row execute function touch_opportunity_content_updated_at();
