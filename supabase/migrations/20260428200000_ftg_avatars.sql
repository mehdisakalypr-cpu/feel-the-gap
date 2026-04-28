-- Persistent avatar library for content engine.
-- Stores reference faces for cross-post identity consistency.

create table if not exists ftg_avatars (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  persona text not null,
  target_saas text,
  prompt_token text not null,
  description text,
  ref_url text not null,
  seed bigint not null,
  used_count int not null default 0,
  last_used_at timestamptz,
  created_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb
);

create index if not exists ftg_avatars_persona_idx on ftg_avatars(persona);
create index if not exists ftg_avatars_target_saas_idx on ftg_avatars(target_saas);

create table if not exists ftg_avatar_uses (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references ftg_avatars(id) on delete cascade,
  job_id text references content_jobs(id) on delete set null,
  output_url text,
  prompt text,
  created_at timestamptz default now()
);

create index if not exists ftg_avatar_uses_avatar_idx on ftg_avatar_uses(avatar_id);
create index if not exists ftg_avatar_uses_created_at_idx on ftg_avatar_uses(created_at desc);

alter table ftg_avatars enable row level security;
alter table ftg_avatar_uses enable row level security;

create policy "service_role_all_ftg_avatars" on ftg_avatars for all using (true);
create policy "service_role_all_ftg_avatar_uses" on ftg_avatar_uses for all using (true);
