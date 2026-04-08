-- Country studies: AI-generated market reports in 3 parts
-- Part 1 (free/Explorer): Resources & market overview
-- Part 2 (basic/Data): Business analysis & distribution modes
-- Part 3 (standard/Strategy): Local market actors & buyers

create table if not exists country_studies (
  id              uuid primary key default gen_random_uuid(),
  country_iso     text not null references countries(id) on delete cascade,
  part            int not null check (part in (1, 2, 3)),
  content_html    text not null,
  tier_required   text not null default 'free',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(country_iso, part)
);

create index if not exists idx_cs_country on country_studies(country_iso);

alter table country_studies enable row level security;
-- Public read for free parts, authenticated for paid parts (gated in API)
create policy "auth_read_studies" on country_studies for select using (auth.role() = 'authenticated');
create policy "public_read_free_studies" on country_studies for select using (tier_required = 'free');
