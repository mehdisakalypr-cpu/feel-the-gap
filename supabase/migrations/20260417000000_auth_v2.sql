-- Auth Brick v2 — canonical schema
-- Applied to every project (FTG, OFA, CC, Estate). Idempotent.
-- Requires: pgcrypto, citext.

begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ──────────────────────────────────────────────────────────────────────────────
-- profiles: one row per auth.users row
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         citext not null unique,
  display_name  text,
  role          text not null default 'user' check (role in ('user','admin','owner')),
  locale        text default 'fr',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists profiles_email_idx on public.profiles (email);

-- Auto-sync email from auth.users into profiles
create or replace function public.sync_profile_from_auth_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function public.sync_profile_from_auth_user();

-- ──────────────────────────────────────────────────────────────────────────────
-- site_access: which user has access to which site (isolation)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.auth_site_access (
  user_id     uuid not null references auth.users(id) on delete cascade,
  site_slug   text not null,
  role        text not null default 'user' check (role in ('user','admin','owner')),
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  primary key (user_id, site_slug)
);
create index if not exists auth_site_access_slug_idx on public.auth_site_access (site_slug) where revoked_at is null;

-- ──────────────────────────────────────────────────────────────────────────────
-- webauthn_credentials: passkeys
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.webauthn_credentials (
  id                    text primary key,            -- credential id (base64url)
  user_id               uuid not null references auth.users(id) on delete cascade,
  site_slug             text not null,
  rp_id                 text not null,
  public_key            text not null,               -- base64url of CBOR-encoded pubkey
  counter               bigint not null default 0,
  transports            text[] default '{}',
  device_name           text,
  backup_eligible       boolean default false,
  backup_state          boolean default false,
  aaguid                text,
  created_at            timestamptz not null default now(),
  last_used_at          timestamptz
);
create index if not exists webauthn_user_site_idx on public.webauthn_credentials (user_id, site_slug);

-- ──────────────────────────────────────────────────────────────────────────────
-- auth_otp_codes: forgot-password OTP (email) / step-up
-- Stored hashed (sha256 hex). We DO NOT store the plaintext code.
-- Lookup by (email_hash, site_slug, purpose) with hash comparison.
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.auth_otp_codes (
  id            uuid primary key default gen_random_uuid(),
  email_hash    bytea not null,                     -- sha256(email_lower)
  site_slug     text not null,
  purpose       text not null check (purpose in ('reset','mfa_recover','email_verify')),
  code_hash     bytea not null,                     -- sha256(otp + pepper)
  expires_at    timestamptz not null,
  attempts      int not null default 0,
  max_attempts  int not null default 5,
  consumed_at   timestamptz,
  created_ip    inet,
  created_at    timestamptz not null default now()
);
create index if not exists auth_otp_email_site_idx on public.auth_otp_codes (email_hash, site_slug, purpose)
  where consumed_at is null;
create index if not exists auth_otp_expires_idx on public.auth_otp_codes (expires_at);

-- ──────────────────────────────────────────────────────────────────────────────
-- auth_magic_links: passwordless email links (opt-in)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.auth_magic_links (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  email_hash    bytea not null,
  site_slug     text not null,
  token_hash    bytea not null unique,              -- sha256(token)
  expires_at    timestamptz not null,
  consumed_at   timestamptz,
  created_ip    inet,
  created_at    timestamptz not null default now()
);
create index if not exists auth_magic_email_idx on public.auth_magic_links (email_hash, site_slug)
  where consumed_at is null;

-- ──────────────────────────────────────────────────────────────────────────────
-- auth_totp: TOTP 2FA secrets (AES-GCM encrypted)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.auth_totp (
  user_id             uuid not null references auth.users(id) on delete cascade,
  site_slug           text not null,
  secret_enc          bytea not null,               -- aes-gcm(base32 secret, pepper)
  recovery_hashes     bytea[] default '{}',         -- sha256 per recovery code
  verified_at         timestamptz,                  -- null until user confirms first TOTP
  created_at          timestamptz not null default now(),
  primary key (user_id, site_slug)
);

-- ──────────────────────────────────────────────────────────────────────────────
-- auth_events: append-only audit log
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.auth_events (
  id          bigserial primary key,
  user_id     uuid references auth.users(id) on delete set null,
  site_slug   text not null,
  event       text not null,                        -- login_ok, login_fail, reset_request, ...
  ip          inet,
  ua_hash     bytea,
  meta        jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists auth_events_user_idx on public.auth_events (user_id, created_at desc);
create index if not exists auth_events_site_event_idx on public.auth_events (site_slug, event, created_at desc);

-- ──────────────────────────────────────────────────────────────────────────────
-- auth_rate_limit: fallback in-db sliding window (if Upstash unavailable)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.auth_rate_limit (
  key         text not null,
  bucket_ts   timestamptz not null,
  count       int not null default 0,
  primary key (key, bucket_ts)
);
create index if not exists auth_rate_limit_bucket_idx on public.auth_rate_limit (bucket_ts);

-- ──────────────────────────────────────────────────────────────────────────────
-- RLS: profiles = self-read ; webauthn_credentials = self-read ;
-- everything else service-role only.
-- ──────────────────────────────────────────────────────────────────────────────
alter table public.profiles                 enable row level security;
alter table public.auth_site_access         enable row level security;
alter table public.webauthn_credentials     enable row level security;
alter table public.auth_otp_codes           enable row level security;
alter table public.auth_magic_links         enable row level security;
alter table public.auth_totp                enable row level security;
alter table public.auth_events              enable row level security;
alter table public.auth_rate_limit          enable row level security;

drop policy if exists "profiles self read"          on public.profiles;
drop policy if exists "profiles self update"        on public.profiles;
drop policy if exists "webauthn self read"          on public.webauthn_credentials;
drop policy if exists "site_access self read"      on public.auth_site_access;
drop policy if exists "events self read"            on public.auth_events;

create policy "profiles self read"     on public.profiles             for select using (auth.uid() = id);
create policy "profiles self update"   on public.profiles             for update using (auth.uid() = id);
create policy "webauthn self read"     on public.webauthn_credentials for select using (auth.uid() = user_id);
create policy "site_access self read" on public.auth_site_access    for select using (auth.uid() = user_id);
create policy "events self read"       on public.auth_events          for select using (auth.uid() = user_id);

-- Cleanup function (daily cron): expired OTPs, consumed magic links >30d, rate_limit >7d
create or replace function public.auth_cleanup() returns void language sql security definer as $$
  delete from public.auth_otp_codes     where expires_at < now() - interval '1 day';
  delete from public.auth_magic_links   where (expires_at < now() or consumed_at is not null) and created_at < now() - interval '30 days';
  delete from public.auth_rate_limit    where bucket_ts  < now() - interval '7 days';
$$;

commit;
