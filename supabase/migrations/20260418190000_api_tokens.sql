-- API platform — Vague 3 #7 · 2026-04-18
-- 4 tiers : starter / pro / enterprise / sovereign
-- Token hashé (SHA-256), préfixe visible pour identification (ftg_live_XXXX)

create table if not exists public.api_tokens (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  name            text not null,                                  -- libellé donné par le client
  token_prefix    text not null,                                  -- 12 premiers chars visibles
  token_hash      text not null unique,                           -- sha-256 hex
  tier            text not null check (tier in ('starter','pro','enterprise','sovereign')),
  rate_limit_per_min int not null default 30,
  rate_limit_per_day int not null default 10000,
  permissions     text[] not null default '{opportunities:read}', -- scopes
  last_used_at    timestamptz,
  usage_total     bigint not null default 0,
  revoked_at      timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_api_tokens_owner on public.api_tokens(owner_id);
create index if not exists idx_api_tokens_hash  on public.api_tokens(token_hash) where revoked_at is null;

-- Journal d'appels (pour monitoring + facturation dépassements)
create table if not exists public.api_calls_log (
  id          uuid primary key default gen_random_uuid(),
  token_id    uuid references public.api_tokens(id) on delete set null,
  path        text not null,
  method      text not null,
  status      int not null,
  latency_ms  int,
  ip          text,
  called_at   timestamptz not null default now()
);

create index if not exists idx_api_calls_log_token on public.api_calls_log(token_id, called_at desc);
create index if not exists idx_api_calls_log_day on public.api_calls_log(called_at desc);

-- RLS : propriétaire voit uniquement ses tokens et ses logs
alter table public.api_tokens enable row level security;
alter table public.api_calls_log enable row level security;

drop policy if exists api_tokens_owner on public.api_tokens;
create policy api_tokens_owner on public.api_tokens
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists api_calls_log_owner on public.api_calls_log;
create policy api_calls_log_owner on public.api_calls_log
  for select to authenticated
  using (token_id in (select id from public.api_tokens where owner_id = auth.uid()));

-- RPC atomique pour incrémenter usage_total + last_used_at (best-effort)
create or replace function public.increment_api_token_usage(p_token_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.api_tokens
  set usage_total = usage_total + 1,
      last_used_at = now(),
      updated_at = now()
  where id = p_token_id;
$$;

grant execute on function public.increment_api_token_usage(uuid) to service_role;
