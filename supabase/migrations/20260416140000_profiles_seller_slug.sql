-- Profiles seller_slug pour URL publique /seller/{slug}
alter table public.profiles add column if not exists seller_slug text unique;

update public.profiles
  set seller_slug = lower(regexp_replace(coalesce(username, split_part(email, '@', 1)), '[^a-z0-9]+', '-', 'g'))
  where seller_slug is null and email is not null;

create index if not exists idx_profiles_seller_slug on public.profiles(seller_slug);

-- Trigger : auto-set seller_slug à l'inscription (handle_new_user)
create or replace function public.set_default_seller_slug() returns trigger language plpgsql as $$
begin
  if new.seller_slug is null then
    new.seller_slug := lower(regexp_replace(coalesce(new.username, split_part(coalesce(new.email,''), '@', 1)), '[^a-z0-9]+', '-', 'g'));
    -- Append short suffix si collision (rare mais safe)
    if exists (select 1 from public.profiles where seller_slug = new.seller_slug and id <> new.id) then
      new.seller_slug := new.seller_slug || '-' || substr(replace(new.id::text, '-', ''), 1, 6);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_profiles_default_seller_slug on public.profiles;
create trigger trg_profiles_default_seller_slug before insert on public.profiles
  for each row execute function public.set_default_seller_slug();
