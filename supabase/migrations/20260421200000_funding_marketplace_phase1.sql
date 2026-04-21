-- Feel The Gap — Funding Marketplace Phase 1
-- Adds quota / subscription / waitlist / matching state / refusal tracking
-- on top of the existing funding_dossiers + funding_offers + investor_offers.
--
-- Goals:
--  * Investor subscriptions (Explorer/Active/Pro) with monthly quota and founding-pioneer flag.
--  * Waitlist for investor/financeur signup before the unlock threshold.
--  * Marketplace state singleton for phase transitions (sourcing → live → frozen → scale).
--  * Investor matching profile (sectors / ticket / geo / stages).
--  * Extra-credit packs purchased separately from subscriptions.
--  * Refusal justification + 3-refusal flag on dossiers.
--  * Anonymization SQL function centralized — no route can accidentally leak nominative fields.

begin;

-- ─────────────────────────────────────────────────────────────
-- 1. Dossier augmentations — published state + refusal tracking
-- ─────────────────────────────────────────────────────────────

alter table funding_dossiers
  add column if not exists refusal_count int not null default 0,
  add column if not exists refusals_log jsonb not null default '[]'::jsonb,
  add column if not exists flagged_at timestamptz,
  add column if not exists admin_review_status text
    check (admin_review_status in ('clear','pending_review','suspended'))
    default 'clear';

-- "Published to catalog" is a derived view: status in submitted/under_review/matched
-- AND completion_pct=100. We materialize it as a boolean generated-like column via trigger
-- for fast filtering + indexing.
alter table funding_dossiers
  add column if not exists is_in_catalog boolean not null default false;

create or replace function recompute_dossier_catalog_flag()
returns trigger language plpgsql as $$
begin
  new.is_in_catalog = (
    coalesce(new.completion_pct, 0) = 100
    and new.status in ('submitted','under_review','matched')
    and coalesce(new.admin_review_status, 'clear') <> 'suspended'
  );
  return new;
end $$;

drop trigger if exists trg_funding_dossiers_catalog on funding_dossiers;
create trigger trg_funding_dossiers_catalog
  before insert or update of completion_pct, status, admin_review_status
  on funding_dossiers for each row execute function recompute_dossier_catalog_flag();

create index if not exists idx_funding_dossiers_catalog
  on funding_dossiers(is_in_catalog, type, country_iso) where is_in_catalog = true;

-- ─────────────────────────────────────────────────────────────
-- 2. Offer refusal details — justification + quota charging
-- ─────────────────────────────────────────────────────────────

do $$ begin
  if not exists (select 1 from pg_type where typname = 'refusal_reason_code') then
    create type refusal_reason_code as enum (
      'ticket_too_low',
      'valuation_unfit',
      'not_aligned',
      'timing',
      'terms_unfavorable',
      'other'
    );
  end if;
end $$;

alter table funding_offers
  add column if not exists refusal_reason_code refusal_reason_code,
  add column if not exists refusal_reason_text text,
  add column if not exists quota_charged boolean not null default false,
  add column if not exists decided_at timestamptz;

alter table investor_offers
  add column if not exists refusal_reason_code refusal_reason_code,
  add column if not exists refusal_reason_text text,
  add column if not exists quota_charged boolean not null default false,
  add column if not exists decided_at timestamptz;

-- ─────────────────────────────────────────────────────────────
-- 3. Investor subscriptions (quota-aware)
-- ─────────────────────────────────────────────────────────────

do $$ begin
  if not exists (select 1 from pg_type where typname = 'subscription_tier') then
    create type subscription_tier as enum ('explorer','active','pro');
  end if;
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type subscription_status as enum (
      'active','suspended','frozen_catalog_low','canceled','past_due'
    );
  end if;
end $$;

create table if not exists investor_subscriptions (
  id                uuid primary key default gen_random_uuid(),
  investor_id       uuid not null unique references auth.users(id) on delete cascade,
  role_kind         user_role not null check (role_kind in ('financeur','investisseur')),
  tier              subscription_tier not null,
  status            subscription_status not null default 'active',
  commitment_months int not null default 1 check (commitment_months in (1,12,24,36)),
  founding_pioneer  boolean not null default false,
  quota_month       int not null,                          -- 5 / 10 / 20 depending on tier
  quota_used_month  int not null default 0,
  quota_period_start date not null default date_trunc('month', now())::date,
  extra_credits     int not null default 0,
  stripe_customer_id text,
  stripe_subscription_id text,
  canceled_at       timestamptz,
  renews_at         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_investor_subs_status on investor_subscriptions(status);
create index if not exists idx_investor_subs_tier on investor_subscriptions(tier);

drop trigger if exists trg_investor_subs_updated on investor_subscriptions;
create trigger trg_investor_subs_updated before update on investor_subscriptions
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 4. Pre-Phase-2 waitlist
-- ─────────────────────────────────────────────────────────────

create table if not exists investor_waitlist (
  id                uuid primary key default gen_random_uuid(),
  email             citext not null,
  role_kind         user_role not null check (role_kind in ('financeur','investisseur')),
  profile           jsonb not null default '{}'::jsonb,  -- sectors, ticket, geo, stages
  signed_up_at      timestamptz not null default now(),
  notified_at       timestamptz,
  converted_user_id uuid references auth.users(id) on delete set null,
  unique (email, role_kind)
);
create index if not exists idx_investor_waitlist_unnotified
  on investor_waitlist(signed_up_at) where notified_at is null;

-- ─────────────────────────────────────────────────────────────
-- 5. Investor matching profile (used for vitrine rotation)
-- ─────────────────────────────────────────────────────────────

create table if not exists investor_profiles (
  investor_id     uuid primary key references auth.users(id) on delete cascade,
  sectors         text[] not null default '{}',
  subsectors      text[] not null default '{}',
  ticket_min_eur  bigint,
  ticket_max_eur  bigint,
  countries       text[] not null default '{}',
  stages          text[] not null default '{}',
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_investor_profiles_updated on investor_profiles;
create trigger trg_investor_profiles_updated before update on investor_profiles
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 6. Extra-credit ledger
-- ─────────────────────────────────────────────────────────────

do $$ begin
  if not exists (select 1 from pg_type where typname = 'credit_pack_kind') then
    create type credit_pack_kind as enum ('single','pack5','pack10','pack25');
  end if;
end $$;

create table if not exists funding_credits (
  id              uuid primary key default gen_random_uuid(),
  investor_id     uuid not null references auth.users(id) on delete cascade,
  pack_kind       credit_pack_kind not null,
  credits_added   int not null check (credits_added > 0),
  price_paid_eur  numeric not null check (price_paid_eur >= 0),
  stripe_payment_intent_id text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_funding_credits_investor on funding_credits(investor_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 7. Marketplace state singleton (phase gate)
-- ─────────────────────────────────────────────────────────────

do $$ begin
  if not exists (select 1 from pg_type where typname = 'marketplace_phase') then
    create type marketplace_phase as enum ('sourcing','live','frozen','scale');
  end if;
end $$;

create table if not exists marketplace_state (
  id                         int primary key default 1 check (id = 1),
  phase                      marketplace_phase not null default 'sourcing',
  dossiers_complete_count    int not null default 0,
  dossiers_in_progress_count int not null default 0,
  waitlist_count             int not null default 0,
  unlock_threshold           int not null default 50,
  freeze_floor               int not null default 30,
  founding_pioneer_limit     int not null default 50,
  founding_pioneer_used      int not null default 0,
  founding_pioneer_discount_pct int not null default 30,
  force_open                 boolean not null default false,
  last_computed_at           timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

insert into marketplace_state (id, phase) values (1, 'sourcing')
  on conflict (id) do nothing;

drop trigger if exists trg_marketplace_state_updated on marketplace_state;
create trigger trg_marketplace_state_updated before update on marketplace_state
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 8. Anonymized dossier view (central leak-prevention)
-- ─────────────────────────────────────────────────────────────

-- Returns the public-safe fields of a dossier. No nominative identifiers leak from this.
-- Answers JSONB is filtered to a whitelist of non-identifying keys.
create or replace function public.get_anonymized_dossier(p_dossier_id uuid)
returns table (
  id uuid,
  public_number int,
  type dossier_type,
  country_iso text,
  sector text,
  amount_eur numeric,
  completion_pct int,
  status dossier_status,
  last_updated timestamptz,
  safe_answers jsonb
) language sql stable security definer set search_path = public as $$
  with d as (
    select * from funding_dossiers where id = p_dossier_id and is_in_catalog = true
  )
  select
    d.id,
    d.public_number,
    d.type,
    d.country_iso,
    -- Product slug proxy used as sector hint until a dedicated column is seeded.
    d.product_slug as sector,
    d.amount_eur,
    d.completion_pct,
    d.status,
    d.updated_at as last_updated,
    -- Whitelist only non-identifying answer keys. Anything nominative stays server-side.
    (
      select jsonb_object_agg(key, value)
      from jsonb_each(d.answers)
      where key in (
        'sector_detail','subsector','stage','team_size_band','revenue_band','mrr_band',
        'burn_band','runway_months','growth_pct','gross_margin_pct','market_size',
        'target_geos','business_model','unit_economics','traction_summary','use_of_funds',
        'expected_round_closing','problem_statement','solution_summary','competitors_count'
      )
    ) as safe_answers
  from d;
$$;

-- Lock direct SELECT on funding_dossiers for non-owners (other than service_role).
-- Callers for anonymized access MUST go through get_anonymized_dossier() — enforced at API layer.
grant execute on function public.get_anonymized_dossier(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 9. Quota-aware atomic offer decision helper
-- ─────────────────────────────────────────────────────────────

-- When an offer is accepted: flip offer.status='accepted', mark quota_charged=true, and
-- increment investor_subscriptions.quota_used_month (decrement available credits if quota full).
-- Single transaction, advisory lock on investor_id to avoid race.
create or replace function public.accept_offer_atomic(
  p_offer_id uuid,
  p_offer_kind text  -- 'funding' | 'investor'
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_investor_id uuid;
  v_dossier_id uuid;
  v_row_count int;
begin
  if p_offer_kind = 'funding' then
    select financeur_id, dossier_id into v_investor_id, v_dossier_id
      from funding_offers where id = p_offer_id for update;
  elsif p_offer_kind = 'investor' then
    select investor_id, dossier_id into v_investor_id, v_dossier_id
      from investor_offers where id = p_offer_id for update;
  else
    raise exception 'invalid p_offer_kind: %', p_offer_kind;
  end if;

  if v_investor_id is null then
    raise exception 'offer not found';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_investor_id::text));

  -- Decrement quota or credits atomically.
  update investor_subscriptions
    set quota_used_month = quota_used_month + 1
    where investor_id = v_investor_id
      and status = 'active'
      and quota_used_month < quota_month
  returning 1 into v_row_count;

  if v_row_count is null then
    -- quota full → try to consume 1 extra credit
    update investor_subscriptions
      set extra_credits = extra_credits - 1
      where investor_id = v_investor_id
        and status = 'active'
        and extra_credits > 0
    returning 1 into v_row_count;

    if v_row_count is null then
      raise exception 'quota_exhausted_and_no_credits';
    end if;
  end if;

  -- Mark offer accepted
  if p_offer_kind = 'funding' then
    update funding_offers
      set status='accepted', quota_charged=true, decided_at=now()
      where id=p_offer_id and status in ('sent','draft');
  else
    update investor_offers
      set status='accepted', quota_charged=true, decided_at=now()
      where id=p_offer_id and status in ('sent','draft');
  end if;
end $$;

grant execute on function public.accept_offer_atomic(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 10. Refusal helper — records reason, increments count, flags at 3
-- ─────────────────────────────────────────────────────────────

create or replace function public.refuse_offer(
  p_offer_id uuid,
  p_offer_kind text,
  p_reason_code refusal_reason_code,
  p_reason_text text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_dossier_id uuid;
  v_new_count int;
begin
  if p_offer_kind = 'funding' then
    update funding_offers
      set status='declined', quota_charged=false,
          refusal_reason_code=p_reason_code, refusal_reason_text=p_reason_text,
          decided_at=now()
      where id=p_offer_id and status in ('sent','draft')
    returning dossier_id into v_dossier_id;
  elsif p_offer_kind = 'investor' then
    update investor_offers
      set status='declined', quota_charged=false,
          refusal_reason_code=p_reason_code, refusal_reason_text=p_reason_text,
          decided_at=now()
      where id=p_offer_id and status in ('sent','draft')
    returning dossier_id into v_dossier_id;
  else
    raise exception 'invalid p_offer_kind: %', p_offer_kind;
  end if;

  if v_dossier_id is null then raise exception 'offer not found or not refusable'; end if;

  update funding_dossiers
    set refusal_count = refusal_count + 1,
        refusals_log = refusals_log || jsonb_build_object(
          'at', now(),
          'offer_id', p_offer_id,
          'reason_code', p_reason_code,
          'reason_text', left(coalesce(p_reason_text,''), 500)
        ),
        flagged_at = case when refusal_count + 1 >= 3 and flagged_at is null then now() else flagged_at end,
        admin_review_status = case
          when refusal_count + 1 >= 3 and coalesce(admin_review_status,'clear') = 'clear'
          then 'pending_review' else admin_review_status end
    where id = v_dossier_id
    returning refusal_count into v_new_count;
end $$;

grant execute on function public.refuse_offer(uuid, text, refusal_reason_code, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 11. Marketplace state recompute (called by VPS cron every 5 min)
-- ─────────────────────────────────────────────────────────────

create or replace function public.recompute_marketplace_state()
returns marketplace_state language plpgsql security definer set search_path = public as $$
declare
  v_complete int;
  v_in_progress int;
  v_waitlist int;
  v_state marketplace_state;
begin
  select count(*)::int into v_complete
    from funding_dossiers where is_in_catalog = true
      and updated_at > now() - interval '60 days';

  select count(*)::int into v_in_progress
    from funding_dossiers where status='draft' and completion_pct > 0 and completion_pct < 100;

  select count(*)::int into v_waitlist
    from investor_waitlist where notified_at is null;

  update marketplace_state set
    dossiers_complete_count = v_complete,
    dossiers_in_progress_count = v_in_progress,
    waitlist_count = v_waitlist,
    last_computed_at = now(),
    -- Phase transitions
    phase = case
      when force_open then 'live'
      when v_complete >= unlock_threshold and phase = 'sourcing' then 'live'
      when v_complete < freeze_floor and phase = 'live' then 'frozen'
      when v_complete >= unlock_threshold and phase = 'frozen' then 'live'
      when v_complete >= 500 and phase = 'live' then 'scale'
      else phase
    end
  where id = 1
  returning * into v_state;
  return v_state;
end $$;

grant execute on function public.recompute_marketplace_state() to service_role;

-- ─────────────────────────────────────────────────────────────
-- 12. RLS — new tables
-- ─────────────────────────────────────────────────────────────

alter table investor_subscriptions enable row level security;
alter table investor_waitlist enable row level security;
alter table investor_profiles enable row level security;
alter table funding_credits enable row level security;
alter table marketplace_state enable row level security;

drop policy if exists "investor_subs_owner" on investor_subscriptions;
create policy "investor_subs_owner" on investor_subscriptions
  for all using (auth.uid() = investor_id) with check (auth.uid() = investor_id);

drop policy if exists "investor_profiles_owner" on investor_profiles;
create policy "investor_profiles_owner" on investor_profiles
  for all using (auth.uid() = investor_id) with check (auth.uid() = investor_id);

drop policy if exists "funding_credits_owner" on funding_credits;
create policy "funding_credits_owner" on funding_credits
  for select using (auth.uid() = investor_id);

-- waitlist: anon can INSERT (signup), nobody can SELECT except service_role
drop policy if exists "investor_waitlist_insert" on investor_waitlist;
create policy "investor_waitlist_insert" on investor_waitlist
  for insert with check (true);

-- marketplace_state: everyone can read the counters (public transparency)
drop policy if exists "marketplace_state_read" on marketplace_state;
create policy "marketplace_state_read" on marketplace_state
  for select using (true);

commit;
