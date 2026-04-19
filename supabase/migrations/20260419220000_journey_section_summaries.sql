-- Feel The Gap — Cached top-10 summaries per (user × country × section)
-- Évite de re-générer le résumé à chaque dépliage de section sur la page synthèse.

create table if not exists journey_section_summaries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  country_iso     text not null,
  section_id      text not null,
  -- Top-10 bullets (texte court, max 200 chars chacun)
  bullets         jsonb not null default '[]'::jsonb,
  -- Métadonnées de génération
  generated_at    timestamptz not null default now(),
  generator       text default 'system',
  unique (user_id, country_iso, section_id)
);

create index if not exists idx_jss_user      on journey_section_summaries(user_id);
create index if not exists idx_jss_country   on journey_section_summaries(country_iso);

alter table journey_section_summaries enable row level security;
drop policy if exists "jss_owner" on journey_section_summaries;
create policy "jss_owner" on journey_section_summaries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table journey_section_summaries is 'Cache des top-10 bullets par section sur la page synthèse. Évite re-génération à chaque dépliage.';
