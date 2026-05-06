-- Content Engine tables for GitHub Actions workflow management
-- Tables: content_jobs, content_libraries, library_items

create table if not exists content_jobs (
  id text primary key,
  workflow text not null,
  mode text,
  status text not null default 'queued',
  inputs jsonb,
  triggered_by text,
  github_run_url text,
  artifacts_path text,
  created_at timestamptz default now(),
  finished_at timestamptz
);

create table if not exists content_libraries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  cover_url text,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists library_items (
  id uuid primary key default gen_random_uuid(),
  library_id uuid references content_libraries(id) on delete cascade,
  job_id text references content_jobs(id) on delete cascade,
  variant_id text,
  media_url text not null,
  caption text,
  persona text,
  target_saas text,
  added_at timestamptz default now(),
  unique(library_id, job_id, variant_id)
);

create index if not exists content_jobs_status_idx on content_jobs(status);
create index if not exists content_jobs_created_at_idx on content_jobs(created_at desc);
create index if not exists library_items_library_idx on library_items(library_id);
create index if not exists library_items_job_idx on library_items(job_id);

alter table content_jobs enable row level security;
alter table content_libraries enable row level security;
alter table library_items enable row level security;

create policy "service_role_all_content_jobs" on content_jobs for all using (true);
create policy "service_role_all_content_libraries" on content_libraries for all using (true);
create policy "service_role_all_library_items" on library_items for all using (true);
