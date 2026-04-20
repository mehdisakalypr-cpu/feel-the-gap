-- 2026-04-20 — FTG Marketplace B2B P0 (RFQ broadcast + supplier badges + sanctions screening + chat)
-- Audit gap : seller_quote_requests = 1-to-1, faut RFQ multi-supplier broadcast (style Alibaba)
--             + trust badges supplier + sanctions screening (OFAC/EU/UN) + chat in-app temps réel.
--
-- Tables :
--   marketplace_rfq                — un buyer publie 1 RFQ, broadcast à N suppliers matching
--   marketplace_rfq_responses      — N suppliers répondent à 1 RFQ
--   marketplace_supplier_badges    — trust badges (KYB, IBAN, BV/SGS audit, transactions, années)
--   sanctions_lists_cache          — cache local des entités sanctionnées (OFAC SDN, EU, UN, UK)
--   marketplace_messages           — chat in-app buyer ⇄ supplier (Supabase Realtime)

-- ─────────────────────────────────────────────────────────────────────────────
-- marketplace_rfq — buyer publie une demande, broadcast
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.marketplace_rfq (
  id uuid primary key default gen_random_uuid(),
  buyer_user_id uuid not null references auth.users(id) on delete cascade,
  product_slug text not null,
  product_label text,
  qty_min numeric(14,3),
  qty_max numeric(14,3),
  qty_unit text not null default 'tonnes',
  target_price_eur_per_unit numeric(12,2),
  required_certifications text[] default '{}',
  delivery_country_iso text,
  delivery_deadline date,
  description text,
  status text not null default 'open' check (status in ('open','closing','closed','expired')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  broadcasted_to_count int not null default 0,
  responses_count int not null default 0,
  awarded_response_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_marketplace_rfq_buyer on public.marketplace_rfq(buyer_user_id, created_at desc);
create index if not exists idx_marketplace_rfq_open  on public.marketplace_rfq(product_slug) where status = 'open';
create index if not exists idx_marketplace_rfq_status on public.marketplace_rfq(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- marketplace_rfq_responses — supplier répond
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.marketplace_rfq_responses (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.marketplace_rfq(id) on delete cascade,
  supplier_user_id uuid not null references auth.users(id) on delete cascade,
  price_eur_per_unit numeric(12,2) not null check (price_eur_per_unit >= 0),
  qty_available numeric(14,3) not null check (qty_available > 0),
  delivery_eta_days int,
  notes text,
  status text not null default 'submitted' check (status in ('submitted','accepted','rejected','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rfq_id, supplier_user_id)
);

create index if not exists idx_rfq_responses_rfq on public.marketplace_rfq_responses(rfq_id, created_at desc);
create index if not exists idx_rfq_responses_supplier on public.marketplace_rfq_responses(supplier_user_id, created_at desc);

-- FK différée vers awarded_response_id
do $$ begin
  alter table public.marketplace_rfq
    add constraint marketplace_rfq_awarded_response_fk
    foreign key (awarded_response_id) references public.marketplace_rfq_responses(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- marketplace_supplier_badges — trust badges
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.marketplace_supplier_badges (
  id uuid primary key default gen_random_uuid(),
  supplier_user_id uuid not null references auth.users(id) on delete cascade,
  badge_type text not null check (badge_type in (
    'kyb_verified','iban_verified',
    'factory_audit_bv','factory_audit_sgs',
    'transactions_100plus','years_2plus'
  )),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  issuer text default 'ftg',
  proof_url text,
  metadata jsonb default '{}'::jsonb,
  unique (supplier_user_id, badge_type)
);

create index if not exists idx_supplier_badges_user on public.marketplace_supplier_badges(supplier_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- sanctions_lists_cache — cache local des listes consolidées
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.sanctions_lists_cache (
  id uuid primary key default gen_random_uuid(),
  list_source text not null check (list_source in ('ofac_sdn','eu_consolidated','un_security','uk_sanctions')),
  entity_name text not null,
  entity_name_normalized text generated always as (lower(entity_name)) stored,
  entity_type text,
  country text,
  list_date date,
  raw_data jsonb,
  fetched_at timestamptz not null default now()
);

create index if not exists idx_sanctions_name on public.sanctions_lists_cache (entity_name_normalized);
create index if not exists idx_sanctions_source on public.sanctions_lists_cache (list_source);

-- ─────────────────────────────────────────────────────────────────────────────
-- marketplace_messages — chat in-app temps réel
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.marketplace_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  rfq_id uuid references public.marketplace_rfq(id) on delete set null,
  body text not null check (length(body) > 0 and length(body) <= 8000),
  attachments jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_msg_thread on public.marketplace_messages(thread_id, created_at);
create index if not exists idx_msg_recipient_unread on public.marketplace_messages(recipient_user_id) where read_at is null;
create index if not exists idx_msg_sender on public.marketplace_messages(sender_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger updated_at
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.touch_marketplace_b2b_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_rfq_touch on public.marketplace_rfq;
create trigger trg_rfq_touch before update on public.marketplace_rfq
  for each row execute function public.touch_marketplace_b2b_updated_at();

drop trigger if exists trg_rfq_resp_touch on public.marketplace_rfq_responses;
create trigger trg_rfq_resp_touch before update on public.marketplace_rfq_responses
  for each row execute function public.touch_marketplace_b2b_updated_at();

-- Trigger : auto-increment responses_count quand un nouveau response arrive
create or replace function public.bump_rfq_responses_count()
returns trigger language plpgsql as $$
begin
  update public.marketplace_rfq
     set responses_count = responses_count + 1,
         updated_at = now()
   where id = new.rfq_id;
  return new;
end $$;

drop trigger if exists trg_rfq_resp_bump on public.marketplace_rfq_responses;
create trigger trg_rfq_resp_bump after insert on public.marketplace_rfq_responses
  for each row execute function public.bump_rfq_responses_count();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.marketplace_rfq enable row level security;
alter table public.marketplace_rfq_responses enable row level security;
alter table public.marketplace_supplier_badges enable row level security;
alter table public.sanctions_lists_cache enable row level security;
alter table public.marketplace_messages enable row level security;

-- RFQ : buyer voit/crée/modifie le sien, supplier voit ceux ouverts (broadcast)
drop policy if exists rfq_buyer_owner on public.marketplace_rfq;
create policy rfq_buyer_owner on public.marketplace_rfq
  for all to authenticated
  using (auth.uid() = buyer_user_id)
  with check (auth.uid() = buyer_user_id);

drop policy if exists rfq_open_read on public.marketplace_rfq;
create policy rfq_open_read on public.marketplace_rfq
  for select to authenticated
  using (status = 'open');

-- RFQ responses : supplier crée/voit/modifie ses propres réponses,
-- buyer voit toutes les réponses sur ses RFQ
drop policy if exists rfq_resp_supplier_rw on public.marketplace_rfq_responses;
create policy rfq_resp_supplier_rw on public.marketplace_rfq_responses
  for all to authenticated
  using (auth.uid() = supplier_user_id)
  with check (auth.uid() = supplier_user_id);

drop policy if exists rfq_resp_buyer_read on public.marketplace_rfq_responses;
create policy rfq_resp_buyer_read on public.marketplace_rfq_responses
  for select to authenticated
  using (
    rfq_id in (select id from public.marketplace_rfq where buyer_user_id = auth.uid())
  );

drop policy if exists rfq_resp_buyer_update on public.marketplace_rfq_responses;
create policy rfq_resp_buyer_update on public.marketplace_rfq_responses
  for update to authenticated
  using (
    rfq_id in (select id from public.marketplace_rfq where buyer_user_id = auth.uid())
  )
  with check (true);

-- Badges : tous les authenticated peuvent lire (transparence trust),
-- seul service_role peut écrire
drop policy if exists badges_public_read on public.marketplace_supplier_badges;
create policy badges_public_read on public.marketplace_supplier_badges
  for select to authenticated
  using (true);

-- Sanctions cache : lecture authentifiée pour appels backend, écriture service_role
drop policy if exists sanctions_authread on public.sanctions_lists_cache;
create policy sanctions_authread on public.sanctions_lists_cache
  for select to authenticated
  using (true);

-- Messages : sender et recipient seulement
drop policy if exists msg_participants_select on public.marketplace_messages;
create policy msg_participants_select on public.marketplace_messages
  for select to authenticated
  using (auth.uid() = sender_user_id or auth.uid() = recipient_user_id);

drop policy if exists msg_sender_insert on public.marketplace_messages;
create policy msg_sender_insert on public.marketplace_messages
  for insert to authenticated
  with check (auth.uid() = sender_user_id and sender_user_id <> recipient_user_id);

drop policy if exists msg_recipient_update on public.marketplace_messages;
create policy msg_recipient_update on public.marketplace_messages
  for update to authenticated
  using (auth.uid() = recipient_user_id)
  with check (auth.uid() = recipient_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime : activer la publication des messages pour Supabase Realtime
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'marketplace_messages'
  ) then
    alter publication supabase_realtime add table public.marketplace_messages;
  end if;
exception when others then null;
end $$;
