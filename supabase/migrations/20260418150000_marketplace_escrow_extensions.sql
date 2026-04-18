-- Marketplace Escrow extensions — Vague 1 #1b · 2026-04-18
-- (1) Ajoute stripe_connect_details_submitted sur profiles (signalé par webhook account.updated).
-- (2) Étend escrow_status pour inclure 'canceled' (buyer annule avant capture).

alter table public.profiles
  add column if not exists stripe_connect_details_submitted boolean default false;

-- Drop + recreate check constraint (PG ne supporte pas ALTER CONSTRAINT pour CHECK)
alter table public.marketplace_matches
  drop constraint if exists marketplace_matches_escrow_status_check;

alter table public.marketplace_matches
  add constraint marketplace_matches_escrow_status_check check (
    escrow_status in ('not_initiated', 'pending_capture', 'released', 'refunded', 'failed', 'canceled')
  );
