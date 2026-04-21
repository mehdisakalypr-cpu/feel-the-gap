-- Shaka 2026-04-21 — RPC atomique pour path subscription pay-fee
-- Corrige la race condition dans /api/marketplace/matches/[id]/pay-fee (L61-64).
-- Le select-puis-update non atomique permettait 2 appels simultanés de double-consommer.
--
-- marketplace_consume_subscription_match fait en une seule transaction :
--   1. Check subscription active + quota dispo + ownership buyer
--   2. Check match status='confirmed' + buyer correspond à demand.buyer_id
--   3. Increment matches_used_this_period si et seulement si < matches_per_month
--   4. Update match → status='paid' + identities_revealed_at=now() si pas déjà paid
--   5. Upsert revenue_events (idempotent)
--   6. Return { consumed_quota_remaining, already_paid }
--
-- Utilisation côté app : /api/marketplace/matches/[id]/pay-fee appelle ce RPC
-- au lieu du select+update séparés. Si quota épuisé → RPC retourne consumed=false
-- et l'app bascule sur Stripe Checkout pay-per-act.

create or replace function public.marketplace_consume_subscription_match(
  p_match_id        uuid,
  p_subscription_id uuid,
  p_buyer_id        uuid
)
returns table(
  consumed                boolean,
  already_paid            boolean,
  quota_remaining_after   integer,
  error_code              text
)
language plpgsql
security definer
as $$
declare
  v_match_status  text;
  v_demand_buyer  uuid;
  v_sub_status    text;
  v_sub_user      uuid;
  v_quota_used    integer;
  v_quota_max     integer;
  v_fee_label     text;
begin
  -- 1. Load match + demand (verify buyer ownership via demand)
  select m.status, d.buyer_id, m.pricing_tier_label
    into v_match_status, v_demand_buyer, v_fee_label
  from public.marketplace_matches m
  join public.buyer_demands d on d.id = m.demand_id
  where m.id = p_match_id;

  if v_match_status is null then
    return query select false, false, 0, 'match_not_found'::text;
    return;
  end if;

  if v_demand_buyer <> p_buyer_id then
    return query select false, false, 0, 'not_buyer'::text;
    return;
  end if;

  -- Short-circuit if already paid (idempotence)
  if v_match_status = 'paid' then
    return query select false, true, 0, null::text;
    return;
  end if;

  if v_match_status <> 'confirmed' then
    return query select false, false, 0, ('bad_status:' || v_match_status)::text;
    return;
  end if;

  -- 2. Load subscription + lock row for update
  select status, user_id, matches_used_this_period, matches_per_month
    into v_sub_status, v_sub_user, v_quota_used, v_quota_max
  from public.marketplace_subscriptions
  where id = p_subscription_id
  for update;

  if v_sub_status is null then
    return query select false, false, 0, 'subscription_not_found'::text;
    return;
  end if;
  if v_sub_user <> p_buyer_id then
    return query select false, false, 0, 'subscription_not_owned'::text;
    return;
  end if;
  if v_sub_status <> 'active' then
    return query select false, false, 0, ('bad_sub_status:' || v_sub_status)::text;
    return;
  end if;
  if v_quota_used >= v_quota_max then
    return query select false, false, 0, 'quota_exhausted'::text;
    return;
  end if;

  -- 3. Consume quota
  update public.marketplace_subscriptions
     set matches_used_this_period = matches_used_this_period + 1,
         updated_at = now()
   where id = p_subscription_id
     and matches_used_this_period < matches_per_month;

  -- 4. Mark match paid + reveal identities (conditional to avoid double-paid)
  update public.marketplace_matches
     set status = 'paid',
         identities_revealed_at = now()
   where id = p_match_id
     and status = 'confirmed';

  -- 5. Upsert revenue event (idempotent via id)
  insert into public.revenue_events (id, product, event_type, user_id, amount_eur, metadata, created_at)
  values (
    'mp_fee_sub_' || p_match_id::text,
    'feel-the-gap',
    'marketplace_fee_subscription_consumed',
    p_buyer_id,
    0,
    jsonb_build_object(
      'match_id',        p_match_id,
      'subscription_id', p_subscription_id,
      'tier_label',      v_fee_label
    ),
    now()
  )
  on conflict (id) do nothing;

  return query select
    true::boolean,
    false::boolean,
    (v_quota_max - v_quota_used - 1)::integer,
    null::text;
end;
$$;

comment on function public.marketplace_consume_subscription_match(uuid, uuid, uuid) is
  'Atomic consume-quota + mark-paid + reveal-identities + revenue event for marketplace subscription pay-fee path. Prevents race conditions.';
