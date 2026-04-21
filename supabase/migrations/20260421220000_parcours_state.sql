-- Parcours state — admin-toggleable feature flag for each non-entrepreneur role.
--
-- Rationale: launching financeur/investisseur parcours with zero dossiers is
-- counter-productive. Admin controls when each parcours goes live; entrepreneurs
-- and all other visitors see nothing (routes return 404, links hidden, dossier
-- type options filtered) while disabled.
--
-- Entrepreneur is always enabled — it's the cold start of the platform.

begin;

create table if not exists parcours_state (
  role_kind         user_role primary key check (role_kind in ('entrepreneur','financeur','investisseur','influenceur')),
  enabled           boolean not null default false,
  auto_enable_threshold int,       -- dossiers_complete_count from marketplace_state above which we auto-flip to enabled
  enabled_at        timestamptz,
  disabled_at       timestamptz,
  updated_by        uuid references auth.users(id) on delete set null,
  reason            text,
  updated_at        timestamptz not null default now()
);

drop trigger if exists trg_parcours_state_updated on parcours_state;
create trigger trg_parcours_state_updated before update on parcours_state
  for each row execute function set_updated_at();

-- Seed the four rows.
insert into parcours_state (role_kind, enabled, auto_enable_threshold, enabled_at)
values
  ('entrepreneur', true,  null, now()),
  ('financeur',    false, 50,   null),
  ('investisseur', false, 50,   null),
  ('influenceur',  false, null, null)
on conflict (role_kind) do nothing;

-- Everyone can read enable flags (powers the public homepage + Topbar).
alter table parcours_state enable row level security;
drop policy if exists "parcours_state_read" on parcours_state;
create policy "parcours_state_read" on parcours_state for select using (true);

-- Only service_role can write.
drop policy if exists "parcours_state_admin_write" on parcours_state;
create policy "parcours_state_admin_write" on parcours_state
  for all using (false) with check (false);  -- route handlers use service_role

-- Helper: check a single parcours is enabled.
create or replace function public.is_parcours_enabled(p_role user_role)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from parcours_state where role_kind = p_role), false)
$$;
grant execute on function public.is_parcours_enabled(user_role) to authenticated, anon;

-- Auto-enable when marketplace threshold reached.
-- Called from recompute_marketplace_state() (extended below).
create or replace function public.auto_enable_parcours()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_complete int;
begin
  select dossiers_complete_count into v_complete from marketplace_state where id = 1;
  update parcours_state
    set enabled = true,
        enabled_at = coalesce(enabled_at, now()),
        reason = coalesce(reason, 'auto-enabled: dossier threshold reached')
    where enabled = false
      and auto_enable_threshold is not null
      and coalesce(v_complete, 0) >= auto_enable_threshold;
end $$;
grant execute on function public.auto_enable_parcours() to service_role;

-- Patch recompute_marketplace_state() so it also fires auto_enable_parcours.
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

  -- Auto-flip parcours_state rows whose auto_enable_threshold has been crossed.
  perform public.auto_enable_parcours();

  return v_state;
end $$;

commit;
