-- Feel The Gap — Multi-rôles
-- Un user peut cumuler plusieurs rôles (entrepreneur, financeur, investisseur,
-- influenceur) et switcher entre eux via un bouton dans la topbar.

-- 1. Étendre l'enum user_role avec 'influenceur'
-- (enum addition doit être committed avant d'être utilisée → utilisation différée dans les backfills)
do $$ begin
  if not exists (select 1 from pg_enum e join pg_type t on e.enumtypid = t.oid where t.typname = 'user_role' and e.enumlabel = 'influenceur') then
    alter type user_role add value 'influenceur';
  end if;
end $$;

-- 2. Nouvelle colonne roles (array) — garde la colonne `role` legacy pour compat
alter table profiles add column if not exists roles user_role[] not null default '{entrepreneur}';

-- 3. Backfill depuis `role` existant
update profiles
set roles = array[role]
where (roles is null or array_length(roles, 1) is null or roles = '{}'::user_role[])
  and role is not null;

-- 4. Colonne active_role pour mémoriser le dernier rôle actif (nullable = fallback entrepreneur)
alter table profiles add column if not exists active_role user_role;

-- 5. Trigger : garantit que active_role est dans roles
create or replace function ensure_active_role_in_roles()
returns trigger language plpgsql as $$
begin
  if new.active_role is not null and not (new.active_role = any(new.roles)) then
    new.roles = array_append(new.roles, new.active_role);
  end if;
  return new;
end $$;

drop trigger if exists trg_profiles_active_role on profiles;
create trigger trg_profiles_active_role before insert or update on profiles
  for each row execute function ensure_active_role_in_roles();

-- 6. Helper function : has_role(role)
create or replace function public.has_role(r user_role)
returns boolean language sql stable as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and r = any(p.roles)
  );
$$;

-- 7. Mise à jour des policies RLS qui utilisaient p.role = '...'
--    (funding_dossiers_financeur_read et funding_dossiers_investor_read de 20260409220000)
drop policy if exists "funding_dossiers_financeur_read" on funding_dossiers;
create policy "funding_dossiers_financeur_read" on funding_dossiers
  for select using (
    status in ('submitted','under_review','matched')
    and type = 'financement'
    and has_role('financeur'::user_role)
  );

drop policy if exists "funding_dossiers_investor_read" on funding_dossiers;
create policy "funding_dossiers_investor_read" on funding_dossiers
  for select using (
    status in ('submitted','under_review','matched')
    and type = 'investissement'
    and has_role('investisseur'::user_role)
  );

comment on column profiles.roles is 'Rôles cumulables : entrepreneur, financeur, investisseur, influenceur. Un user peut en avoir plusieurs et switcher via la topbar.';
comment on column profiles.active_role is 'Dernier rôle actif côté UI. Null = fallback sur entrepreneur.';
