-- Research agents schema — regulatory, YouTube, production costs, logistics
-- Feeds: market studies + 3-scenario business plans
-- Created: 2026-04-09

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Country regulations — reglementation, taxes, normes (priorite fraicheur)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.country_regulations (
  id uuid primary key default gen_random_uuid(),
  country_iso text not null references public.countries(id) on delete cascade,
  category text not null check (category in (
    'customs_tariff',    -- tarifs douaniers
    'sanitary',          -- SPS, phytosanitaire, FDA-like
    'technical',         -- normes techniques, certifications
    'fiscal',            -- TVA, taxes locales, fiscalite societe
    'labor',             -- droit du travail, SMIC
    'environment',       -- normes environnementales
    'licensing',         -- licences import/export
    'incoterms',         -- regles incoterms locales
    'investment'         -- code investissement, ZES
  )),
  subcategory text,
  product_hs text,                    -- HS code concerne (nullable si general)
  title text not null,
  content text not null,
  summary text,                       -- resume LLM pour affichage rapide
  source_url text not null,
  source_name text,                   -- ex: "Douanes Senegal", "WTO"
  source_type text check (source_type in ('gov', 'wto', 'ngo', 'news', 'ai_extract')),
  published_date date,                -- date publication source (fraicheur)
  language text default 'fr',
  tags text[],
  confidence numeric(3,2) default 0.8,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_regulations_country on public.country_regulations(country_iso);
create index if not exists idx_regulations_category on public.country_regulations(category);
create index if not exists idx_regulations_published on public.country_regulations(published_date desc);
create index if not exists idx_regulations_product on public.country_regulations(product_hs) where product_hs is not null;
create index if not exists idx_regulations_tags on public.country_regulations using gin(tags);

alter table public.country_regulations enable row level security;
create policy "regulations_read_all" on public.country_regulations for select using (true);
create policy "regulations_service_write" on public.country_regulations for all using (auth.role() = 'service_role');

-- ════════════════════════════════════════════════════════════════════════════
-- 2. YouTube insights — donnees terrain entrepreneurs
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.youtube_insights (
  id uuid primary key default gen_random_uuid(),
  video_id text unique not null,          -- YouTube video ID
  channel_id text,
  channel_name text,
  title text not null,
  description text,
  thumbnail_url text,
  published_at timestamptz,
  duration_seconds int,
  view_count bigint default 0,
  like_count bigint default 0,
  comment_count bigint default 0,

  -- Classification
  country_iso text references public.countries(id),
  product_category text,
  product_hs text,
  topic text check (topic in (
    'import_export',   -- comment importer/exporter
    'production',      -- comment produire/cultiver
    'regulation',      -- reglementation locale
    'business_case',   -- temoignages entrepreneurs
    'market_analysis', -- analyse marche
    'logistics',       -- transport, douane
    'tips',            -- astuces, hacks
    'warning'          -- arnaques, pieges
  )),
  language text,

  -- Contenu extrait
  transcript text,                                -- texte brut (multilangue)
  transcript_language text,
  extracted_insights jsonb,                       -- { costs: [...], prices: [...], contacts: [...], tips: [...], warnings: [...], regulations: [...] }

  -- Scoring
  relevance_score numeric(3,2),                   -- 0-1 pertinence calculee
  quality_score numeric(3,2),                     -- 0-1 qualite contenu
  freshness_score numeric(3,2),                   -- 0-1 fraicheur (decay)

  -- Meta
  search_query text,                              -- requete qui a trouve la video
  processed_at timestamptz,                       -- quand transcript + extraction faits
  created_at timestamptz default now()
);

create index if not exists idx_youtube_country on public.youtube_insights(country_iso);
create index if not exists idx_youtube_topic on public.youtube_insights(topic);
create index if not exists idx_youtube_product on public.youtube_insights(product_category);
create index if not exists idx_youtube_published on public.youtube_insights(published_at desc);
create index if not exists idx_youtube_relevance on public.youtube_insights(relevance_score desc);
create index if not exists idx_youtube_insights_gin on public.youtube_insights using gin(extracted_insights);

alter table public.youtube_insights enable row level security;
create policy "youtube_read_all" on public.youtube_insights for select using (true);
create policy "youtube_service_write" on public.youtube_insights for all using (auth.role() = 'service_role');

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Production cost benchmarks — 3 scenarios x 3 tiers qualite
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.production_cost_benchmarks (
  id uuid primary key default gen_random_uuid(),
  country_iso text not null references public.countries(id) on delete cascade,
  region text,                                    -- region specifique si pertinent (Casablanca vs rural)
  sector text not null,                           -- 'agriculture', 'manufacturing', 'food_processing', ...
  product text not null,                          -- ex: 'cacao', 'textile_coton', 'aluminium_profile'
  product_hs text,

  -- Type de cout
  cost_type text not null check (cost_type in (
    'land_m2',           -- prix au m2 (agricole, industriel, commercial)
    'land_hectare',      -- prix a l'hectare
    'labor_hour',        -- salaire horaire
    'labor_month',       -- salaire mensuel
    'labor_density',     -- nombre employes / hectare ou / m2
    'machine_capex',     -- investissement machine
    'machine_opex',      -- cout maintenance/energie machine
    'energy_kwh',        -- prix electricite
    'water_m3',          -- prix eau
    'raw_material',      -- matieres premieres
    'certification',     -- cout certifications (HACCP, BIO, GOTS...)
    'rent_m2',           -- loyer au m2
    'permit'             -- cout permis/licences
  )),

  -- 3 scenarios
  scenario text not null check (scenario in (
    'artisanal',         -- main d'oeuvre intensive, outils simples
    'mechanized',        -- industriel mecanise classique
    'ai_automated'       -- automatise IA haut rendement
  )),

  -- 3 tiers qualite sortie
  quality_tier text check (quality_tier in ('entry', 'mid', 'premium')),

  -- Valeur
  value_min numeric,
  value_avg numeric not null,
  value_max numeric,
  currency text default 'EUR',
  unit text not null,                             -- 'EUR/m2', 'EUR/mois', 'persons/hectare'

  -- Hypotheses
  assumptions jsonb,                              -- { team_size, production_volume, hours_per_day, ... }

  -- Source
  source text,
  source_url text,
  source_year int,
  confidence numeric(3,2) default 0.7,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_benchmarks_country on public.production_cost_benchmarks(country_iso);
create index if not exists idx_benchmarks_product on public.production_cost_benchmarks(product);
create index if not exists idx_benchmarks_sector on public.production_cost_benchmarks(sector);
create index if not exists idx_benchmarks_scenario on public.production_cost_benchmarks(scenario);
create index if not exists idx_benchmarks_cost_type on public.production_cost_benchmarks(cost_type);

alter table public.production_cost_benchmarks enable row level security;
create policy "benchmarks_read_all" on public.production_cost_benchmarks for select using (true);
create policy "benchmarks_service_write" on public.production_cost_benchmarks for all using (auth.role() = 'service_role');

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Logistics corridors — incoterms, fret, douane
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.logistics_corridors (
  id uuid primary key default gen_random_uuid(),
  origin_iso text not null references public.countries(id),
  destination_iso text not null references public.countries(id),
  origin_port text,                               -- ex: "Le Havre", "CDG"
  destination_port text,

  mode text not null check (mode in ('sea', 'air', 'road', 'rail', 'multimodal')),
  container_type text,                            -- "20ft", "40ft", "40ft HC", "reefer 40ft", "air LD3"
  incoterm text,                                  -- "FOB", "CIF", "DDP", "EXW", "DAP", ...

  cost_usd numeric,
  cost_eur numeric,
  transit_days_min int,
  transit_days_avg int,
  transit_days_max int,

  customs_duty_pct numeric(5,2),                  -- droit de douane applique
  vat_pct numeric(5,2),                           -- TVA destination

  notes text,
  source text,
  source_url text,
  valid_from date,
  valid_until date,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_corridors_origin on public.logistics_corridors(origin_iso);
create index if not exists idx_corridors_destination on public.logistics_corridors(destination_iso);
create index if not exists idx_corridors_mode on public.logistics_corridors(mode);
create unique index if not exists uq_corridor_route on public.logistics_corridors(origin_iso, destination_iso, mode, container_type, incoterm);

alter table public.logistics_corridors enable row level security;
create policy "corridors_read_all" on public.logistics_corridors for select using (true);
create policy "corridors_service_write" on public.logistics_corridors for all using (auth.role() = 'service_role');

-- ════════════════════════════════════════════════════════════════════════════
-- Triggers updated_at
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_regulations_updated on public.country_regulations;
create trigger trg_regulations_updated before update on public.country_regulations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_benchmarks_updated on public.production_cost_benchmarks;
create trigger trg_benchmarks_updated before update on public.production_cost_benchmarks
  for each row execute function public.set_updated_at();

drop trigger if exists trg_corridors_updated on public.logistics_corridors;
create trigger trg_corridors_updated before update on public.logistics_corridors
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- Research run logs (dedicated — distinct from existing agent_runs)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.research_runs (
  id uuid primary key default gen_random_uuid(),
  agent text not null check (agent in (
    'youtube-intel', 'regulatory-collector', 'production-costs', 'logistics-collector', 'orchestrator'
  )),
  country_iso text,
  product text,
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'failed')),
  stats jsonb,                                    -- { videos_fetched, insights_extracted, tokens_used, quota_used }
  error text,
  started_at timestamptz default now(),
  finished_at timestamptz
);

create index if not exists idx_research_runs_agent on public.research_runs(agent);
create index if not exists idx_research_runs_status on public.research_runs(status);
create index if not exists idx_research_runs_country on public.research_runs(country_iso);
create index if not exists idx_research_runs_started on public.research_runs(started_at desc);

alter table public.research_runs enable row level security;
create policy "research_runs_service_only" on public.research_runs for all using (auth.role() = 'service_role');
