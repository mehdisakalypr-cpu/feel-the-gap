-- Marketplace Escrow — Stripe Connect integration
-- Vague 1 #1 · 2026-04-18 : ajoute les colonnes pour piloter le cycle paiement/escrow/POD.
--
-- Flow :
-- 1. Producer onboarding → profiles.stripe_connect_account_id
-- 2. Match confirmed (producer_accept + buyer_accept) → buyer déclenche /api/marketplace/[id]/escrow/create
--    → crée un paymentIntent avec application_fee_amount = commission (2.5%), capture_method=manual,
--       transfer_data.destination = producer account
--    → escrow_status = 'pending_capture'
-- 3. Livraison + POD reçu → buyer valide /api/marketplace/[id]/escrow/release
--    → capture le PI (fonds transférés au producer, commission encaissée)
--    → escrow_status = 'released', pod_confirmed_at = now()
-- 4. Timeout/litige → refund possible → escrow_status = 'refunded'

-- Profiles : Stripe Connect pour producteurs (et acheteurs s'ils veulent recevoir des commissions)
alter table public.profiles
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_connect_charges_enabled boolean default false,
  add column if not exists stripe_connect_payouts_enabled boolean default false,
  add column if not exists stripe_connect_updated_at timestamptz;

create index if not exists idx_profiles_stripe_connect on public.profiles(stripe_connect_account_id) where stripe_connect_account_id is not null;

-- Marketplace matches : escrow fields
alter table public.marketplace_matches
  add column if not exists stripe_payment_intent_id text,
  add column if not exists escrow_status text default 'not_initiated' check (
    escrow_status in ('not_initiated', 'pending_capture', 'released', 'refunded', 'failed')
  ),
  add column if not exists escrow_initiated_at timestamptz,
  add column if not exists escrow_released_at timestamptz,
  add column if not exists pod_confirmed_at timestamptz,
  add column if not exists pod_notes text;

create index if not exists idx_matches_escrow_status on public.marketplace_matches(escrow_status) where escrow_status != 'not_initiated';
create unique index if not exists idx_matches_stripe_pi on public.marketplace_matches(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
