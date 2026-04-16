-- Referral Users viral loop
-- Each user gets a U-XXXXXX code. Referral earns 1 free month when referee converts to paid,
-- plus 20% recurring share on each paid invoice, credited via Stripe balance.

create table if not exists user_referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  unique_code text unique not null,  -- format U-XXXXXX
  clicks int default 0,
  signups int default 0,
  conversions int default 0,
  bonus_months_earned int default 0,
  recurring_credit_cents int default 0,
  created_at timestamptz default now()
);

create table if not exists user_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id),
  referee_id uuid unique not null references auth.users(id),
  code text not null,
  signup_ip inet,
  device_fp text,
  clicked_at timestamptz,
  signed_up_at timestamptz default now(),
  first_paid_at timestamptz,
  status text default 'signed_up' check (status in ('clicked','signed_up','converted','fraud')),
  stripe_subscription_id text,
  monthly_share_cents int default 0,
  created_at timestamptz default now(),
  check (referrer_id <> referee_id)
);
create unique index if not exists user_referrals_referee_uidx on user_referrals(referee_id);
create index if not exists user_referrals_referrer_status_idx on user_referrals(referrer_id, status);
create index if not exists user_referrals_ip_signed_idx on user_referrals(signup_ip, signed_up_at);

create table if not exists user_referral_earnings (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid references user_referrals(id),
  referrer_id uuid references auth.users(id),
  stripe_invoice_id text,
  amount_cents int not null,
  currency text default 'eur',
  applied_to_balance boolean default false,
  created_at timestamptz default now()
);
create unique index if not exists user_referral_earnings_invoice_uidx on user_referral_earnings(stripe_invoice_id);

alter table profiles add column if not exists bonus_months_credit int default 0;

-- RPC: record a referral signup (anti-fraud: skip self + same IP/fp spam)
create or replace function record_referral_signup(
  p_code text, p_referee uuid, p_ip inet, p_fp text
) returns uuid language plpgsql security definer as $$
declare v_referrer uuid; v_id uuid;
begin
  select user_id into v_referrer from user_referral_codes where unique_code = p_code;
  if v_referrer is null or v_referrer = p_referee then return null; end if;
  if (
    select count(*) from user_referrals
    where signup_ip = p_ip and device_fp = p_fp
      and signed_up_at > now() - interval '24 hours'
  ) >= 3 then
    return null;
  end if;
  insert into user_referrals (referrer_id, referee_id, code, signup_ip, device_fp)
    values (v_referrer, p_referee, p_code, p_ip, p_fp)
    on conflict (referee_id) do nothing
    returning id into v_id;
  if v_id is not null then
    update user_referral_codes set signups = signups + 1 where user_id = v_referrer;
  end if;
  return v_id;
end $$;

-- RPC: generate a user referral code idempotently
create or replace function get_or_create_user_referral_code(p_user uuid)
returns text language plpgsql security definer as $$
declare v_code text; v_try text; v_i int := 0;
begin
  select unique_code into v_code from user_referral_codes where user_id = p_user;
  if v_code is not null then return v_code; end if;
  loop
    v_try := 'U-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
    begin
      insert into user_referral_codes(user_id, unique_code) values (p_user, v_try);
      return v_try;
    exception when unique_violation then
      v_i := v_i + 1;
      if v_i > 5 then raise exception 'could not generate unique referral code'; end if;
    end;
  end loop;
end $$;
