-- Social posting queue consumed by content-publish-cron workflow.
-- One row per (target_saas, platform, post). Status flows pending → publishing → published / failed.

create table if not exists social_post_queue (
  id uuid primary key default gen_random_uuid(),
  target_saas text not null,
  platform text not null,
  video_url text,
  image_url text,
  caption text not null,
  hashtags text[],
  scheduled_for timestamptz,
  slot text,
  status text not null default 'pending',
  attempts int not null default 0,
  last_error text,
  platform_post_id text,
  platform_url text,
  published_at timestamptz,
  job_id text references content_jobs(id) on delete set null,
  created_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb
);

create index if not exists social_post_queue_status_scheduled_idx
  on social_post_queue(status, scheduled_for)
  where status = 'pending';
create index if not exists social_post_queue_target_saas_idx on social_post_queue(target_saas);
create index if not exists social_post_queue_platform_idx on social_post_queue(platform);

alter table social_post_queue enable row level security;
create policy "service_role_all_social_post_queue" on social_post_queue for all using (true);
