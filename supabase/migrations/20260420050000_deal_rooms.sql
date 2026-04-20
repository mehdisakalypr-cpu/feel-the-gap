-- © 2025-2026 Feel The Gap — Deal Rooms
-- Mini-site e-commerce pré-rempli sous notre domaine, monté depuis un match/opportunity.
-- SEO mutualisé sous feel-the-gap.com/deal/[slug]. Upsell OFA standalone en phase 2.

create table if not exists public.deal_rooms (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  seller_id     uuid,                                    -- auth.users : propriétaire deal room (peut être null pour draft serveur)
  match_id     uuid references public.marketplace_matches(id) on delete set null,
  opportunity_id text,                                   -- slug opp FTG d'où vient la deal room
  title         text not null,
  summary       text,                                    -- pitch 2-3 phrases
  product_slug  text,                                    -- référence catalogue FTG
  product_label text,
  country_iso   text,
  archetype     text,                                    -- 'farmer' | 'trader' | 'transformer' | 'distributor' | …
  hero_image_url text,
  gallery       jsonb default '[]'::jsonb,               -- [{url, alt}, …]
  price_range   jsonb,                                   -- {min, max, currency, unit}
  moq           text,                                    -- min order quantity (texte libre)
  lead_time_days int,
  incoterms     text[],                                  -- ex. ['FOB','CIF']
  certifications text[],                                 -- ex. ['Bio','Fairtrade','ISO']
  cta_whatsapp  text,
  cta_email     text,
  cta_phone     text,
  cta_form      boolean not null default true,
  seo           jsonb,                                   -- {title, description, og_image}
  status        text not null default 'draft'
    check (status in ('draft','published','paused','migrated_to_standalone','archived')),
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_deal_rooms_seller on public.deal_rooms(seller_id);
create index if not exists idx_deal_rooms_status on public.deal_rooms(status, published_at desc nulls last);
create index if not exists idx_deal_rooms_country on public.deal_rooms(country_iso, status);

-- Leads captured from deal room public page (form + CTA clicks)
create table if not exists public.deal_room_leads (
  id             uuid primary key default gen_random_uuid(),
  deal_room_id   uuid not null references public.deal_rooms(id) on delete cascade,
  channel        text not null check (channel in ('form','whatsapp','email','phone','other')),
  buyer_name     text,
  buyer_email    text,
  buyer_phone    text,
  buyer_country  text,
  company        text,
  message        text,
  qty_requested  text,
  ip_hash        text,
  user_agent     text,
  status         text not null default 'new'
    check (status in ('new','contacted','qualified','closed_won','closed_lost','spam')),
  notified_seller_at timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists idx_deal_room_leads_room on public.deal_room_leads(deal_room_id, created_at desc);
create index if not exists idx_deal_room_leads_status on public.deal_room_leads(status) where status = 'new';

-- RLS
alter table public.deal_rooms enable row level security;
alter table public.deal_room_leads enable row level security;

-- Public can read published deal rooms
drop policy if exists "deal_rooms_public_read" on public.deal_rooms;
create policy "deal_rooms_public_read" on public.deal_rooms
  for select using (status = 'published');

-- Seller manages their own
drop policy if exists "deal_rooms_seller_all" on public.deal_rooms;
create policy "deal_rooms_seller_all" on public.deal_rooms
  for all using (seller_id = auth.uid()) with check (seller_id = auth.uid());

-- Leads: seller reads their leads
drop policy if exists "deal_room_leads_seller_read" on public.deal_room_leads;
create policy "deal_room_leads_seller_read" on public.deal_room_leads
  for select using (
    exists (
      select 1 from public.deal_rooms r
      where r.id = deal_room_leads.deal_room_id
      and r.seller_id = auth.uid()
    )
  );

-- Leads: public write (anti-spam via IP hash + rate-limit en code)
drop policy if exists "deal_room_leads_public_insert" on public.deal_room_leads;
create policy "deal_room_leads_public_insert" on public.deal_room_leads
  for insert with check (true);

comment on table public.deal_rooms is 'FTG Deal Room — mini-site e-commerce mutualisé sous feel-the-gap.com/deal/[slug]';
comment on table public.deal_room_leads is 'Leads capturés depuis deal room publique, routés vers seller_id';
