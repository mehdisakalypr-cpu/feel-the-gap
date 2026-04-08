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

-- ── AI CREDITS (added 2026-04-06) ────────────────────
-- ai_credits stored in cents (integer) to avoid float rounding
-- e.g. 1000 = €10.00
alter table profiles add column if not exists ai_credits integer not null default 0;

-- Credits log for audit trail
create table if not exists credit_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  amount_cents integer not null,            -- positive = top-up, negative = usage
  description text,
  created_at  timestamptz default now()
);

alter table credit_transactions enable row level security;
create policy "own_credits" on credit_transactions
  for all using (auth.uid() = user_id);

-- RPC: add_ai_credits (called from webhook, runs as admin)
create or replace function add_ai_credits(
  p_user_id     uuid,
  p_amount_cents integer,
  p_description  text default null
) returns void language plpgsql security definer as $$
begin
  update profiles
    set ai_credits = ai_credits + p_amount_cents
    where id = p_user_id;

  insert into credit_transactions (user_id, amount_cents, description)
    values (p_user_id, p_amount_cents, p_description);
end;
$$;

-- RPC: deduct_ai_credits (called when AI advisor runs)
create or replace function deduct_ai_credits(
  p_user_id      uuid,
  p_amount_cents integer,
  p_description  text default null
) returns integer language plpgsql security definer as $$
declare
  current_balance integer;
begin
  select ai_credits into current_balance from profiles where id = p_user_id;

  if current_balance < p_amount_cents then
    raise exception 'Insufficient credits';
  end if;

  update profiles
    set ai_credits = ai_credits - p_amount_cents
    where id = p_user_id;

  insert into credit_transactions (user_id, amount_cents, description)
    values (p_user_id, -p_amount_cents, p_description);

  return current_balance - p_amount_cents;
end;
$$;

-- ══════════════════════════════════════════════════════════
-- RÉSEAU D'INFLUENCE & AFFILIATION (ajouté 2026-04-06)
-- ══════════════════════════════════════════════════════════

-- Profil influenceur (extension de profiles)
create table if not exists influencer_profiles (
  id                    uuid primary key references profiles(id) on delete cascade,
  platform_handle       text unique,           -- @handle unique sur la plateforme
  bio                   text,
  social_networks       jsonb default '[]',    -- [{platform, url, followers, engagement_rate}]
  audience_data         jsonb default '{}',    -- {geos:[{country,pct}], niches:[], age_range:{}}
  stripe_account_id     text,                  -- Stripe Connect Express account ID
  stripe_onboarding_done boolean default false,
  payout_threshold_cents int  not null default 2000,  -- seuil 20€ min virement
  balance_pending_cents  int  not null default 0,
  balance_available_cents int not null default 0,
  total_earned_cents     int  not null default 0,
  status                text not null default 'active',  -- active | suspended
  created_at            timestamptz default now()
);

-- Offres d'affiliation créées par les vendeurs (Strategy+)
create table if not exists affiliate_offers (
  id                   uuid primary key default gen_random_uuid(),
  seller_id            uuid not null references profiles(id) on delete cascade,
  product_name         text not null,
  product_description  text,
  product_url          text,
  affiliate_base_url   text not null,       -- URL de base avec params vendeur
  commission_pct       numeric(5,2) not null, -- % du panier → plateforme
  platform_split_pct   numeric(5,2) not null default 30, -- % que plateforme garde
  category             text,
  target_geos          text[] default '{}',
  target_niches        text[] default '{}',
  status               text not null default 'active', -- active | paused | ended
  created_at           timestamptz default now()
);

-- Lien unique par (offre × influenceur)
create table if not exists affiliate_links (
  id              uuid primary key default gen_random_uuid(),
  unique_code     text unique not null,          -- 8 chars alphanumériques
  offer_id        uuid not null references affiliate_offers(id) on delete cascade,
  influencer_id   uuid not null references influencer_profiles(id) on delete cascade,
  clicks          int  not null default 0,
  conversions     int  not null default 0,
  total_earned_cents int not null default 0,
  created_at      timestamptz default now(),
  unique(offer_id, influencer_id)
);

-- Conversions déclarées / confirmées
create table if not exists affiliate_conversions (
  id                       uuid primary key default gen_random_uuid(),
  link_id                  uuid not null references affiliate_links(id) on delete cascade,
  sale_amount_cents        int  not null,
  commission_gross_cents   int  not null,   -- sale × commission_pct
  platform_cut_cents       int  not null,   -- gross × platform_split_pct
  influencer_payout_cents  int  not null,   -- gross - platform_cut
  status                   text not null default 'pending', -- pending|confirmed|paid|disputed
  stripe_charge_id         text,
  stripe_transfer_id       text,
  created_at               timestamptz default now(),
  confirmed_at             timestamptz,
  paid_at                  timestamptz
);

-- Virements vers influenceurs
create table if not exists influencer_payouts (
  id                  uuid primary key default gen_random_uuid(),
  influencer_id       uuid not null references influencer_profiles(id) on delete cascade,
  amount_cents        int  not null,
  stripe_transfer_id  text,
  status              text not null default 'initiated', -- initiated|succeeded|failed
  created_at          timestamptz default now()
);

-- RLS
alter table influencer_profiles   enable row level security;
alter table affiliate_offers       enable row level security;
alter table affiliate_links        enable row level security;
alter table affiliate_conversions  enable row level security;
alter table influencer_payouts     enable row level security;

-- Policies
create policy "own_influencer_profile" on influencer_profiles
  for all using (auth.uid() = id);

create policy "seller_own_offers" on affiliate_offers
  for all using (auth.uid() = seller_id);

create policy "public_read_active_offers" on affiliate_offers
  for select using (status = 'active');

create policy "own_links" on affiliate_links
  for all using (auth.uid() = influencer_id);

create policy "own_conversions" on affiliate_conversions
  for select using (
    link_id in (select id from affiliate_links where influencer_id = auth.uid())
  );

create policy "own_payouts" on influencer_payouts
  for select using (auth.uid() = influencer_id);

-- Fonction : générer un code unique 8 chars
create or replace function generate_affiliate_code() returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  code  text := '';
  i     int;
begin
  for i in 1..8 loop
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return code;
end;
$$;

-- Fonction : créer un lien affilié (idempotent)
create or replace function get_or_create_affiliate_link(
  p_offer_id      uuid,
  p_influencer_id uuid
) returns text language plpgsql security definer as $$
declare
  v_code text;
  v_existing text;
begin
  -- Vérifier si lien existe déjà
  select unique_code into v_existing
    from affiliate_links
    where offer_id = p_offer_id and influencer_id = p_influencer_id;

  if v_existing is not null then
    return v_existing;
  end if;

  -- Générer un code unique
  loop
    v_code := generate_affiliate_code();
    exit when not exists (select 1 from affiliate_links where unique_code = v_code);
  end loop;

  insert into affiliate_links (unique_code, offer_id, influencer_id)
    values (v_code, p_offer_id, p_influencer_id);

  return v_code;
end;
$$;

-- RPC: incrémenter les clics d'un lien affilié
create or replace function increment_affiliate_clicks(p_link_id uuid)
returns void language sql security definer as $$
  update affiliate_links set clicks = clicks + 1 where id = p_link_id;
$$;
