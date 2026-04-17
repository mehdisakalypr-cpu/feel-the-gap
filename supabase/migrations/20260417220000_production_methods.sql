-- Production 3.0 — méthodes de fabrication par produit
create table if not exists public.production_methods (
  id               uuid primary key default gen_random_uuid(),
  product_slug     text not null,           -- 'cafe','cacao','textile',...
  name             text not null,           -- 'Natural process artisanal'
  description_md   text not null,
  popularity_rank  int  not null default 99,
  created_at       timestamptz not null default now(),
  unique (product_slug, name)
);
create index if not exists idx_production_methods_product on public.production_methods(product_slug);

create table if not exists public.method_resources (
  id              uuid primary key default gen_random_uuid(),
  method_id       uuid not null references public.production_methods(id) on delete cascade,
  type            text not null check (type in ('machine','material')),
  name            text not null,
  est_cost_eur    numeric(12,2),
  supplier_hint   text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_method_resources_method on public.method_resources(method_id);

create table if not exists public.method_metrics (
  method_id             uuid primary key references public.production_methods(id) on delete cascade,
  cost_score            int  check (cost_score between 0 and 100),
  time_months           numeric(6,2),
  quality_score         int  check (quality_score between 0 and 100),
  capex_eur             numeric(14,2),
  opex_eur_per_unit     numeric(12,4),
  updated_at            timestamptz not null default now()
);

create table if not exists public.method_media (
  id         uuid primary key default gen_random_uuid(),
  method_id  uuid not null references public.production_methods(id) on delete cascade,
  type       text not null check (type in ('image','video')),
  url        text not null,
  caption    text,
  created_at timestamptz not null default now()
);
create index if not exists idx_method_media_method on public.method_media(method_id);

-- Public read (les méthodes sont du contenu, pas des données user)
alter table public.production_methods enable row level security;
alter table public.method_resources enable row level security;
alter table public.method_metrics enable row level security;
alter table public.method_media enable row level security;

drop policy if exists prod_methods_read on public.production_methods;
drop policy if exists method_res_read on public.method_resources;
drop policy if exists method_metrics_read on public.method_metrics;
drop policy if exists method_media_read on public.method_media;

create policy prod_methods_read on public.production_methods for select to authenticated using (true);
create policy method_res_read   on public.method_resources   for select to authenticated using (true);
create policy method_metrics_read on public.method_metrics   for select to authenticated using (true);
create policy method_media_read on public.method_media       for select to authenticated using (true);
