-- Feature flags — simple admin-togglable flags for hiding empty/unfinished journeys.
create table if not exists public.feature_flags (
  key          text primary key,
  enabled      boolean not null default false,
  label        text not null,
  description  text,
  category     text not null default 'nav',
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id) on delete set null
);

alter table public.feature_flags enable row level security;

-- Anyone can read flags (public nav decisions)
drop policy if exists "feature_flags_read_all" on public.feature_flags;
create policy "feature_flags_read_all" on public.feature_flags for select using (true);

-- Only service_role can write (API admin route uses service_role)
-- Admin user updates go through /api/admin/features/[key] which uses service_role.

-- Seed flags — all empty journeys default OFF
insert into public.feature_flags (key, enabled, label, description, category) values
  ('farming',    false, 'Farming',    'Section /farming — scan automatique de produits à prospecter.', 'nav'),
  ('influencer', false, 'Influencer', 'Section /influencer — pipeline influenceurs.',                   'nav'),
  ('seller',     false, 'Seller',     'Section /seller — mini-boutique revendeur.',                     'nav'),
  ('training',   false, 'Training',   'Section /training — cours vidéo et formation.',                  'nav'),
  ('funding',    true,  'Funding',    'Section /funding — dossiers de financement.',                    'nav'),
  ('invest',     true,  'Invest',     'Section /invest — opportunités d''investissement.',              'nav')
on conflict (key) do nothing;
