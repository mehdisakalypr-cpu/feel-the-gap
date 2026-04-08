-- Add demo/billing columns to profiles
-- is_billed: false = plan gratuit (démo), true = plan facturé via Stripe
-- demo_expires_at: date d'expiration du plan démo (null = pas d'expiration)
-- is_admin: flag administrateur

alter table profiles add column if not exists is_billed boolean not null default true;
alter table profiles add column if not exists demo_expires_at timestamptz;
alter table profiles add column if not exists is_admin boolean not null default false;
alter table profiles add column if not exists full_name text;

-- Index pour recherche admin
create index if not exists idx_profiles_email on profiles(email);
create index if not exists idx_profiles_is_admin on profiles(is_admin) where is_admin = true;

-- Policy: admin peut lire tous les profils via service_role (déjà bypass RLS)
-- Pas besoin de policy spécifique, le service_role key bypass RLS
