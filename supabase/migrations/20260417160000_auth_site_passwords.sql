-- Per-site password isolation (Option C, 2026-04-17).
--
-- WHY: the shared Supabase auth.users.password implicitly mutualized credentials
-- across sites (same email + same password on FTG/CC/OFA/Estate). Decision: one
-- password per (email, site_slug) pair so a compromised credential on one site
-- can NEVER authenticate on another. auth.users still stores the Supabase-side
-- password (we don't touch it — only admin.generateLink is used to materialize
-- a session once the site password is verified).

begin;

create extension if not exists citext;

create table if not exists public.auth_site_passwords (
  email         citext  not null,
  site_slug     text    not null,
  password_hash text    not null,   -- scrypt/bcrypt hash, format "algo$params$salt$hash"
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  primary key (email, site_slug)
);

create index if not exists auth_site_passwords_site_idx
  on public.auth_site_passwords (site_slug);

alter table public.auth_site_passwords enable row level security;
-- service-role-only; clients NEVER read this
-- (no policies = default-deny for all non-service-role access)

commit;
