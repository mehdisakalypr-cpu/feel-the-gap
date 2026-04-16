-- Crop tutorials + production mode gate (terrain vs serre)
-- Gating leads: user must complete tutorial before seeing potential clients.

create table if not exists crop_tutorials (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  crop_name text not null,
  crop_name_fr text,
  family text,                   -- céréales, légumes, tubercules…
  difficulty smallint not null default 2,  -- 1-5
  duration_days int not null default 90,
  hero_image_url text,
  short_pitch text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crop_tutorial_modes (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null references crop_tutorials(id) on delete cascade,
  mode text not null check (mode in ('terrain', 'serre')),
  yield_kg_ha numeric,
  cost_eur_ha numeric,
  roi_pct numeric,
  water_need_m3_ha numeric,
  description_md text,
  unique (tutorial_id, mode)
);

create table if not exists crop_tutorial_steps (
  id uuid primary key default gen_random_uuid(),
  mode_id uuid not null references crop_tutorial_modes(id) on delete cascade,
  step_order int not null,
  title text not null,
  text_md text not null,
  tts_audio_url text,
  video_url text,
  image_url text,
  duration_minutes int default 5,
  unique (mode_id, step_order)
);

create table if not exists crop_tutorial_quizzes (
  id uuid primary key default gen_random_uuid(),
  mode_id uuid not null references crop_tutorial_modes(id) on delete cascade,
  question text not null,
  choices jsonb not null,        -- array of strings
  correct_idx int not null,
  explanation text,
  display_order int default 0
);

create table if not exists crop_tutorial_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode_id uuid not null references crop_tutorial_modes(id) on delete cascade,
  steps_completed int not null default 0,
  quiz_score_pct int,
  production_plan jsonb,         -- user-submitted plan (surface, volume, calendar…)
  started_at timestamptz default now(),
  completed_at timestamptz,
  unique (user_id, mode_id)
);

create index if not exists idx_progress_user on crop_tutorial_progress (user_id);
create index if not exists idx_progress_completed on crop_tutorial_progress (completed_at);

-- RLS : users read/write only their own progress
alter table crop_tutorial_progress enable row level security;

drop policy if exists "own progress read" on crop_tutorial_progress;
create policy "own progress read" on crop_tutorial_progress
  for select using (auth.uid() = user_id);

drop policy if exists "own progress write" on crop_tutorial_progress;
create policy "own progress write" on crop_tutorial_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Tutorials/modes/steps are public read (paywall is at leads layer, not tutorial)
alter table crop_tutorials enable row level security;
alter table crop_tutorial_modes enable row level security;
alter table crop_tutorial_steps enable row level security;
alter table crop_tutorial_quizzes enable row level security;

drop policy if exists "public read tutorials" on crop_tutorials;
create policy "public read tutorials" on crop_tutorials for select using (true);
drop policy if exists "public read modes" on crop_tutorial_modes;
create policy "public read modes" on crop_tutorial_modes for select using (true);
drop policy if exists "public read steps" on crop_tutorial_steps;
create policy "public read steps" on crop_tutorial_steps for select using (true);
drop policy if exists "public read quizzes" on crop_tutorial_quizzes;
create policy "public read quizzes" on crop_tutorial_quizzes for select using (true);

-- ── RPC : has_completed_tutorial(user, crop_slug)
-- Retourne true si l'user a complété le tutoriel pour AU MOINS une modalité (terrain OU serre)
create or replace function has_completed_tutorial(p_user uuid, p_crop_slug text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from crop_tutorial_progress p
    join crop_tutorial_modes m on m.id = p.mode_id
    join crop_tutorials t on t.id = m.tutorial_id
    where p.user_id = p_user
      and t.slug = p_crop_slug
      and p.completed_at is not null
  );
$$;

-- Seed 10 cultures pilotes (sans steps/quiz — générés par l'agent)
insert into crop_tutorials (slug, crop_name, crop_name_fr, family, difficulty, duration_days, short_pitch) values
  ('oignon',          'Onion',          'Oignon',          'légumes',      2, 120, 'Culture de base, forte demande urbaine, rentabilité rapide'),
  ('mais',            'Maize',          'Maïs',            'céréales',     2, 100, 'Céréale stratégique, marchés locaux + industriels'),
  ('riz',             'Rice',           'Riz',             'céréales',     3, 150, 'Forte consommation AF, irrigation nécessaire'),
  ('tomate',          'Tomato',         'Tomate',          'légumes',      3,  90, 'Demande constante, serre recommandée pour qualité'),
  ('piment',          'Chili pepper',   'Piment',          'légumes',      2,  80, 'Marge élevée, export possible si séché'),
  ('cacao',           'Cocoa',          'Cacao',           'tropicales',   4, 1095,'Long terme, export structuré, filière UE'),
  ('cafe',            'Coffee',         'Café',            'tropicales',   4, 1095,'Commodity premium, traçabilité recherchée'),
  ('arachide',        'Peanut',         'Arachide',        'légumineuses', 2, 120, 'Sahel-friendly, transformation locale'),
  ('manioc',          'Cassava',        'Manioc',          'tubercules',   2, 365, 'Sécurité alimentaire + transformation farine'),
  ('pomme-de-terre',  'Potato',         'Pomme de terre',  'tubercules',   2, 120, 'Marchés urbains, stockage frais requis')
on conflict (slug) do nothing;

-- Seed 2 modalités par culture (terrain + serre)
-- La serre n'a pas de sens pour cacao/café/manioc/arachide → on skippe ces couples
insert into crop_tutorial_modes (tutorial_id, mode, yield_kg_ha, cost_eur_ha, roi_pct, water_need_m3_ha)
select t.id, 'terrain', null, null, null, null from crop_tutorials t
on conflict do nothing;

insert into crop_tutorial_modes (tutorial_id, mode, yield_kg_ha, cost_eur_ha, roi_pct, water_need_m3_ha)
select t.id, 'serre', null, null, null, null from crop_tutorials t
where t.slug in ('tomate', 'piment', 'oignon', 'pomme-de-terre', 'riz')
on conflict do nothing;
