-- 2026-04-17 — Add Solo Producer tier (€19.99/mo) to Fill the Gap quota table.
-- Context: `profiles.tier` is plain TEXT (no CHECK), but `user_fillthegap_quota.plan`
-- restricts values. Solo Producer has quota 0 but webhooks still upsert the plan
-- name on subscription change, so the CHECK must allow 'solo_producer'.

alter table public.user_fillthegap_quota
  drop constraint if exists user_fillthegap_quota_plan_check;

alter table public.user_fillthegap_quota
  add constraint user_fillthegap_quota_plan_check
  check (plan in ('free','solo_producer','starter','strategy','premium','ultimate','custom'));

-- Update the grant mapping function — Solo Producer has 0 Fill the Gap quota.
-- (Explicit `when 'solo_producer' then 0` for clarity, even though the `else` branch covers it.)
create or replace function public.fillthegap_monthly_grant(p_plan text)
returns int as $$
begin
  return case p_plan
    when 'premium'       then 150
    when 'ultimate'      then 250
    when 'solo_producer' then 0
    else 0
  end;
end;
$$ language plpgsql immutable;
