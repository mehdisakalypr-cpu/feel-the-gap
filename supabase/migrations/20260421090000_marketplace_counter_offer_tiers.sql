-- Marketplace matching v2 — counter-offer + tiered flat pricing (Shaka 2026-04-21)
--
-- Décision user 2026-04-21 : pricing hybride paliers fixes au lieu de 2.5% linéaire.
-- Anti-fraude (pas de sous-déclaration), scalable, transparent.

-- ── Extend status values ────────────────────────────────────────────────
alter table public.marketplace_matches
  drop constraint if exists marketplace_matches_status_check;

alter table public.marketplace_matches
  add constraint marketplace_matches_status_check
  check (status in (
    'proposed',            -- 🟠 orange clignotant : match généré, les 2 parties notifiées
    'counter_proposed',    -- 🔵 bleu : l'un des 2 a fait contre-proposition, attente validation autre
    'accepted_producer',   -- partiel : producer a validé
    'accepted_buyer',      -- partiel : buyer a validé
    'confirmed',           -- 🟢 vert : les 2 ont accepté, attente paiement commission
    'paid',                -- 🟢 vert + fee payé : identités révélées
    'rejected',            -- 🔴 rouge : l'un des 2 a refusé
    'expired'              -- timeout sans action
  ));

-- ── Counter-offer columns ───────────────────────────────────────────────
alter table public.marketplace_matches
  add column if not exists counter_price_eur_per_kg numeric,
  add column if not exists counter_quantity_kg numeric,
  add column if not exists counter_total_eur numeric,
  add column if not exists counter_by text check (counter_by in ('producer', 'buyer', null)),
  add column if not exists counter_at timestamptz,
  add column if not exists counter_message text,

  -- Anonymized pseudonyms (generated at match creation)
  add column if not exists buyer_pseudo text,
  add column if not exists seller_pseudo text,

  -- Decision tracking
  add column if not exists producer_decision text check (producer_decision in ('accept','refuse','counter',null)),
  add column if not exists producer_decision_at timestamptz,
  add column if not exists buyer_decision text check (buyer_decision in ('accept','refuse','counter',null)),
  add column if not exists buyer_decision_at timestamptz,

  -- Pricing tier (calculated on proposed_total_eur at confirmation)
  add column if not exists pricing_tier_label text,
  add column if not exists pricing_tier_fee_eur integer,  -- cents EUR pour éviter float

  -- Offer identity reveal (only after payment)
  add column if not exists identities_revealed_at timestamptz;

-- ── Countries pricing multiplier (PPP 0..1, baseline=1.0 pays développé) ──
alter table public.countries
  add column if not exists pricing_multiplier numeric default 1.0 check (pricing_multiplier >= 0.1 and pricing_multiplier <= 1.5);

comment on column public.countries.pricing_multiplier is
  'PPP-based purchasing power multiplier. 1.0 = baseline developed country (US/FR/DE/UK/JP). 0.25 = India, 0.35 = Senegal, 0.45 = Morocco, 0.75 = Portugal/Spain, 1.0+ = very high PPP (CH/NO).';

-- Seed common countries (sources: WB PPP conversion factor 2024 + Big Mac Index + Numbeo)
update public.countries set pricing_multiplier = 1.0 where id in (
  'USA','FRA','DEU','GBR','JPN','CAN','AUS','SGP','NLD','BEL','SWE','DNK','FIN','AUT','IRL','NZL'
);
update public.countries set pricing_multiplier = 1.15 where id in ('CHE','NOR','ISL','LUX');
update public.countries set pricing_multiplier = 0.90 where id in ('ITA','KOR','ISR','TWN');
update public.countries set pricing_multiplier = 0.75 where id in ('PRT','ESP','GRC','CZE','SVK','SVN','EST','LVA','LTU','HRV','POL','HUN','CHL','URY');
update public.countries set pricing_multiplier = 0.60 where id in ('MEX','ROU','BGR','TUR','RUS','ZAF','MYS','BRA','ARG','THA','CHN','SRB');
update public.countries set pricing_multiplier = 0.45 where id in ('MAR','TUN','DZA','JOR','PER','COL','PHL','IDN','VNM','UKR','KAZ');
update public.countries set pricing_multiplier = 0.35 where id in ('SEN','CIV','CMR','GHA','KEN','BGD','EGY','LKA','NGA','PAK');
update public.countries set pricing_multiplier = 0.25 where id in ('IND','NPL','ETH','TZA','UGA','MDG','RWA','BDI','MLI','BFA','BEN','TGO','GIN','HTI','AFG','MMR');

-- ── Pricing tier helpers (baseline 100% pays développé, puis ×PPP pays acheteur) ──
-- User decision 2026-04-21 : prix fixe par palier × multiplicateur pouvoir d'achat pays
create or replace function public.marketplace_tier_label(total_eur numeric)
returns text language sql immutable as $$
  select case
    when total_eur is null then '—'
    when total_eur < 10000 then 'Tier 1 (€0-10k)'
    when total_eur < 50000 then 'Tier 2 (€10k-50k)'
    when total_eur < 200000 then 'Tier 3 (€50k-200k)'
    when total_eur < 1000000 then 'Tier 4 (€200k-1M)'
    else 'Tier 5 (€1M+)'
  end;
$$;

-- Baseline fee (100% pays développé) en cents EUR
create or replace function public.marketplace_tier_fee_baseline_cents(total_eur numeric)
returns integer language sql immutable as $$
  select case
    when total_eur is null then 0
    when total_eur < 10000 then 14900       -- €149
    when total_eur < 50000 then 34900       -- €349
    when total_eur < 200000 then 74900      -- €749
    when total_eur < 1000000 then 149900    -- €1 499
    else 299900                             -- €2 999
  end;
$$;

-- Fee ajusté au pays acheteur via pricing_multiplier (countries.pricing_multiplier, 0..1)
create or replace function public.marketplace_tier_fee_adjusted_cents(total_eur numeric, country_iso text)
returns integer language sql stable as $$
  select round(
    public.marketplace_tier_fee_baseline_cents(total_eur) *
    coalesce((select pricing_multiplier from countries where id = country_iso), 1.0)
  )::integer;
$$;

-- ── Backfill for existing rows (baseline only, pas de country_iso dispo sans join) ─
update public.marketplace_matches m
set
  pricing_tier_label = public.marketplace_tier_label(m.proposed_total_eur),
  pricing_tier_fee_eur = public.marketplace_tier_fee_baseline_cents(m.proposed_total_eur)
where m.pricing_tier_label is null;

-- ── Index status for my-offers queries ──────────────────────────────────
create index if not exists idx_mm_status on public.marketplace_matches(status);
create index if not exists idx_mm_volume_status on public.marketplace_matches(volume_id, status);
create index if not exists idx_mm_demand_status on public.marketplace_matches(demand_id, status);

-- ── Marketplace subscriptions (dual model abo + pay-per-act) ────────────
create table if not exists public.marketplace_subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  tier                text not null check (tier in ('starter', 'growth', 'pro', 'unlimited')),
  status              text not null default 'active' check (status in ('active', 'past_due', 'canceled', 'paused')),
  matches_per_month   integer not null,
  matches_used_this_period integer default 0,
  period_start        timestamptz default now(),
  period_end          timestamptz,
  stripe_customer_id  text,
  stripe_subscription_id text,
  pricing_multiplier_at_start numeric,  -- gelé à la souscription (contrat loyalty)
  base_price_eur_cents integer not null,  -- baseline 100% dev
  adjusted_price_eur_cents integer not null,  -- après PPP
  canceled_at         timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_ms_user on public.marketplace_subscriptions(user_id);
create index if not exists idx_ms_status on public.marketplace_subscriptions(status);

-- Helper fonction : prix abonnement baseline (cents EUR)
create or replace function public.marketplace_subscription_baseline_cents(tier text)
returns integer language sql immutable as $$
  select case tier
    when 'starter'   then 9900     -- €99/mo
    when 'growth'    then 29900    -- €299/mo
    when 'pro'       then 74900    -- €749/mo
    when 'unlimited' then 149900   -- €1 499/mo
    else 0
  end;
$$;

create or replace function public.marketplace_subscription_quota(tier text)
returns integer language sql immutable as $$
  select case tier
    when 'starter'   then 3
    when 'growth'    then 10
    when 'pro'       then 25
    when 'unlimited' then 2147483647  -- effectively unlimited
    else 0
  end;
$$;

-- Bill decision helper : si user a un abo actif avec quota restant → abo,
-- sinon → pay-per-act
create or replace function public.marketplace_billing_mode(user_id uuid)
returns table(mode text, subscription_id uuid, quota_remaining integer)
language sql stable as $$
  select
    case
      when s.id is not null and s.status = 'active' and s.matches_used_this_period < s.matches_per_month
        then 'subscription'
      else 'pay_per_act'
    end as mode,
    s.id,
    greatest(0, coalesce(s.matches_per_month - s.matches_used_this_period, 0)) as quota_remaining
  from (select user_id as uid) q
  left join marketplace_subscriptions s
    on s.user_id = q.uid and s.status = 'active'
  order by s.created_at desc nulls last
  limit 1;
$$;

-- ── View my-offers (anonymized) ─────────────────────────────────────────
create or replace view public.v_marketplace_my_offers as
select
  m.id,
  m.status,
  m.match_score,
  m.proposed_quantity_kg,
  m.proposed_price_eur_per_kg,
  m.proposed_total_eur,
  m.counter_price_eur_per_kg,
  m.counter_quantity_kg,
  m.counter_total_eur,
  m.counter_by,
  m.counter_message,
  m.counter_at,
  m.producer_decision,
  m.buyer_decision,
  m.pricing_tier_label,
  m.pricing_tier_fee_eur,
  m.escrow_status,
  m.stripe_payment_intent_id,
  m.buyer_pseudo,
  m.seller_pseudo,
  m.created_at,
  m.accepted_at,
  m.confirmed_at,
  m.identities_revealed_at,
  -- Real identities NULL unless both parties accepted + fee paid
  case when m.identities_revealed_at is not null then v.producer_id else null end as producer_user_id_revealed,
  case when m.identities_revealed_at is not null then d.buyer_id else null end as buyer_user_id_revealed,
  -- Metadata for display (product name + country) — safe to show
  v.product_slug as volume_product,
  v.country_iso as volume_country,
  d.product_slug as demand_product,
  d.delivery_country_iso as demand_country
from marketplace_matches m
left join production_volumes v on v.id = m.volume_id
left join buyer_demands d on d.id = m.demand_id;

comment on view v_marketplace_my_offers is
  'Anonymized view for /marketplace/my-offers. Identities revealed only after mutual accept + fee paid. 4 colors: proposed=orange, counter=blue, rejected=red, confirmed/paid=green.';
