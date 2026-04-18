-- API Platform webhooks — Vague 3 #7 extension · 2026-04-18
-- Annoncés dans tier Pro : "Webhooks new_opportunity"

create table if not exists public.api_webhooks (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  token_id        uuid references public.api_tokens(id) on delete set null,
  name            text not null,
  url             text not null check (url ~* '^https?://'),
  events          text[] not null default '{opportunity.created}',
  secret          text not null,                          -- 40+ chars random, utilisé pour HMAC sha-256
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_count   int not null default 0
);

create index if not exists idx_api_webhooks_owner on public.api_webhooks(owner_id);
create index if not exists idx_api_webhooks_active on public.api_webhooks(active) where active;

-- Journal de livraisons (audit + retry logic)
create table if not exists public.api_webhook_deliveries (
  id             uuid primary key default gen_random_uuid(),
  webhook_id     uuid not null references public.api_webhooks(id) on delete cascade,
  event          text not null,
  payload        jsonb not null,
  status         int,
  response_body  text,
  attempted_at   timestamptz not null default now(),
  delivered      boolean not null default false
);

create index if not exists idx_api_webhook_deliveries_webhook on public.api_webhook_deliveries(webhook_id, attempted_at desc);

alter table public.api_webhooks enable row level security;
alter table public.api_webhook_deliveries enable row level security;

drop policy if exists api_webhooks_owner on public.api_webhooks;
create policy api_webhooks_owner on public.api_webhooks
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists api_webhook_deliveries_owner on public.api_webhook_deliveries;
create policy api_webhook_deliveries_owner on public.api_webhook_deliveries
  for select to authenticated
  using (webhook_id in (select id from public.api_webhooks where owner_id = auth.uid()));
