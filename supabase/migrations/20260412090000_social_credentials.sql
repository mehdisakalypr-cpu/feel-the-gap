-- Social Credentials Vault: stockage chiffré des credentials par site × plateforme

create extension if not exists pgcrypto;

create table if not exists social_credentials (
  id uuid primary key default gen_random_uuid(),
  site_slug text not null check (site_slug in ('ftg','ofa','cc','estate','shift')),
  platform text not null,
  handle text,
  auth_type text not null check (auth_type in ('password','api_key','oauth_token','refresh_token','app_password','bot_token','bearer_token')),
  credential_encrypted bytea not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz,
  unique (site_slug, platform, handle)
);

create index if not exists idx_social_credentials_site_platform on social_credentials (site_slug, platform);

create table if not exists credential_access_log (
  id bigserial primary key,
  credential_id uuid references social_credentials(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null check (action in ('reveal','read','update','test','delete','create')),
  created_at timestamptz not null default now()
);

alter table social_credentials enable row level security;
alter table credential_access_log enable row level security;

drop policy if exists service_all_cred on social_credentials;
create policy service_all_cred on social_credentials for all using (true) with check (true);

drop policy if exists service_all_log on credential_access_log;
create policy service_all_log on credential_access_log for all using (true) with check (true);

-- encrypt/decrypt done via inline pgp_sym_encrypt / pgp_sym_decrypt in queries
