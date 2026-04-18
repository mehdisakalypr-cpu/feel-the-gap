-- 2026-04-18 — FTG Marketplace Matching (Phase 2 pivot)
-- Offre (production_volumes) ↔ demande (buyer_demands) ↔ matches (marketplace_matches).
-- Commission 2.5% du GMV, calculée en colonnes générées pour traçabilité immuable.

-- ─────────────────────────────────────────────────────────────────────────────
-- production_volumes — ce que les producers/solo_producers ont à vendre
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.production_volumes (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid references auth.users(id) on delete cascade,
  country_iso text not null,
  product_slug text not null,
  product_label text,
  quantity_kg numeric not null check (quantity_kg > 0),
  quality_grade text,
  certifications text[] default '{}',
  harvest_date date,
  available_from date default current_date,
  available_until date,
  floor_price_eur_per_kg numeric,
  incoterm text default 'FOB' check (incoterm in ('EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP')),
  packaging text,
  notes text,
  status text not null default 'open' check (status in ('open','matched','closed','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- buyer_demands — ce que les acheteurs industriels / transformateurs recherchent
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.buyer_demands (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references auth.users(id) on delete cascade,
  product_slug text not null,
  product_label text,
  quantity_kg_min numeric not null check (quantity_kg_min > 0),
  quantity_kg_max numeric,
  quality_grade text,
  required_certifications text[] default '{}',
  ceiling_price_eur_per_kg numeric,
  incoterm text check (incoterm is null or incoterm in ('EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP')),
  origin_country_whitelist text[] default '{}',
  delivery_country_iso text,
  deadline date,
  notes text,
  status text not null default 'open' check (status in ('open','matched','fulfilled','expired','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- marketplace_matches — produit × demande scorée par le matcher IA, côté deal
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.marketplace_matches (
  id uuid primary key default gen_random_uuid(),
  volume_id uuid not null references public.production_volumes(id) on delete cascade,
  demand_id uuid not null references public.buyer_demands(id) on delete cascade,
  match_score numeric not null check (match_score between 0 and 100),
  proposed_quantity_kg numeric not null check (proposed_quantity_kg > 0),
  proposed_price_eur_per_kg numeric not null check (proposed_price_eur_per_kg > 0),
  proposed_total_eur numeric generated always as (proposed_quantity_kg * proposed_price_eur_per_kg) stored,
  commission_rate_pct numeric not null default 2.5 check (commission_rate_pct >= 0),
  commission_amount_eur numeric generated always as (proposed_quantity_kg * proposed_price_eur_per_kg * commission_rate_pct / 100) stored,
  status text not null default 'proposed' check (status in ('proposed','accepted_producer','accepted_buyer','confirmed','rejected','expired')),
  matcher_notes jsonb,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  confirmed_at timestamptz,
  unique (volume_id, demand_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Index pour le matcher (scans fréquents : open × product × country)
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists idx_prod_volumes_open
  on public.production_volumes (product_slug, country_iso)
  where status = 'open';

create index if not exists idx_buyer_demands_open
  on public.buyer_demands (product_slug)
  where status = 'open';

create index if not exists idx_marketplace_matches_status
  on public.marketplace_matches (status);

create index if not exists idx_marketplace_matches_volume
  on public.marketplace_matches (volume_id);

create index if not exists idx_marketplace_matches_demand
  on public.marketplace_matches (demand_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at triggers (idempotent — drop puis recreate)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.marketplace_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prod_volumes_touch on public.production_volumes;
create trigger trg_prod_volumes_touch before update on public.production_volumes
  for each row execute function public.marketplace_touch_updated_at();

drop trigger if exists trg_buyer_demands_touch on public.buyer_demands;
create trigger trg_buyer_demands_touch before update on public.buyer_demands
  for each row execute function public.marketplace_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — producers voient leurs volumes, buyers voient leurs demands,
--       matches visibles aux 2 participants. Liste publique d'open items.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.production_volumes enable row level security;
alter table public.buyer_demands enable row level security;
alter table public.marketplace_matches enable row level security;

drop policy if exists "volumes_owner_rw" on public.production_volumes;
create policy "volumes_owner_rw" on public.production_volumes
  for all to authenticated
  using (auth.uid() = producer_id)
  with check (auth.uid() = producer_id);

drop policy if exists "volumes_public_open_read" on public.production_volumes;
create policy "volumes_public_open_read" on public.production_volumes
  for select
  using (status = 'open');

drop policy if exists "demands_owner_rw" on public.buyer_demands;
create policy "demands_owner_rw" on public.buyer_demands
  for all to authenticated
  using (auth.uid() = buyer_id)
  with check (auth.uid() = buyer_id);

drop policy if exists "demands_public_open_read" on public.buyer_demands;
create policy "demands_public_open_read" on public.buyer_demands
  for select
  using (status = 'open');

drop policy if exists "matches_participants_read" on public.marketplace_matches;
create policy "matches_participants_read" on public.marketplace_matches
  for select to authenticated
  using (
    auth.uid() in (
      select producer_id from public.production_volumes where id = volume_id
      union
      select buyer_id from public.buyer_demands where id = demand_id
    )
  );

-- Le matcher tourne côté service (SERVICE_ROLE), donc pas besoin de policy
-- d'insert côté user — seuls les 2 participants ont un INSERT policy explicite
-- via acceptance flow (géré plus tard par une RPC dédiée).
