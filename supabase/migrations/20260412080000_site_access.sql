-- Site access isolation: user ↔ site permissions
-- Prevents a user of FTG from logging into OFA/CC/Estate without an explicit grant.

create table if not exists site_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_slug text not null check (site_slug in ('ftg','ofa','cc','estate','shift')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id),
  unique (user_id, site_slug)
);

create index if not exists idx_site_access_user on site_access (user_id);
create index if not exists idx_site_access_slug on site_access (site_slug);

alter table site_access enable row level security;

drop policy if exists service_all on site_access;
create policy service_all on site_access for all using (true) with check (true);

-- Grant existing users access to their origin site.
-- Backfill: any current user is assumed to be an FTG user (projet historique).
insert into site_access (user_id, site_slug)
select id, 'ftg' from auth.users
on conflict (user_id, site_slug) do nothing;
