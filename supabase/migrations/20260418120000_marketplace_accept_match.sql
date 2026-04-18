-- 2026-04-18 — FTG Marketplace : RPC accept_match
-- Flow bilatéral : producteur accepte → status=accepted_producer ;
-- acheteur accepte → status=accepted_buyer ; les deux → confirmed.
-- Quand confirmed, le volume et la demande passent en status='matched' (sortent des listings ouverts).

create or replace function public.accept_match(p_match_id uuid, p_role text)
returns public.marketplace_matches
language plpgsql
security definer
as $$
declare
  m          public.marketplace_matches;
  v          public.production_volumes;
  d          public.buyer_demands;
  uid        uuid;
  next_st    text;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  if p_role not in ('producer', 'buyer') then
    raise exception 'invalid role (expected producer|buyer)' using errcode = '22023';
  end if;

  select * into m from public.marketplace_matches where id = p_match_id;
  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;
  if m.status not in ('proposed', 'accepted_producer', 'accepted_buyer') then
    raise exception 'match already closed (status=%)', m.status using errcode = '22023';
  end if;

  select * into v from public.production_volumes where id = m.volume_id;
  select * into d from public.buyer_demands     where id = m.demand_id;

  if p_role = 'producer' then
    if v.producer_id is distinct from uid then
      raise exception 'not your volume' using errcode = '42501';
    end if;
    if m.status = 'accepted_buyer' then
      next_st := 'confirmed';
    else
      next_st := 'accepted_producer';
    end if;
  else  -- buyer
    if d.buyer_id is distinct from uid then
      raise exception 'not your demand' using errcode = '42501';
    end if;
    if m.status = 'accepted_producer' then
      next_st := 'confirmed';
    else
      next_st := 'accepted_buyer';
    end if;
  end if;

  update public.marketplace_matches
    set status = next_st,
        accepted_at = coalesce(accepted_at, now()),
        confirmed_at = case when next_st = 'confirmed' then now() else confirmed_at end
  where id = p_match_id
  returning * into m;

  if next_st = 'confirmed' then
    update public.production_volumes set status = 'matched' where id = m.volume_id;
    update public.buyer_demands      set status = 'matched' where id = m.demand_id;
  end if;

  return m;
end;
$$;

grant execute on function public.accept_match(uuid, text) to authenticated;

-- Index to help RLS lookups on participant side (already have idx by volume/demand, now by status participant)
create index if not exists idx_marketplace_matches_participant_status
  on public.marketplace_matches (status, volume_id, demand_id);
