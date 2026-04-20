-- Feel The Gap — E-commerce P0 extensions (cf docs/STORE_PLATFORM_SPEC_V2_ADDITIONS.md §2.1)
-- Bloquant launch : variantes, paniers persistants, adresses, shipping, cookie consent.

-- ── 1. Variantes produit ──
create table if not exists store_product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references store_products(id) on delete cascade,
  name text not null,
  position int not null default 0,
  values text[] not null default '{}'
);
create index if not exists idx_spo_product on store_product_options(product_id);

create table if not exists store_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references store_products(id) on delete cascade,
  sku text,
  ean text,
  option_values jsonb not null,
  price_b2c_ttc_cents int,
  price_b2b_ht_cents int,
  stock_qty numeric(14,3) not null default 0,
  weight_g int,
  position int not null default 0,
  active boolean not null default true,
  unique (product_id, option_values)
);
create index if not exists idx_spv_product on store_product_variants(product_id);

-- ── 2. Paniers persistants (B2C abandonné = recovery emails) ──
create table if not exists store_carts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  buyer_user_id uuid references auth.users(id) on delete set null,
  buyer_email text,
  items jsonb not null default '[]',
  subtotal_cents int not null default 0,
  currency text not null default 'EUR',
  status text not null default 'active' check (status in ('active','abandoned','converted','expired')),
  recovery_email_1_sent_at timestamptz,
  recovery_email_2_sent_at timestamptz,
  recovery_email_3_sent_at timestamptz,
  recovered_order_id uuid references store_orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index if not exists idx_carts_status on store_carts(status, updated_at desc);
create index if not exists idx_carts_buyer on store_carts(buyer_user_id);

-- ── 3. Adresses acheteur ──
create table if not exists store_buyer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  type text not null default 'both' check (type in ('shipping','billing','both')),
  full_name text not null,
  company text,
  line1 text not null, line2 text,
  postal_code text not null, city text not null,
  state text, country_iso2 text not null,
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_sba_user on store_buyer_addresses(user_id);

-- ── 4. Shipping zones + rates ──
create table if not exists store_shipping_zones (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  country_codes text[] not null,
  position int not null default 0
);
create index if not exists idx_ssz_store on store_shipping_zones(store_id);

create table if not exists store_shipping_rates (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references store_shipping_zones(id) on delete cascade,
  name text not null,
  carrier text,
  service_code text,
  price_cents int not null,
  free_above_cents int,
  weight_max_g int,
  delivery_days_min int, delivery_days_max int,
  active boolean not null default true
);
create index if not exists idx_ssr_zone on store_shipping_rates(zone_id);

-- ── 5. Cookie consents (RGPD) ──
create table if not exists store_cookie_consents (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  visitor_uuid text not null,
  consent_data jsonb not null,
  ip_hash text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_cookie_consents_store on store_cookie_consents(store_id, created_at desc);

-- ── RLS ──
alter table store_product_options enable row level security;
alter table store_product_variants enable row level security;
alter table store_carts enable row level security;
alter table store_buyer_addresses enable row level security;
alter table store_shipping_zones enable row level security;
alter table store_shipping_rates enable row level security;
alter table store_cookie_consents enable row level security;

-- Owner policies (helper pattern : store→owner)
drop policy if exists "spo_owner" on store_product_options;
create policy "spo_owner" on store_product_options
  for all using (exists (select 1 from store_products sp join stores s on s.id = sp.store_id where sp.id = store_product_options.product_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from store_products sp join stores s on s.id = sp.store_id where sp.id = store_product_options.product_id and s.owner_id = auth.uid()));
drop policy if exists "spo_public_read" on store_product_options;
create policy "spo_public_read" on store_product_options
  for select using (exists (select 1 from store_products sp where sp.id = store_product_options.product_id and sp.visibility = 'active'));

drop policy if exists "spv_owner" on store_product_variants;
create policy "spv_owner" on store_product_variants
  for all using (exists (select 1 from store_products sp join stores s on s.id = sp.store_id where sp.id = store_product_variants.product_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from store_products sp join stores s on s.id = sp.store_id where sp.id = store_product_variants.product_id and s.owner_id = auth.uid()));
drop policy if exists "spv_public_read" on store_product_variants;
create policy "spv_public_read" on store_product_variants
  for select using (exists (select 1 from store_products sp where sp.id = store_product_variants.product_id and sp.visibility = 'active'));

-- Cart : owner buyer OR store owner peut voir, anonymes via session
drop policy if exists "carts_buyer_or_store" on store_carts;
create policy "carts_buyer_or_store" on store_carts
  for all using (auth.uid() = buyer_user_id or exists (select 1 from stores where stores.id = store_carts.store_id and stores.owner_id = auth.uid()))
  with check (auth.uid() = buyer_user_id or buyer_user_id is null);

-- Adresses : user only
drop policy if exists "sba_user" on store_buyer_addresses;
create policy "sba_user" on store_buyer_addresses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Shipping : owner only + public read
drop policy if exists "ssz_owner" on store_shipping_zones;
create policy "ssz_owner" on store_shipping_zones
  for all using (exists (select 1 from stores where stores.id = store_shipping_zones.store_id and stores.owner_id = auth.uid()))
  with check (exists (select 1 from stores where stores.id = store_shipping_zones.store_id and stores.owner_id = auth.uid()));
drop policy if exists "ssz_public_read" on store_shipping_zones;
create policy "ssz_public_read" on store_shipping_zones
  for select using (exists (select 1 from stores where stores.id = store_shipping_zones.store_id and stores.status = 'active'));

drop policy if exists "ssr_owner" on store_shipping_rates;
create policy "ssr_owner" on store_shipping_rates
  for all using (exists (select 1 from store_shipping_zones z join stores s on s.id = z.store_id where z.id = store_shipping_rates.zone_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from store_shipping_zones z join stores s on s.id = z.store_id where z.id = store_shipping_rates.zone_id and s.owner_id = auth.uid()));
drop policy if exists "ssr_public_read" on store_shipping_rates;
create policy "ssr_public_read" on store_shipping_rates
  for select using (active = true and exists (select 1 from store_shipping_zones z join stores s on s.id = z.store_id where z.id = store_shipping_rates.zone_id and s.status = 'active'));

-- Cookie consent : insert only (anonymous), no read
drop policy if exists "scc_insert_only" on store_cookie_consents;
create policy "scc_insert_only" on store_cookie_consents
  for insert with check (true);

comment on table store_product_variants is 'Variantes produit (taille/couleur/matière) — option_values JSON pour combo unique.';
comment on table store_carts is 'Paniers persistants — recovery emails T+1h/24h/72h, expirent à 30j.';
comment on table store_buyer_addresses is 'Adresses réutilisables checkout après checkout (user-scoped).';
comment on table store_shipping_zones is 'Zones tarifaires par pays — France/UE/Monde + tarifs par poids/prix.';
comment on table store_cookie_consents is 'Log consentements cookies (RGPD art. 7) — anonyme via visitor_uuid + ip_hash.';
