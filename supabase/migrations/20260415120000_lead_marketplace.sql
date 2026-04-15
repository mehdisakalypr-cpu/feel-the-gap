-- Feel The Gap — Lead Marketplace B2B
-- Vente one-shot de packs de leads (local_buyers, exporters, investors, entrepreneurs)
-- Stripe mode=payment + CSV signed URL + watermark anti-revente

-- ═══════════════════════════════════════════════════════════
-- 1. lead_packs — catalogue public (listes mises en vente)
-- ═══════════════════════════════════════════════════════════
create table if not exists lead_packs (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  title             text not null,
  subtitle          text,
  description       text,
  -- Cible données
  source_table      text not null check (source_table in ('local_buyers','exporters_directory','investors_directory','entrepreneurs_directory')),
  filters           jsonb not null default '{}'::jsonb,    -- { country_iso, sectors, product_slugs, verified, ... }
  -- Commercial
  target_count      int not null,                           -- taille pack promise (50/500/5000)
  price_cents       int not null,                           -- en centimes EUR
  currency          text not null default 'EUR',
  tier              text not null default 'S' check (tier in ('S','M','L','XL')),
  -- Métadonnées marketing
  country_iso       text,
  sector            text,
  tags              text[] not null default '{}',
  hero_emoji        text default '📇',
  verified_only     boolean default false,
  -- État
  is_active         boolean default true,
  is_featured       boolean default false,
  sold_count        int default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_lead_packs_active on lead_packs(is_active) where is_active = true;
create index if not exists idx_lead_packs_country on lead_packs(country_iso);
create index if not exists idx_lead_packs_sector on lead_packs(sector);
create index if not exists idx_lead_packs_tier on lead_packs(tier);

-- ═══════════════════════════════════════════════════════════
-- 2. lead_purchases — achats utilisateurs (one-shot Stripe)
-- ═══════════════════════════════════════════════════════════
create table if not exists lead_purchases (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users(id) on delete set null,
  user_email            text,
  pack_id               uuid references lead_packs(id) on delete set null,
  pack_slug             text,
  pack_title            text,
  -- Stripe
  stripe_session_id     text unique,
  stripe_payment_intent text,
  amount_cents          int,
  currency              text default 'EUR',
  -- Fulfillment
  status                text not null default 'pending'
                        check (status in ('pending','paid','fulfilled','failed','refunded','expired')),
  rows_count            int,
  csv_storage_path      text,             -- chemin interne Supabase Storage
  csv_generated_at      timestamptz,
  csv_expires_at        timestamptz,
  -- Anti-abuse
  download_count        int default 0,
  max_downloads         int default 3,
  last_download_at      timestamptz,
  watermark_hash        text,             -- hash8(user_id||purchase_id) pour ligne wm dans CSV
  -- RGPD
  gdpr_acknowledged     boolean default false,
  -- Notes & metadata
  filters_snapshot      jsonb,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_lead_purchases_user on lead_purchases(user_id);
create index if not exists idx_lead_purchases_status on lead_purchases(status);
create index if not exists idx_lead_purchases_session on lead_purchases(stripe_session_id);
create index if not exists idx_lead_purchases_pack on lead_purchases(pack_id);

-- ═══════════════════════════════════════════════════════════
-- 3. lead_pack_rows — snapshot lignes vendues (audit & anti-revente)
-- ═══════════════════════════════════════════════════════════
create table if not exists lead_pack_rows (
  id            uuid primary key default gen_random_uuid(),
  purchase_id   uuid not null references lead_purchases(id) on delete cascade,
  source_table  text not null,
  source_row_id uuid not null,
  -- pour tracer revente éventuelle
  row_fingerprint text,                   -- hash du (name||email||phone) au moment vente
  delivered_at  timestamptz not null default now()
);
create index if not exists idx_lead_pack_rows_purchase on lead_pack_rows(purchase_id);
create index if not exists idx_lead_pack_rows_source on lead_pack_rows(source_table, source_row_id);

-- ═══════════════════════════════════════════════════════════
-- Triggers updated_at
-- ═══════════════════════════════════════════════════════════
drop trigger if exists touch_lead_packs on lead_packs;
create trigger touch_lead_packs before update on lead_packs
for each row execute function _touch_updated_at();

drop trigger if exists touch_lead_purchases on lead_purchases;
create trigger touch_lead_purchases before update on lead_purchases
for each row execute function _touch_updated_at();

-- ═══════════════════════════════════════════════════════════
-- RGPD B2B — flag sur directories (legitimate_interest_b2b par défaut)
-- ═══════════════════════════════════════════════════════════
alter table local_buyers add column if not exists gdpr_consent_b2b text default 'legitimate_interest_b2b';
alter table exporters_directory add column if not exists gdpr_consent_b2b text default 'legitimate_interest_b2b';
alter table investors_directory add column if not exists gdpr_consent_b2b text default 'legitimate_interest_b2b';
alter table entrepreneurs_directory add column if not exists gdpr_consent_b2b text default 'legitimate_interest_b2b';

-- ═══════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════
alter table lead_packs enable row level security;
alter table lead_purchases enable row level security;
alter table lead_pack_rows enable row level security;

-- Catalogue public : tout le monde peut lire les packs actifs
drop policy if exists "public_read_active_packs" on lead_packs;
create policy "public_read_active_packs" on lead_packs for select
using (is_active = true);

-- Admin : tout
drop policy if exists "admin_all_packs" on lead_packs;
create policy "admin_all_packs" on lead_packs for all
using (exists (select 1 from profiles p where p.id = auth.uid() and (p.is_admin or p.is_delegate_admin)))
with check (exists (select 1 from profiles p where p.id = auth.uid() and (p.is_admin or p.is_delegate_admin)));

-- Achats : user lit les siens, admin tout
drop policy if exists "user_read_own_purchases" on lead_purchases;
create policy "user_read_own_purchases" on lead_purchases for select
using (auth.uid() = user_id or exists (select 1 from profiles p where p.id = auth.uid() and (p.is_admin or p.is_delegate_admin)));

drop policy if exists "admin_write_purchases" on lead_purchases;
create policy "admin_write_purchases" on lead_purchases for all
using (exists (select 1 from profiles p where p.id = auth.uid() and (p.is_admin or p.is_delegate_admin)))
with check (exists (select 1 from profiles p where p.id = auth.uid() and (p.is_admin or p.is_delegate_admin)));

-- pack rows : admin seul (audit)
drop policy if exists "admin_all_pack_rows" on lead_pack_rows;
create policy "admin_all_pack_rows" on lead_pack_rows for all
using (exists (select 1 from profiles p where p.id = auth.uid() and (p.is_admin or p.is_delegate_admin)))
with check (exists (select 1 from profiles p where p.id = auth.uid() and (p.is_admin or p.is_delegate_admin)));
