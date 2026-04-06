-- Feel The Gap — Supabase Schema
-- Run this in the Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── COUNTRIES ─────────────────────────────────────────
create table if not exists countries (
  id            text primary key,  -- ISO 3166-1 alpha-3
  iso2          text not null unique,
  name          text not null,
  name_fr       text not null,
  flag          text not null,
  region        text not null,
  sub_region    text not null,
  lat           double precision not null,
  lng           double precision not null,
  population    bigint,
  gdp_usd       bigint,
  gdp_per_capita double precision,
  land_area_km2 bigint,
  arable_land_pct double precision,
  total_imports_usd bigint,
  total_exports_usd bigint,
  trade_balance_usd bigint,
  top_import_category text,
  data_year     int,
  created_at    timestamptz default now()
);

-- ── PRODUCTS (HS codes) ───────────────────────────────
create table if not exists products (
  id         text primary key,  -- HS6 code
  hs2        text not null,
  hs4        text not null,
  name       text not null,
  name_fr    text not null,
  category   text not null,     -- agriculture|energy|materials|manufactured|resources
  subcategory text not null,
  unit       text not null default 'tonnes',
  created_at timestamptz default now()
);

create index if not exists idx_products_category on products(category);

-- ── TRADE FLOWS ───────────────────────────────────────
create table if not exists trade_flows (
  id           uuid primary key default uuid_generate_v4(),
  reporter_iso text not null references countries(id),
  partner_iso  text not null,  -- ISO3 or "WLD"
  product_id   text not null references products(id),
  year         int not null,
  flow         text not null check (flow in ('import','export')),
  value_usd    bigint not null,
  quantity     double precision,
  source       text not null,
  created_at   timestamptz default now(),
  unique (reporter_iso, partner_iso, product_id, year, flow)
);

create index if not exists idx_tf_reporter on trade_flows(reporter_iso);
create index if not exists idx_tf_product  on trade_flows(product_id);
create index if not exists idx_tf_year     on trade_flows(year);
create index if not exists idx_tf_category on trade_flows(reporter_iso, year, flow);

-- ── OPPORTUNITIES ─────────────────────────────────────
create table if not exists opportunities (
  id                        uuid primary key default uuid_generate_v4(),
  country_iso               text not null references countries(id),
  product_id                text not null references products(id),
  type                      text not null check (type in ('direct_trade','local_production')),
  gap_tonnes_year           double precision,
  gap_value_usd             bigint,
  opportunity_score         int not null default 0 check (opportunity_score between 0 and 100),
  avg_import_price_usd_tonne double precision,
  local_production_cost_usd_tonne double precision,
  potential_margin_pct      double precision,
  land_availability         text check (land_availability in ('high','medium','low')),
  labor_cost_index          int,
  infrastructure_score      int,
  summary                   text not null,
  analysis_json             jsonb,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

create index if not exists idx_opp_country  on opportunities(country_iso);
create index if not exists idx_opp_score    on opportunities(opportunity_score desc);
create index if not exists idx_opp_product  on opportunities(product_id);

-- ── REPORTS ───────────────────────────────────────────
create table if not exists reports (
  id            uuid primary key default uuid_generate_v4(),
  country_iso   text not null references countries(id),
  product_id    text references products(id),
  title         text not null,
  tier_required text not null default 'basic',
  summary       text not null,
  content_html  text,
  data_year     int,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_reports_country on reports(country_iso);

-- ── BUSINESS PLANS ────────────────────────────────────
create table if not exists business_plans (
  id                    uuid primary key default uuid_generate_v4(),
  opportunity_id        uuid not null references opportunities(id),
  type                  text not null,
  title                 text not null,
  tier_required         text not null default 'pro',
  trade_suppliers       jsonb,
  trade_logistics       jsonb,
  trade_margins         jsonb,
  prod_capex_usd        bigint,
  prod_opex_usd_year    bigint,
  prod_roi_pct          double precision,
  prod_payback_years    double precision,
  prod_machinery_options jsonb,
  prod_automation_level text,
  prod_land_ha          double precision,
  prod_employees        int,
  full_plan_html        text,
  created_at            timestamptz default now()
);

-- ── PROFILES ──────────────────────────────────────────
create table if not exists profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  email                  text not null,
  full_name              text,
  company                text,
  tier                   text not null default 'free',
  stripe_customer_id     text unique,
  stripe_subscription_id text,
  subscription_ends_at   timestamptz,
  reports_accessed       text[] default '{}',
  created_at             timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── AGENT RUNS ────────────────────────────────────────
create table if not exists agent_runs (
  id                  uuid primary key default uuid_generate_v4(),
  agent               text not null,
  status              text not null default 'running',
  countries_processed int not null default 0,
  records_inserted    int not null default 0,
  errors              jsonb,
  started_at          timestamptz not null,
  ended_at            timestamptz,
  created_at          timestamptz default now()
);

-- ── ROW LEVEL SECURITY ────────────────────────────────
alter table countries    enable row level security;
alter table products     enable row level security;
alter table trade_flows  enable row level security;
alter table opportunities enable row level security;
alter table reports      enable row level security;
alter table business_plans enable row level security;
alter table profiles     enable row level security;

-- Countries & products: public read
create policy "public_read_countries" on countries for select using (true);
create policy "public_read_products"  on products  for select using (true);

-- Trade flows: public read aggregate, paid for full detail (handled in API)
create policy "public_read_trade_flows" on trade_flows for select using (true);

-- Opportunities: public read summary (analysis_json gated in API layer)
create policy "public_read_opportunities" on opportunities for select using (true);

-- Reports: authenticated users can read summary; content_html gated in API
create policy "auth_read_reports" on reports for select using (auth.role() = 'authenticated');
create policy "public_read_report_summary" on reports for select using (tier_required = 'free');

-- Business plans: pro+ only (gated in API)
create policy "auth_read_plans" on business_plans for select
  using (auth.role() = 'authenticated');

-- Profiles: own row only
create policy "own_profile" on profiles for all
  using (auth.uid() = id);

-- Agent runs: service role only (no public policy = deny by default)
