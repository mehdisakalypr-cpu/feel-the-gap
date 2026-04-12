-- Feel The Gap — Prospection directories
-- Bases de prospection multi-types pour enrichir le parcours "route vers le succès"
-- et alimenter la campagne outbound (investisseurs, entrepreneurs, exportateurs,
-- et SURTOUT les acheteurs locaux — industriels / grossistes / centrales d'achats).

-- ═══════════════════════════════════════════════════════════
-- 1. LOCAL BUYERS (priorité — débouchés pour entrepreneurs FTG)
-- ═══════════════════════════════════════════════════════════
create table if not exists local_buyers (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  buyer_type       text not null check (buyer_type in ('industriel','grossiste','centrale_achats','transformateur','distributeur','horeca','export_trader')),
  country_iso      text not null,
  city             text,
  address          text,
  website_url      text,
  email            text,
  phone            text,
  whatsapp         text,
  contact_name     text,
  contact_role     text,
  -- Denrées achetées — aligné sur le slug produit des opportunities FTG
  product_slugs    text[] not null default '{}',
  -- Fourchette volume (MT/an)
  annual_volume_mt_min numeric,
  annual_volume_mt_max numeric,
  price_range_eur_min  numeric,
  price_range_eur_max  numeric,
  quality_requirements text,
  certifications_required text[],
  payment_terms    text,
  -- Scoring & état
  confidence_score numeric default 0.5 check (confidence_score >= 0 and confidence_score <= 1),
  source           text,          -- 'manual' | 'scraper_linkedin' | 'scraper_panjiva' | 'ai_research' | 'partner_submission'
  verified         boolean default false,
  last_contacted_at timestamptz,
  last_response_at timestamptz,
  notes            text,
  raw_scrape       jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_local_buyers_country on local_buyers(country_iso);
create index if not exists idx_local_buyers_products on local_buyers using gin(product_slugs);
create index if not exists idx_local_buyers_type on local_buyers(buyer_type);
create index if not exists idx_local_buyers_verified on local_buyers(verified) where verified = true;

-- ═══════════════════════════════════════════════════════════
-- 2. EXPORTERS (concurrents / partenaires potentiels)
-- ═══════════════════════════════════════════════════════════
create table if not exists exporters_directory (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  country_iso      text not null,
  city             text,
  website_url      text,
  email            text,
  phone            text,
  contact_name     text,
  product_slugs    text[] not null default '{}',
  destinations     text[] not null default '{}',   -- ISO importers
  annual_volume_mt numeric,
  hs_codes         text[],
  certifications  text[],
  source           text,
  confidence_score numeric default 0.5,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_exporters_country on exporters_directory(country_iso);
create index if not exists idx_exporters_products on exporters_directory using gin(product_slugs);

-- ═══════════════════════════════════════════════════════════
-- 3. INVESTORS DIRECTORY (Business Angels + Funds)
-- ═══════════════════════════════════════════════════════════
create table if not exists investors_directory (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  investor_type    text not null check (investor_type in ('business_angel','vc_fund','pe_fund','family_office','dfi','impact_fund','crowdfunding','grant_agency')),
  firm_name        text,
  website_url      text,
  linkedin_url     text,
  email            text,
  phone            text,
  country_iso      text,
  city             text,
  -- Thesis
  sectors_of_interest text[] not null default '{}', -- ['agriculture','food_processing','logistics','fintech','health','renewable_energy']
  regions_of_interest text[] not null default '{}', -- country ISO codes
  ticket_size_min_eur numeric,
  ticket_size_max_eur numeric,
  stages           text[] not null default '{}',    -- ['pre_seed','seed','series_a','series_b','growth']
  impact_focus     boolean default false,
  recent_deals     jsonb,                            -- [{company, amount, date, sector}]
  partners         jsonb,                            -- [{name, role, linkedin}]
  -- Scoring
  confidence_score numeric default 0.5,
  verified         boolean default false,
  source           text,
  last_contacted_at timestamptz,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_investors_type on investors_directory(investor_type);
create index if not exists idx_investors_sectors on investors_directory using gin(sectors_of_interest);
create index if not exists idx_investors_regions on investors_directory using gin(regions_of_interest);

-- ═══════════════════════════════════════════════════════════
-- 4. ENTREPRENEURS DIRECTORY (cross-ref opportunities)
-- Note: differs from commerce_leads (small retail) — this is for
-- serious entrepreneurs / SME operators targeted by FTG opportunities.
-- ═══════════════════════════════════════════════════════════
create table if not exists entrepreneurs_directory (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  business_name    text,
  country_iso      text not null,
  city             text,
  email            text,
  phone            text,
  whatsapp         text,
  linkedin_url     text,
  website_url      text,
  sector           text,                 -- 'agriculture' | 'food_processing' | ...
  product_slugs    text[] not null default '{}',
  annual_revenue_eur_estimate numeric,
  employees_count  int,
  years_active     int,
  opportunities_matched text[] not null default '{}',  -- opportunity slugs
  has_business_plan boolean default false,
  seeks_financing  boolean default false,
  seeks_clients    boolean default false,
  confidence_score numeric default 0.5,
  source           text,
  verified         boolean default false,
  last_contacted_at timestamptz,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_entrepreneurs_country on entrepreneurs_directory(country_iso);
create index if not exists idx_entrepreneurs_products on entrepreneurs_directory using gin(product_slugs);
create index if not exists idx_entrepreneurs_sector on entrepreneurs_directory(sector);

-- ═══════════════════════════════════════════════════════════
-- Triggers updated_at
-- ═══════════════════════════════════════════════════════════
create or replace function _touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists touch_local_buyers on local_buyers;
create trigger touch_local_buyers before update on local_buyers
for each row execute function _touch_updated_at();

drop trigger if exists touch_exporters_directory on exporters_directory;
create trigger touch_exporters_directory before update on exporters_directory
for each row execute function _touch_updated_at();

drop trigger if exists touch_investors_directory on investors_directory;
create trigger touch_investors_directory before update on investors_directory
for each row execute function _touch_updated_at();

drop trigger if exists touch_entrepreneurs_directory on entrepreneurs_directory;
create trigger touch_entrepreneurs_directory before update on entrepreneurs_directory
for each row execute function _touch_updated_at();

-- ═══════════════════════════════════════════════════════════
-- RLS (accès admin par défaut, profils autorisés via RPC)
-- ═══════════════════════════════════════════════════════════
alter table local_buyers enable row level security;
alter table exporters_directory enable row level security;
alter table investors_directory enable row level security;
alter table entrepreneurs_directory enable row level security;

-- Service role bypass (server-side scripts & RPCs)
-- Admin-only read for client (to be relaxed per-column via RPC later)
drop policy if exists "admin_read_local_buyers" on local_buyers;
create policy "admin_read_local_buyers" on local_buyers for select
using (exists (select 1 from profiles p where p.id = auth.uid() and (p.is_admin or p.is_delegate_admin)));

drop policy if exists "admin_read_exporters" on exporters_directory;
create policy "admin_read_exporters" on exporters_directory for select
using (exists (select 1 from profiles p where p.id = auth.uid() and (p.is_admin or p.is_delegate_admin)));

drop policy if exists "admin_read_investors" on investors_directory;
create policy "admin_read_investors" on investors_directory for select
using (exists (select 1 from profiles p where p.id = auth.uid() and (p.is_admin or p.is_delegate_admin)));

drop policy if exists "admin_read_entrepreneurs" on entrepreneurs_directory;
create policy "admin_read_entrepreneurs" on entrepreneurs_directory for select
using (exists (select 1 from profiles p where p.id = auth.uid() and (p.is_admin or p.is_delegate_admin)));
