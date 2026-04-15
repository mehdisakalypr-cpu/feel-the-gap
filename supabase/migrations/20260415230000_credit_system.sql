-- FTG — Credit quota system
-- 3 tables: subscription credits (reset monthly), topup credits (12mo validity),
-- transaction log. Atomic debit function + RLS policies.

-- Subscription credits (reset au renouvellement)
create table if not exists public.user_credits_subscription (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  plan          text not null default 'free' check (plan in ('free','starter','pro','business','enterprise','custom')),
  balance       int not null default 5 check (balance >= 0),
  period_start  timestamptz not null default now(),
  period_end    timestamptz not null default (now() + interval '1 month'),
  monthly_grant int not null default 5,           -- crédits alloués par renouvellement
  updated_at    timestamptz not null default now()
);

-- Top-up packs (valables 12 mois, survivent aux renouvellements)
create table if not exists public.user_credits_topup (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  balance       int not null check (balance >= 0),
  initial_qty   int not null,
  granted_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '12 months'),
  stripe_payment_id text,
  pack_size     int not null,                     -- 10, 30, 50, 100, 300, 1000
  pack_price_eur numeric(10,2) not null
);

create index if not exists idx_credits_topup_user_active on public.user_credits_topup(user_id, expires_at)
  where balance > 0;

-- Transactions (audit + anti-abuse)
create table if not exists public.ftg_credit_tx (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  action        text not null,                    -- 'opportunity_view', 'bp_generate', 'export_buyer', 'export_exporter', 'outreach', 'custom_study', 'deal_room_match'
  cost          int not null,
  source        text not null check (source in ('subscription','topup')),
  source_ref    uuid,                             -- id du topup pack si source='topup'
  ref_type      text,                             -- 'opportunity' | 'buyer' | 'exporter' | ...
  ref_id        uuid,
  ip            text,
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_ftg_credit_tx_user_date on public.ftg_credit_tx(user_id, created_at desc);
create index if not exists idx_ftg_credit_tx_action on public.ftg_credit_tx(action, created_at desc);

-- ═══════════════════════════════════════════════════════════════════
-- Atomic debit function: consomme crédits subscription d'abord, puis topup FIFO.
-- Retourne false si solde insuffisant, true si débit réussi.
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.debit_credits(
  p_user_id uuid,
  p_cost int,
  p_action text,
  p_ref_type text default null,
  p_ref_id uuid default null,
  p_ip text default null,
  p_user_agent text default null
) returns boolean as $$
declare
  v_sub_balance int;
  v_remaining int := p_cost;
  v_topup_row record;
  v_deducted int;
begin
  if p_cost <= 0 then return true; end if;

  -- Lock subscription row
  select balance into v_sub_balance
  from public.user_credits_subscription
  where user_id = p_user_id
  for update;

  if not found then
    -- Auto-provision free plan for new users
    insert into public.user_credits_subscription (user_id) values (p_user_id);
    v_sub_balance := 5;
  end if;

  -- 1. Tire d'abord sur subscription (expire)
  if v_sub_balance >= v_remaining then
    update public.user_credits_subscription
    set balance = balance - v_remaining, updated_at = now()
    where user_id = p_user_id;
    insert into public.ftg_credit_tx (user_id, action, cost, source, ref_type, ref_id, ip, user_agent)
    values (p_user_id, p_action, v_remaining, 'subscription', p_ref_type, p_ref_id, p_ip, p_user_agent);
    return true;
  end if;

  -- Consomme tout le sub puis bascule sur topup
  v_deducted := v_sub_balance;
  if v_deducted > 0 then
    update public.user_credits_subscription
    set balance = 0, updated_at = now()
    where user_id = p_user_id;
    insert into public.ftg_credit_tx (user_id, action, cost, source, ref_type, ref_id, ip, user_agent)
    values (p_user_id, p_action, v_deducted, 'subscription', p_ref_type, p_ref_id, p_ip, p_user_agent);
    v_remaining := v_remaining - v_deducted;
  end if;

  -- 2. FIFO sur topup packs actifs (oldest first, skip expired)
  for v_topup_row in
    select id, balance from public.user_credits_topup
    where user_id = p_user_id and balance > 0 and expires_at > now()
    order by granted_at asc
    for update
  loop
    if v_remaining <= 0 then exit; end if;
    v_deducted := least(v_topup_row.balance, v_remaining);
    update public.user_credits_topup set balance = balance - v_deducted where id = v_topup_row.id;
    insert into public.ftg_credit_tx (user_id, action, cost, source, source_ref, ref_type, ref_id, ip, user_agent)
    values (p_user_id, p_action, v_deducted, 'topup', v_topup_row.id, p_ref_type, p_ref_id, p_ip, p_user_agent);
    v_remaining := v_remaining - v_deducted;
  end loop;

  if v_remaining > 0 then
    -- Rollback: pas assez de crédits
    raise exception 'insufficient_credits' using errcode = '23514';
  end if;

  return true;
end;
$$ language plpgsql security definer;

-- Helper: solde total (subscription + topup actifs)
create or replace function public.credits_balance(p_user_id uuid)
returns table (subscription int, topup int, total int, plan text, period_end timestamptz) as $$
begin
  return query
  select
    coalesce(s.balance, 0) as subscription,
    coalesce((select sum(balance)::int from public.user_credits_topup where user_id = p_user_id and balance > 0 and expires_at > now()), 0) as topup,
    coalesce(s.balance, 0) + coalesce((select sum(balance)::int from public.user_credits_topup where user_id = p_user_id and balance > 0 and expires_at > now()), 0) as total,
    coalesce(s.plan, 'free') as plan,
    s.period_end
  from public.user_credits_subscription s
  where s.user_id = p_user_id
  union all
  select 0, 0, 0, 'free'::text, null::timestamptz
  where not exists (select 1 from public.user_credits_subscription where user_id = p_user_id)
  limit 1;
end;
$$ language plpgsql stable security definer;

-- Helper: renouveler subscription credits (à appeler via cron ou Stripe webhook)
create or replace function public.renew_subscription_credits(p_user_id uuid)
returns void as $$
declare
  v_sub record;
begin
  select * into v_sub from public.user_credits_subscription where user_id = p_user_id for update;
  if not found then return; end if;
  if v_sub.period_end > now() then return; end if;   -- not yet due
  update public.user_credits_subscription
  set balance = v_sub.monthly_grant,
      period_start = now(),
      period_end = now() + interval '1 month',
      updated_at = now()
  where user_id = p_user_id;
end;
$$ language plpgsql security definer;

-- RLS
alter table public.user_credits_subscription enable row level security;
alter table public.user_credits_topup enable row level security;
alter table public.ftg_credit_tx enable row level security;

drop policy if exists ucs_owner on public.user_credits_subscription;
create policy ucs_owner on public.user_credits_subscription
  for select to authenticated using (user_id = auth.uid());

drop policy if exists uct_owner on public.user_credits_topup;
create policy uct_owner on public.user_credits_topup
  for select to authenticated using (user_id = auth.uid());

drop policy if exists ctx_owner on public.ftg_credit_tx;
create policy ctx_owner on public.ftg_credit_tx
  for select to authenticated using (user_id = auth.uid());
