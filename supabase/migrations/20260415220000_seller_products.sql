-- FTG — Entrepreneur seller products + transport quotes + Incoterms contracts
-- Fait partie de project_ftg_entrepreneur_seller_transport.md

-- Produits listés par un entrepreneur/seller
create table if not exists public.seller_products (
  id             uuid primary key default gen_random_uuid(),
  seller_id      uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  description    text,
  hs_code        text,                            -- code douanier international (ex: '0801.32')
  origin_country text not null,                   -- ISO-3 (ex: 'CIV')
  origin_port    text,                            -- ex: 'Abidjan', 'Shanghai'
  unit_price_eur numeric(12,2) not null,
  min_order_qty  numeric(12,2),
  unit           text default 'kg',               -- kg, ton, unit, pallet, container
  available_qty  numeric(12,2),
  incoterm_preferred text check (incoterm_preferred in ('EXW','FCA','CPT','CIP','DAP','DPU','DDP','FAS','FOB','CFR','CIF')),
  images         text[] default '{}',
  certifications text[] default '{}',             -- ex: 'organic', 'fairtrade', 'iso_9001'
  status         text not null default 'active' check (status in ('draft','active','paused','archived')),
  visibility     text not null default 'public' check (visibility in ('public','private','verified_only')),
  slug           text,                             -- pour URL publique /seller/{seller_slug}/p/{product_slug}
  metadata       jsonb default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_seller_products_seller on public.seller_products(seller_id) where status = 'active';
create index if not exists idx_seller_products_hs on public.seller_products(hs_code) where status = 'active';
create index if not exists idx_seller_products_origin on public.seller_products(origin_country) where status = 'active';

-- Devis de transport reçus pour un produit / trajet
create table if not exists public.transport_quotes (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid references public.seller_products(id) on delete cascade,
  buyer_id       uuid references auth.users(id),
  origin_port    text not null,
  destination_port text not null,
  incoterm       text not null check (incoterm in ('EXW','FCA','CPT','CIP','DAP','DPU','DDP','FAS','FOB','CFR','CIF')),
  mode           text check (mode in ('ocean_fcl','ocean_lcl','air','parcel','road','rail')),
  provider       text not null,                   -- freightos | flexport | dhl | cainiao | etc.
  provider_quote_id text,
  price_eur      numeric(12,2) not null,
  transit_days   int,
  insurance_eur  numeric(12,2),
  customs_eur    numeric(12,2),
  valid_until    timestamptz,
  raw_response   jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists idx_transport_quotes_product on public.transport_quotes(product_id);
create index if not exists idx_transport_quotes_valid on public.transport_quotes(valid_until);

-- Templates Incoterms 2020 (clauses standards ICC)
create table if not exists public.incoterms_templates (
  code           text primary key check (code in ('EXW','FCA','CPT','CIP','DAP','DPU','DDP','FAS','FOB','CFR','CIF')),
  mode_scope     text not null check (mode_scope in ('any_mode','sea_waterway')),
  seller_duties  jsonb not null,                  -- array of clauses
  buyer_duties   jsonb not null,
  risk_transfer  text not null,                    -- description of risk transfer point
  cost_transfer  text not null,
  template_text  text not null,                   -- contract boilerplate with placeholders
  version        text not null default '2020',
  updated_at     timestamptz not null default now()
);

-- Contrats signés générés pour une transaction
create table if not exists public.incoterms_contracts (
  id             uuid primary key default gen_random_uuid(),
  quote_id       uuid references public.transport_quotes(id),
  product_id     uuid references public.seller_products(id),
  seller_id      uuid references auth.users(id),
  buyer_id       uuid references auth.users(id),
  incoterm       text not null,
  contract_html  text not null,
  signed_at      timestamptz,
  signed_by_seller text,                          -- email/name
  signed_by_buyer  text,
  docusign_envelope_id text,
  status         text not null default 'draft' check (status in ('draft','pending_seller','pending_buyer','signed','cancelled')),
  created_at     timestamptz not null default now()
);

-- RLS
alter table public.seller_products enable row level security;
alter table public.transport_quotes enable row level security;
alter table public.incoterms_contracts enable row level security;
alter table public.incoterms_templates enable row level security;

-- Policies : seller voit/edit ses propres products, public voit les active public
drop policy if exists seller_products_owner on public.seller_products;
create policy seller_products_owner on public.seller_products
  for all to authenticated using (seller_id = auth.uid()) with check (seller_id = auth.uid());

drop policy if exists seller_products_public_read on public.seller_products;
create policy seller_products_public_read on public.seller_products
  for select to anon, authenticated using (status = 'active' and visibility = 'public');

drop policy if exists transport_quotes_owner on public.transport_quotes;
create policy transport_quotes_owner on public.transport_quotes
  for all to authenticated using (
    buyer_id = auth.uid() or product_id in (select id from public.seller_products where seller_id = auth.uid())
  );

drop policy if exists incoterms_contracts_parties on public.incoterms_contracts;
create policy incoterms_contracts_parties on public.incoterms_contracts
  for all to authenticated using (seller_id = auth.uid() or buyer_id = auth.uid());

drop policy if exists incoterms_templates_public_read on public.incoterms_templates;
create policy incoterms_templates_public_read on public.incoterms_templates
  for select to anon, authenticated using (true);
