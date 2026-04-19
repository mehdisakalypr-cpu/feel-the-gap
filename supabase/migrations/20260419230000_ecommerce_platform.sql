-- Feel The Gap — E-commerce platform (P1 schema MVP)
-- Spec complète : docs/STORE_PLATFORM_SPEC.md
-- CGV FTG : /root/legal/STORE_FTG_CGV_TEMPLATE.md

-- ── 1. Stores (1 par compte par défaut, jusqu'à 5 sur Ultimate, illimité Custom) ──
create table if not exists stores (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  slug            text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  name            text not null,
  -- Modes de vente : B2B uniquement / B2C uniquement / les deux
  mode_b2b        boolean not null default false,
  mode_b2c        boolean not null default true,
  -- Statut
  status          text not null default 'draft' check (status in ('draft','active','suspended','archived')),
  -- Activation requirements
  cgv_signed_at   timestamptz,
  cgv_version     text,
  legal_docs_complete boolean not null default false,
  twofa_enabled   boolean not null default false,
  -- Branding
  logo_url        text,
  primary_color   text default '#C9A84C',
  custom_domain   text,
  -- Billing entity (qui figure sur les factures Acheteurs)
  billing_entity  jsonb default '{}',  -- {legal_name, vat_number, siren, address, email, phone}
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_stores_owner on stores(owner_id);
create index if not exists idx_stores_slug on stores(slug);
create index if not exists idx_stores_status on stores(status);

-- ── 2. Categories (hiérarchique) ──
create table if not exists store_product_categories (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores(id) on delete cascade,
  parent_id       uuid references store_product_categories(id) on delete set null,
  name            text not null,
  slug            text not null,
  position        int not null default 0,
  unique (store_id, slug)
);
create index if not exists idx_spc_store on store_product_categories(store_id);

-- ── 3. Products ──
create table if not exists store_products (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores(id) on delete cascade,
  sku             text,
  ean             text,
  gtin            text,
  name            text not null,
  description     text,
  category_id     uuid references store_product_categories(id) on delete set null,
  segment         text not null default 'b2c' check (segment in ('b2b','b2c','both')),
  -- Conditionnement
  packaging_type  text not null check (packaging_type in ('unit','weight','volume')),
  -- Pour weight: 'g','kg','t' / volume: 'ml','l','m3' / unit: 'piece','pack','set'
  packaging_unit  text not null,
  -- Quantité par unité (ex: pack de 6, sachet 250g, etc.)
  packaging_qty   numeric(12,3) default 1,
  -- Prix B2B HT et B2C TTC séparés (selon segment)
  price_b2b_ht_cents  int,
  price_b2c_ttc_cents int,
  vat_rate_pct    numeric(4,2) default 20.00,
  -- Stock
  stock_qty       numeric(14,3) not null default 0,
  stock_low_alert numeric(14,3),
  stock_unlimited boolean not null default false,
  -- Légal et certifications
  norms           text[],         -- CE, FDA, ISO9001…
  labels          text[],         -- bio, équitable, AOP, AOC, kosher, halal…
  legal_docs      jsonb default '[]', -- [{name, url, mandatory: true/false}]
  -- Visibilité
  visibility      text not null default 'draft' check (visibility in ('draft','active','archived')),
  position        int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_sp_store on store_products(store_id);
create index if not exists idx_sp_visibility on store_products(visibility);
create index if not exists idx_sp_segment on store_products(segment);

-- ── 4. Product media (photos + vidéos) ──
create table if not exists store_product_media (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references store_products(id) on delete cascade,
  type            text not null check (type in ('photo','video')),
  url             text not null,
  caption         text,
  position        int not null default 0,
  is_cover        boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists idx_spm_product on store_product_media(product_id);

-- ── 5. Discount codes (code unique, montant ou %) ──
create table if not exists store_discount_codes (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores(id) on delete cascade,
  code            text not null,
  discount_type   text not null check (discount_type in ('fixed','percent')),
  discount_value  numeric(10,2) not null,  -- en cents si fixed, en % (0-100) si percent
  max_uses        int,
  used_count      int not null default 0,
  starts_at       timestamptz not null default now(),
  ends_at         timestamptz,
  applies_to      text not null default 'cart' check (applies_to in ('cart','products')),
  product_ids     uuid[],
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (store_id, code)
);
create index if not exists idx_sdc_store on store_discount_codes(store_id);

-- ── 6. Discount campaigns (% appliqué à un lot de produits, time-bounded) ──
create table if not exists store_discount_campaigns (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores(id) on delete cascade,
  name            text not null,
  discount_pct    numeric(5,2) not null check (discount_pct between 0 and 100),
  product_ids     uuid[] not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  status          text not null default 'scheduled' check (status in ('scheduled','active','expired','cancelled')),
  created_at      timestamptz not null default now()
);
create index if not exists idx_sdcamp_store on store_discount_campaigns(store_id);
create index if not exists idx_sdcamp_dates on store_discount_campaigns(starts_at, ends_at);

-- ── 7. Orders ──
create table if not exists store_orders (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores(id) on delete cascade,
  -- Buyer (peut être anonyme ou avoir un compte FTG)
  buyer_user_id   uuid references auth.users(id) on delete set null,
  buyer_email     text not null,
  buyer_name      text,
  buyer_address   jsonb,        -- {line1, line2, city, postal, country, phone}
  -- Pricing
  subtotal_cents  int not null,
  discount_cents  int not null default 0,
  vat_cents       int not null default 0,
  shipping_cents  int not null default 0,
  total_cents     int not null,
  currency        text not null default 'EUR',
  -- Statut
  status          text not null default 'pending' check (status in ('pending','paid','fulfilled','refunded','cancelled')),
  stripe_payment_intent text,
  stripe_charge_id text,
  -- Discount appliqué
  discount_code   text,
  campaign_id     uuid references store_discount_campaigns(id) on delete set null,
  -- Métadonnées
  segment         text not null default 'b2c' check (segment in ('b2b','b2c')),
  notes           text,
  created_at      timestamptz not null default now(),
  paid_at         timestamptz,
  fulfilled_at    timestamptz
);
create index if not exists idx_so_store on store_orders(store_id);
create index if not exists idx_so_buyer on store_orders(buyer_user_id);
create index if not exists idx_so_status on store_orders(status);
create index if not exists idx_so_created on store_orders(created_at desc);

-- ── 8. Order items ──
create table if not exists store_order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references store_orders(id) on delete cascade,
  product_id      uuid references store_products(id) on delete set null,
  product_snapshot jsonb not null,  -- snapshot du produit au moment de la commande
  qty             numeric(14,3) not null,
  unit_price_cents int not null,
  vat_rate_pct    numeric(4,2),
  line_total_cents int not null
);
create index if not exists idx_soi_order on store_order_items(order_id);

-- ── 9. Invoices (avec versioning) ──
create table if not exists store_invoices (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references store_orders(id) on delete cascade,
  store_id        uuid not null references stores(id) on delete cascade,
  invoice_number  text not null,
  version         int not null default 1,
  issued_at       timestamptz not null default now(),
  pdf_url         text,
  -- Snapshot du facturant au moment de l'émission
  issuer_snapshot jsonb not null,
  -- Snapshot complet pour audit (lignes, prix, TVA…)
  data            jsonb not null,
  superseded_by   uuid references store_invoices(id) on delete set null,
  unique (store_id, invoice_number, version)
);
create index if not exists idx_sinv_order on store_invoices(order_id);
create index if not exists idx_sinv_store on store_invoices(store_id);

-- ── 10. Refunds ──
create table if not exists store_refunds (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references store_orders(id) on delete cascade,
  amount_cents    int not null,
  reason          text,
  type            text not null check (type in ('partial','total')),
  stripe_refund_id text,
  status          text not null default 'pending' check (status in ('pending','succeeded','failed')),
  created_by      uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  processed_at    timestamptz
);
create index if not exists idx_sr_order on store_refunds(order_id);

-- ── 11. Stock movements (audit trail) ──
create table if not exists store_stock_movements (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references store_products(id) on delete cascade,
  movement_type   text not null check (movement_type in ('initial','sale','restock','adjustment','return')),
  qty_delta       numeric(14,3) not null,
  qty_before      numeric(14,3) not null,
  qty_after       numeric(14,3) not null,
  ref_order_id    uuid references store_orders(id) on delete set null,
  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists idx_ssm_product on store_stock_movements(product_id);
create index if not exists idx_ssm_date on store_stock_movements(created_at desc);

-- ── 12. Legal docs (CGV/CGU/mentions/cookies par store, multi-langue, versionnées) ──
create table if not exists store_legal_docs (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores(id) on delete cascade,
  doc_type        text not null check (doc_type in ('cgv','cgu','mentions','cookies','dpa','privacy','custom')),
  language        text not null default 'fr',
  source          text not null check (source in ('template','custom')),
  content_md      text not null,
  pdf_url         text,
  version         int not null default 1,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (store_id, doc_type, language, version)
);
create index if not exists idx_sld_store on store_legal_docs(store_id);

-- ── 13. RLS ──
alter table stores enable row level security;
alter table store_product_categories enable row level security;
alter table store_products enable row level security;
alter table store_product_media enable row level security;
alter table store_discount_codes enable row level security;
alter table store_discount_campaigns enable row level security;
alter table store_orders enable row level security;
alter table store_order_items enable row level security;
alter table store_invoices enable row level security;
alter table store_refunds enable row level security;
alter table store_stock_movements enable row level security;
alter table store_legal_docs enable row level security;

-- Policies : owner only sur les ressources d'admin, public read sur products actifs
drop policy if exists "stores_owner" on stores;
create policy "stores_owner" on stores
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "stores_public_read_active" on stores;
create policy "stores_public_read_active" on stores
  for select using (status = 'active');

drop policy if exists "spc_owner" on store_product_categories;
create policy "spc_owner" on store_product_categories
  for all using (exists (select 1 from stores where stores.id = store_product_categories.store_id and stores.owner_id = auth.uid()))
  with check (exists (select 1 from stores where stores.id = store_product_categories.store_id and stores.owner_id = auth.uid()));
drop policy if exists "spc_public_read" on store_product_categories;
create policy "spc_public_read" on store_product_categories
  for select using (exists (select 1 from stores where stores.id = store_product_categories.store_id and stores.status = 'active'));

drop policy if exists "sp_owner" on store_products;
create policy "sp_owner" on store_products
  for all using (exists (select 1 from stores where stores.id = store_products.store_id and stores.owner_id = auth.uid()))
  with check (exists (select 1 from stores where stores.id = store_products.store_id and stores.owner_id = auth.uid()));
drop policy if exists "sp_public_read_active" on store_products;
create policy "sp_public_read_active" on store_products
  for select using (visibility = 'active' and exists (select 1 from stores where stores.id = store_products.store_id and stores.status = 'active'));

drop policy if exists "spm_public_read" on store_product_media;
create policy "spm_public_read" on store_product_media
  for select using (exists (select 1 from store_products where store_products.id = store_product_media.product_id and store_products.visibility = 'active'));
drop policy if exists "spm_owner" on store_product_media;
create policy "spm_owner" on store_product_media
  for all using (exists (select 1 from store_products sp join stores s on s.id = sp.store_id where sp.id = store_product_media.product_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from store_products sp join stores s on s.id = sp.store_id where sp.id = store_product_media.product_id and s.owner_id = auth.uid()));

drop policy if exists "sdc_owner" on store_discount_codes;
create policy "sdc_owner" on store_discount_codes
  for all using (exists (select 1 from stores where stores.id = store_discount_codes.store_id and stores.owner_id = auth.uid()))
  with check (exists (select 1 from stores where stores.id = store_discount_codes.store_id and stores.owner_id = auth.uid()));

drop policy if exists "sdcamp_owner" on store_discount_campaigns;
create policy "sdcamp_owner" on store_discount_campaigns
  for all using (exists (select 1 from stores where stores.id = store_discount_campaigns.store_id and stores.owner_id = auth.uid()))
  with check (exists (select 1 from stores where stores.id = store_discount_campaigns.store_id and stores.owner_id = auth.uid()));

drop policy if exists "so_owner" on store_orders;
create policy "so_owner" on store_orders
  for all using (exists (select 1 from stores where stores.id = store_orders.store_id and stores.owner_id = auth.uid()))
  with check (exists (select 1 from stores where stores.id = store_orders.store_id and stores.owner_id = auth.uid()));
drop policy if exists "so_buyer_read" on store_orders;
create policy "so_buyer_read" on store_orders
  for select using (auth.uid() = buyer_user_id);

drop policy if exists "soi_owner_or_buyer" on store_order_items;
create policy "soi_owner_or_buyer" on store_order_items
  for select using (exists (select 1 from store_orders o left join stores s on s.id = o.store_id where o.id = store_order_items.order_id and (s.owner_id = auth.uid() or o.buyer_user_id = auth.uid())));

drop policy if exists "sinv_owner_or_buyer" on store_invoices;
create policy "sinv_owner_or_buyer" on store_invoices
  for select using (exists (select 1 from stores where stores.id = store_invoices.store_id and stores.owner_id = auth.uid()) or exists (select 1 from store_orders o where o.id = store_invoices.order_id and o.buyer_user_id = auth.uid()));

drop policy if exists "sr_owner" on store_refunds;
create policy "sr_owner" on store_refunds
  for all using (exists (select 1 from store_orders o join stores s on s.id = o.store_id where o.id = store_refunds.order_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from store_orders o join stores s on s.id = o.store_id where o.id = store_refunds.order_id and s.owner_id = auth.uid()));

drop policy if exists "ssm_owner" on store_stock_movements;
create policy "ssm_owner" on store_stock_movements
  for all using (exists (select 1 from store_products sp join stores s on s.id = sp.store_id where sp.id = store_stock_movements.product_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from store_products sp join stores s on s.id = sp.store_id where sp.id = store_stock_movements.product_id and s.owner_id = auth.uid()));

drop policy if exists "sld_owner" on store_legal_docs;
create policy "sld_owner" on store_legal_docs
  for all using (exists (select 1 from stores where stores.id = store_legal_docs.store_id and stores.owner_id = auth.uid()))
  with check (exists (select 1 from stores where stores.id = store_legal_docs.store_id and stores.owner_id = auth.uid()));
drop policy if exists "sld_public_read" on store_legal_docs;
create policy "sld_public_read" on store_legal_docs
  for select using (active = true and exists (select 1 from stores where stores.id = store_legal_docs.store_id and stores.status = 'active'));

-- ── 14. Triggers stock atomique ──
create or replace function decrement_stock_on_order_item() returns trigger as $$
begin
  if NEW.product_id is not null then
    update store_products
      set stock_qty = stock_qty - NEW.qty,
          updated_at = now()
      where id = NEW.product_id and stock_unlimited = false;
    insert into store_stock_movements (product_id, movement_type, qty_delta, qty_before, qty_after, ref_order_id)
      select NEW.product_id, 'sale', -NEW.qty, sp.stock_qty + NEW.qty, sp.stock_qty, NEW.order_id
      from store_products sp where sp.id = NEW.product_id;
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_decrement_stock on store_order_items;
create trigger trg_decrement_stock after insert on store_order_items
  for each row execute function decrement_stock_on_order_item();

comment on table stores is 'Boutiques e-commerce — 1+ par compte selon tier. Spec : docs/STORE_PLATFORM_SPEC.md';
comment on table store_products is 'Catalogue produits — segment B2B/B2C/both, conditionnement flexible (unit/weight/volume).';
comment on table store_orders is 'Commandes Acheteurs. Statut workflow: pending→paid→fulfilled (ou refunded/cancelled).';
comment on table store_legal_docs is 'CGV/CGU/mentions/cookies par boutique, multi-langue, versionnées. OBLIGATOIRES pour activer la boutique.';
