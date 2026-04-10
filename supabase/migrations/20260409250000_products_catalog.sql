-- Feel The Gap — Products catalog + influencer favorites
-- Catalogue produits exposable aux influenceurs, avec OPT-IN seller obligatoire.

create table if not exists products_catalog (
  id              uuid primary key default gen_random_uuid(),
  -- Seller owner (auth.users). A user with role 'entrepreneur' or 'seller' can create.
  seller_id       uuid not null references auth.users(id) on delete cascade,
  -- Display
  name            text not null,
  slug            text not null unique,
  description     text,
  short_pitch     text,               -- 1-phrase hook
  price_eur       numeric not null check (price_eur >= 0),
  currency        text not null default 'EUR',
  category        text not null,      -- agriculture, cosmetics, fashion, energy, services, food, other
  -- Media
  images          text[] not null default '{}',  -- URLs of product photos
  hero_image_url  text,
  -- Structured attributes
  benefits        text[] not null default '{}',  -- "cacao de Côte d'Ivoire", "production éco-responsable", ...
  ingredients     text[] not null default '{}',
  variants        text[] not null default '{}',  -- "chocolat fraise", "chocolat pistache"
  origin_country  text,
  impact_data     jsonb not null default '{}'::jsonb,  -- carbon_footprint_kg, water_usage, fair_trade, etc
  -- Affiliate
  commission_pct  numeric not null default 10 check (commission_pct >= 0 and commission_pct <= 100),
  -- Split platform/influencer (defaults to 30/70, overridable per product)
  platform_pct    numeric not null default 30 check (platform_pct >= 0 and platform_pct <= 100),
  influencer_pct  numeric not null default 70 check (influencer_pct >= 0 and influencer_pct <= 100),
  external_url    text,               -- Seller's product page
  our_go_code     text unique,        -- 8-char code used in /go/{code} tracking
  -- Opt-in seller obligation
  catalog_opt_in  boolean not null default false,  -- seller EXPLICIT consent to display in FTG catalog
  catalog_consent_at timestamptz,
  catalog_consent_ip text,            -- consent audit trail
  -- Scraping metadata (when imported from external URL via I-C)
  scraped_at      timestamptz,
  scrape_source   text,               -- 'manual' | 'og_meta' | 'json_ld' | 'microdata'
  -- Stats
  views_count     int not null default 0,
  saves_count     int not null default 0,
  status          text not null default 'active' check (status in ('draft','active','paused','archived')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_products_catalog_seller on products_catalog(seller_id);
create index if not exists idx_products_catalog_category on products_catalog(category);
create index if not exists idx_products_catalog_optin on products_catalog(catalog_opt_in) where catalog_opt_in = true;

-- Updated-at trigger (reuses set_updated_at from funding_platform migration)
drop trigger if exists trg_products_catalog_updated on products_catalog;
create trigger trg_products_catalog_updated before update on products_catalog
  for each row execute function set_updated_at();

-- Consent audit trigger: set catalog_consent_at when opt-in toggles to true
create or replace function set_catalog_consent_timestamp()
returns trigger language plpgsql as $$
begin
  if new.catalog_opt_in = true and (old.catalog_opt_in is distinct from true) then
    new.catalog_consent_at = coalesce(new.catalog_consent_at, now());
  elsif new.catalog_opt_in = false then
    new.catalog_consent_at = null;
    new.catalog_consent_ip = null;
  end if;
  return new;
end $$;

drop trigger if exists trg_products_catalog_consent on products_catalog;
create trigger trg_products_catalog_consent before update on products_catalog
  for each row execute function set_catalog_consent_timestamp();

-- ─── Influencer favorites (shortlist per influencer) ───────────────────────

create table if not exists influencer_favorites (
  id              uuid primary key default gen_random_uuid(),
  influencer_id   uuid not null references auth.users(id) on delete cascade,
  product_id      uuid not null references products_catalog(id) on delete cascade,
  notes           text,
  created_at      timestamptz not null default now(),
  unique (influencer_id, product_id)
);

create index if not exists idx_inf_favs_influencer on influencer_favorites(influencer_id);
create index if not exists idx_inf_favs_product on influencer_favorites(product_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────

alter table products_catalog enable row level security;
alter table influencer_favorites enable row level security;

-- products_catalog: seller can manage their own products always
drop policy if exists "products_catalog_seller_owner" on products_catalog;
create policy "products_catalog_seller_owner" on products_catalog
  for all using (auth.uid() = seller_id) with check (auth.uid() = seller_id);

-- Anyone authenticated can read opted-in active products
drop policy if exists "products_catalog_public_read" on products_catalog;
create policy "products_catalog_public_read" on products_catalog
  for select using (
    catalog_opt_in = true and status = 'active'
  );

-- influencer_favorites: owner only
drop policy if exists "inf_favs_owner" on influencer_favorites;
create policy "inf_favs_owner" on influencer_favorites
  for all using (auth.uid() = influencer_id) with check (auth.uid() = influencer_id);

comment on table products_catalog is 'Catalogue de produits affiliables. Requiert OPT-IN explicite du seller (catalog_opt_in=true) pour être visible dans le catalogue Feel The Gap.';
comment on column products_catalog.catalog_opt_in is 'Consentement explicite du seller pour afficher son produit dans le catalogue FTG. Obligatoire, RGPD + propriété intellectuelle.';
comment on column products_catalog.platform_pct is 'Part plateforme de la commission (défaut 30%). Le reste va à l''influenceur.';
comment on column products_catalog.influencer_pct is 'Part influenceur de la commission (défaut 70%).';
comment on table influencer_favorites is 'Shortlist personnelle d''un influenceur. Private.';
