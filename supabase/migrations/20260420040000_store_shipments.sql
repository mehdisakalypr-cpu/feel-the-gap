-- © 2025-2026 Feel The Gap — Shippo shipments

-- 1) origin address per store (source of parcel)
alter table public.stores
  add column if not exists shipping_origin jsonb;

-- 2) shipment rows linked to paid orders
create table if not exists public.store_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  carrier text,
  service_code text,
  tracking_number text,
  tracking_url text,
  label_url text,
  cost_cents int,
  currency text,
  shippo_rate_id text,
  shippo_shipment_id text,
  shippo_transaction_id text,
  status text not null default 'pending'
    check (status in ('pending', 'labeled', 'shipped', 'delivered', 'failed', 'returned')),
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  labeled_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz
);

create unique index if not exists uniq_store_shipments_order on public.store_shipments(order_id);
create index if not exists idx_store_shipments_store on public.store_shipments(store_id, status);
create index if not exists idx_store_shipments_tracking on public.store_shipments(tracking_number) where tracking_number is not null;

alter table public.store_shipments enable row level security;

drop policy if exists "shipments_owner" on public.store_shipments;
create policy "shipments_owner" on public.store_shipments
  for all using (
    exists (select 1 from public.stores s where s.id = store_shipments.store_id and s.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.stores s where s.id = store_shipments.store_id and s.owner_id = auth.uid())
  );

-- Buyer can read their own shipments via order
drop policy if exists "shipments_buyer_read" on public.store_shipments;
create policy "shipments_buyer_read" on public.store_shipments
  for select using (
    exists (
      select 1 from public.store_orders o
      where o.id = store_shipments.order_id
      and o.buyer_user_id = auth.uid()
    )
  );

-- 3) store_orders.shipment_id pointer (current/last shipment)
alter table public.store_orders
  add column if not exists shipment_id uuid references public.store_shipments(id) on delete set null;
