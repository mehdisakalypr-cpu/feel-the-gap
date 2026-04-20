-- © 2025-2026 Feel The Gap
-- Store fraud signals from Stripe Radar + Disputes

-- 1) fraud_status column on store_orders
alter table public.store_orders
  add column if not exists fraud_status text
  check (fraud_status in ('under_review', 'disputed', 'cleared', 'chargeback'));

create index if not exists idx_store_orders_fraud_status
  on public.store_orders(fraud_status)
  where fraud_status is not null;

-- 2) store_fraud_events — append-only audit of Radar + dispute webhooks
create table if not exists public.store_fraud_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text unique not null,
  event_type text not null,
  payment_intent_id text,
  charge_id text,
  reason text,
  amount_cents bigint,
  currency text,
  livemode boolean default false,
  raw jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_store_fraud_events_pi on public.store_fraud_events(payment_intent_id);
create index if not exists idx_store_fraud_events_type on public.store_fraud_events(event_type, created_at desc);

alter table public.store_fraud_events enable row level security;

-- Admins only (service role bypasses RLS; no client policy)
drop policy if exists "fraud_events_admin_only" on public.store_fraud_events;
create policy "fraud_events_admin_only" on public.store_fraud_events
  for select using (false);
