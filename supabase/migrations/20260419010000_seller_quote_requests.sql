-- FTG — Entrepreneur seller quote requests table + increment RPC
-- Stabilise /api/seller/quote-request (insert + RPC étaient best-effort sans backing table).

create table if not exists public.seller_quote_requests (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.seller_products(id) on delete cascade,
  seller_id       uuid not null references auth.users(id) on delete cascade,
  buyer_id        uuid references auth.users(id) on delete set null,
  buyer_email     text not null,
  buyer_company   text not null,
  buyer_country   text,
  quantity        numeric(12,2),
  incoterm        text check (incoterm in ('EXW','FCA','CPT','CIP','DAP','DPU','DDP','FAS','FOB','CFR','CIF')),
  destination     text,
  message         text,
  status          text not null default 'new' check (status in ('new','viewed','quoted','accepted','declined','expired')),
  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Idempotence : si la table existait déjà (créée à la volée par l'API), ajoute les colonnes manquantes
alter table public.seller_quote_requests
  add column if not exists buyer_id   uuid references auth.users(id) on delete set null,
  add column if not exists metadata   jsonb default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_seller_quote_requests_seller on public.seller_quote_requests(seller_id, created_at desc);
create index if not exists idx_seller_quote_requests_product on public.seller_quote_requests(product_id);
create index if not exists idx_seller_quote_requests_buyer_email on public.seller_quote_requests(buyer_email);
create index if not exists idx_seller_quote_requests_status on public.seller_quote_requests(status) where status in ('new','viewed');

create or replace function public.touch_seller_quote_requests_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_seller_quote_requests_updated on public.seller_quote_requests;
create trigger trg_seller_quote_requests_updated before update on public.seller_quote_requests
  for each row execute function public.touch_seller_quote_requests_updated_at();

-- RPC idempotente pour incrémenter le compteur produit sans race condition
create or replace function public.increment_quote_request(p_product_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.seller_products
     set quotes_requested_count = quotes_requested_count + 1,
         updated_at = now()
   where id = p_product_id;
$$;

revoke all on function public.increment_quote_request(uuid) from public;
grant execute on function public.increment_quote_request(uuid) to anon, authenticated, service_role;

-- RLS
alter table public.seller_quote_requests enable row level security;

drop policy if exists seller_quote_requests_seller_read on public.seller_quote_requests;
create policy seller_quote_requests_seller_read on public.seller_quote_requests
  for select to authenticated using (seller_id = auth.uid());

drop policy if exists seller_quote_requests_seller_update on public.seller_quote_requests;
create policy seller_quote_requests_seller_update on public.seller_quote_requests
  for update to authenticated using (seller_id = auth.uid()) with check (seller_id = auth.uid());

drop policy if exists seller_quote_requests_buyer_read on public.seller_quote_requests;
create policy seller_quote_requests_buyer_read on public.seller_quote_requests
  for select to authenticated using (
    buyer_id = auth.uid()
    or buyer_email = (auth.jwt() ->> 'email')
  );
