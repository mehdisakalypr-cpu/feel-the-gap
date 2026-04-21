-- Extras for the funding marketplace phase 1:
--   * increment_founding_pioneer_used() — race-safe counter bump called by webhook
--   * investor_can_view_full_dossier() — canonical "has Explorer/Active/Pro active sub?" predicate
--   * investor_offers_history() — aggregates offers sent by the caller (dashboard/pipeline view)

begin;

-- ─────────────────────────────────────────────────────────────
-- 1. Founding pioneer counter
-- ─────────────────────────────────────────────────────────────
create or replace function public.increment_founding_pioneer_used()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_new_used int;
begin
  update marketplace_state
    set founding_pioneer_used = least(founding_pioneer_used + 1, founding_pioneer_limit)
    where id = 1
    returning founding_pioneer_used into v_new_used;
  return coalesce(v_new_used, 0);
end $$;
grant execute on function public.increment_founding_pioneer_used() to service_role;

-- ─────────────────────────────────────────────────────────────
-- 2. Can caller view the full (non-anonymized) dossier?
--    Rules:
--      - dossier owner → always full
--      - platform admin → always full
--      - any active investor_subscriptions with tier in (active, pro) → full
--      - explorer tier → anonymized only (enforced at API layer, not RLS)
-- ─────────────────────────────────────────────────────────────
create or replace function public.investor_can_view_full_dossier(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from investor_subscriptions s
    where s.investor_id = p_user
      and s.status = 'active'
      and s.tier in ('active','pro')
  )
$$;
grant execute on function public.investor_can_view_full_dossier(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Offer history for the calling investor/financeur (dashboard)
--    Returns their sent offers across both tables, joined with anonymized dossier info.
-- ─────────────────────────────────────────────────────────────
create or replace function public.investor_offers_history(p_user uuid)
returns table (
  offer_id uuid,
  kind text,
  dossier_id uuid,
  dossier_public_number int,
  dossier_country text,
  dossier_type dossier_type,
  dossier_amount_eur numeric,
  amount_eur numeric,
  status text,
  refusal_reason_code refusal_reason_code,
  refusal_reason_text text,
  quota_charged boolean,
  sent_at timestamptz,
  decided_at timestamptz
) language sql stable security definer set search_path = public as $$
  select
    fo.id,
    'funding'::text,
    fo.dossier_id,
    fd.public_number,
    fd.country_iso,
    fd.type,
    fd.amount_eur,
    fo.amount_eur,
    fo.status::text,
    fo.refusal_reason_code,
    fo.refusal_reason_text,
    fo.quota_charged,
    fo.created_at,
    fo.decided_at
  from funding_offers fo
  join funding_dossiers fd on fd.id = fo.dossier_id
  where fo.financeur_id = p_user
  union all
  select
    io.id,
    'investor'::text,
    io.dossier_id,
    fd.public_number,
    fd.country_iso,
    fd.type,
    fd.amount_eur,
    io.amount_eur,
    io.status::text,
    io.refusal_reason_code,
    io.refusal_reason_text,
    io.quota_charged,
    io.created_at,
    io.decided_at
  from investor_offers io
  join funding_dossiers fd on fd.id = io.dossier_id
  where io.investor_id = p_user
  order by 12 desc nulls last, 13 desc nulls last
$$;
grant execute on function public.investor_offers_history(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. Offers received on a given dossier (for the owner — accept/refuse UI)
-- ─────────────────────────────────────────────────────────────
create or replace function public.dossier_offers_received(p_dossier uuid)
returns table (
  offer_id uuid,
  kind text,
  counterparty_id uuid,
  amount_eur numeric,
  interest_rate_pct numeric,
  duration_months int,
  has_insurance boolean,
  fees_eur numeric,
  pct_capital numeric,
  platform_valuation_eur numeric,
  user_valuation_eur numeric,
  valuation_warning_flagged boolean,
  message text,
  contact_requested boolean,
  status text,
  sent_at timestamptz,
  decided_at timestamptz,
  refusal_reason_code refusal_reason_code,
  refusal_reason_text text
) language sql stable security definer set search_path = public as $$
  with owner_check as (
    select user_id from funding_dossiers where id = p_dossier
  )
  select
    fo.id,
    'funding'::text,
    fo.financeur_id,
    fo.amount_eur,
    fo.interest_rate_pct,
    fo.duration_months,
    fo.has_insurance,
    fo.fees_eur,
    null::numeric, null::numeric, null::numeric, null::boolean,
    fo.message,
    fo.contact_requested,
    fo.status::text,
    fo.created_at,
    fo.decided_at,
    fo.refusal_reason_code,
    fo.refusal_reason_text
  from funding_offers fo, owner_check oc
  where fo.dossier_id = p_dossier
    and oc.user_id = auth.uid()
  union all
  select
    io.id,
    'investor'::text,
    io.investor_id,
    io.amount_eur,
    null::numeric, null::int, null::boolean, null::numeric,
    io.pct_capital,
    io.platform_valuation_eur,
    io.user_valuation_eur,
    io.valuation_warning_flagged,
    io.message,
    io.contact_requested,
    io.status::text,
    io.created_at,
    io.decided_at,
    io.refusal_reason_code,
    io.refusal_reason_text
  from investor_offers io, owner_check oc
  where io.dossier_id = p_dossier
    and oc.user_id = auth.uid()
  order by 15 desc nulls last
$$;
grant execute on function public.dossier_offers_received(uuid) to authenticated;

commit;
