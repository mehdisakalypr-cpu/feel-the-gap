-- FTG Ad Factory — 2026-04-18
-- Pipeline : Drive assets → Seedance + HeyGen + ElevenLabs + FFmpeg → Supabase Storage
-- Prefix ftg_ad_* pour éviter collision avec ad_variants existant (OFA).

create table if not exists public.ftg_ad_projects (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid,
  name              text not null,
  description       text,
  drive_folder_url  text,
  brief             jsonb not null default '{}'::jsonb,
  status            text not null default 'draft' check (status in ('draft','assets_ingested','ready','archived')),
  image_refs        jsonb default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.ftg_ad_variants (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.ftg_ad_projects(id) on delete cascade,
  lang        text not null,
  vo_script   jsonb not null default '{}'::jsonb,
  hero_name   text,
  product     text,
  country_iso text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_ftg_ad_variants_project on public.ftg_ad_variants(project_id);

create table if not exists public.ftg_ad_render_jobs (
  id             uuid primary key default gen_random_uuid(),
  variant_id     uuid not null references public.ftg_ad_variants(id) on delete cascade,
  status         text not null default 'queued',
  progress_pct   int not null default 0,
  segments       jsonb not null default '[]'::jsonb,
  voice_url      text,
  final_mp4_url  text,
  duration_s     numeric,
  cost_eur       numeric,
  error          text,
  started_at     timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_ftg_ad_jobs_variant on public.ftg_ad_render_jobs(variant_id);

alter table public.ftg_ad_projects enable row level security;
alter table public.ftg_ad_variants enable row level security;
alter table public.ftg_ad_render_jobs enable row level security;

drop policy if exists ftg_ad_p_service on public.ftg_ad_projects;
create policy ftg_ad_p_service on public.ftg_ad_projects for all using (true) with check (true);
drop policy if exists ftg_ad_v_service on public.ftg_ad_variants;
create policy ftg_ad_v_service on public.ftg_ad_variants for all using (true) with check (true);
drop policy if exists ftg_ad_j_service on public.ftg_ad_render_jobs;
create policy ftg_ad_j_service on public.ftg_ad_render_jobs for all using (true) with check (true);

comment on table public.ftg_ad_projects is 'FTG Ad Factory — projets scénario source';
comment on table public.ftg_ad_variants is 'FTG Ad Factory — variants langue+protagoniste+produit';
comment on table public.ftg_ad_render_jobs is 'FTG Ad Factory — jobs pipeline rendu vidéo';
