-- FTG — Fill the Gap monthly quota (Premium 150 / Ultimate 250)
-- Séparé du système de crédits IA (user_credits_subscription) :
--   - Déclencheur = passage Feel the Gap -> Fill the Gap (videos/clients/store/recap/AI engine)
--   - 1 crédit = 1 opportunité traitée (ou 1 step Fill the Gap unitaire)
--   - Reset le 1er du mois 00:01 UTC (cron), rollover = 0

create table if not exists public.user_fillthegap_quota (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  plan         text not null default 'free' check (plan in ('free','starter','strategy','premium','ultimate','custom')),
  balance      int not null default 0 check (balance >= 0),
  monthly_grant int not null default 0,
  period_start timestamptz not null default date_trunc('month', now()),
  period_end   timestamptz not null default (date_trunc('month', now()) + interval '1 month' + interval '1 minute'),
  updated_at   timestamptz not null default now()
);

-- Transactions Fill the Gap (audit)
create table if not exists public.ftg_fillthegap_tx (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  action     text not null, -- 'fillthegap_video'|'fillthegap_clients'|'fillthegap_store'|'fillthegap_recap'|'fillthegap_ai'|'fillthegap_bp_bulk'
  qty        int not null check (qty > 0),
  ref_type   text,          -- 'opportunity' | 'product'
  ref_id     uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_fillthegap_tx_user_date on public.ftg_fillthegap_tx(user_id, created_at desc);

-- Mapping plan -> grant (single source of truth pour reset cron)
create or replace function public.fillthegap_monthly_grant(p_plan text)
returns int as $$
begin
  return case p_plan
    when 'premium'  then 150
    when 'ultimate' then 250
    else 0
  end;
end;
$$ language plpgsql immutable;

-- Atomic debit: décrémente balance, insert transaction, raise si insuffisant
create or replace function public.debit_fillthegap(
  p_user_id uuid,
  p_qty int,
  p_action text,
  p_ref_type text default null,
  p_ref_id uuid default null
) returns int as $$
declare
  v_balance int;
  v_new_balance int;
begin
  if p_qty <= 0 then return 0; end if;

  select balance into v_balance
  from public.user_fillthegap_quota
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'no_fillthegap_quota' using errcode = '23514';
  end if;

  if v_balance < p_qty then
    raise exception 'insufficient_fillthegap_credits' using errcode = '23514';
  end if;

  v_new_balance := v_balance - p_qty;

  update public.user_fillthegap_quota
  set balance = v_new_balance, updated_at = now()
  where user_id = p_user_id;

  insert into public.ftg_fillthegap_tx (user_id, action, qty, ref_type, ref_id)
  values (p_user_id, p_action, p_qty, p_ref_type, p_ref_id);

  return v_new_balance;
end;
$$ language plpgsql security definer;

-- Lecture balance + reset
create or replace function public.fillthegap_balance(p_user_id uuid)
returns table (balance int, monthly_grant int, plan text, period_end timestamptz) as $$
begin
  return query
  select q.balance, q.monthly_grant, q.plan, q.period_end
  from public.user_fillthegap_quota q
  where q.user_id = p_user_id
  union all
  select 0, 0, 'free'::text, null::timestamptz
  where not exists (select 1 from public.user_fillthegap_quota where user_id = p_user_id)
  limit 1;
end;
$$ language plpgsql stable security definer;

-- Reset global (appelé par cron 1er du mois 00:01 UTC)
create or replace function public.renew_fillthegap_quota_all()
returns int as $$
declare
  v_count int;
begin
  update public.user_fillthegap_quota q
  set balance       = public.fillthegap_monthly_grant(q.plan),
      monthly_grant = public.fillthegap_monthly_grant(q.plan),
      period_start  = date_trunc('month', now()),
      period_end    = date_trunc('month', now()) + interval '1 month' + interval '1 minute',
      updated_at    = now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer;

-- Upsert initial/upgrade/downgrade: aligne quota au plan courant (à appeler depuis Stripe webhook)
create or replace function public.sync_fillthegap_quota(p_user_id uuid, p_plan text)
returns void as $$
declare
  v_grant int := public.fillthegap_monthly_grant(p_plan);
begin
  insert into public.user_fillthegap_quota (user_id, plan, balance, monthly_grant)
  values (p_user_id, p_plan, v_grant, v_grant)
  on conflict (user_id) do update
    set plan = excluded.plan,
        monthly_grant = v_grant,
        -- sur upgrade: donne la diff, sur downgrade: ne descend pas si balance > nouveau grant
        balance = case
          when excluded.plan = user_fillthegap_quota.plan then user_fillthegap_quota.balance
          when v_grant > user_fillthegap_quota.monthly_grant then user_fillthegap_quota.balance + (v_grant - user_fillthegap_quota.monthly_grant)
          else least(user_fillthegap_quota.balance, v_grant)
        end,
        updated_at = now();
end;
$$ language plpgsql security definer;

-- Bootstrap: aligne les profils existants avec leur plan actuel (lecture depuis user_credits_subscription)
insert into public.user_fillthegap_quota (user_id, plan, balance, monthly_grant)
select s.user_id,
       s.plan,
       public.fillthegap_monthly_grant(s.plan),
       public.fillthegap_monthly_grant(s.plan)
from public.user_credits_subscription s
where s.plan in ('premium','ultimate')
on conflict (user_id) do nothing;

-- RLS
alter table public.user_fillthegap_quota enable row level security;
alter table public.ftg_fillthegap_tx enable row level security;

drop policy if exists ufq_owner on public.user_fillthegap_quota;
create policy ufq_owner on public.user_fillthegap_quota
  for select to authenticated using (user_id = auth.uid());

drop policy if exists fftx_owner on public.ftg_fillthegap_tx;
create policy fftx_owner on public.ftg_fillthegap_tx
  for select to authenticated using (user_id = auth.uid());
