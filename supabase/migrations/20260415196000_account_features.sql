-- Account features: email preferences, soft delete, audit log
alter table profiles add column if not exists email_preferences jsonb default '{"newsletter":true,"product_updates":true,"outreach":false}';
alter table profiles add column if not exists deleted_at timestamptz;

create table if not exists account_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event text not null,
  ip inet,
  user_agent text,
  details jsonb,
  created_at timestamptz default now()
);
create index if not exists account_audit_log_user_created_idx on account_audit_log(user_id, created_at desc);

alter table account_audit_log enable row level security;

drop policy if exists "users read own audit" on account_audit_log;
create policy "users read own audit" on account_audit_log
  for select using (auth.uid() = user_id);

-- Service role inserts; users cannot write directly.
