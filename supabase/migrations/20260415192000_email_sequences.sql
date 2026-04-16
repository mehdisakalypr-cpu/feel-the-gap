-- Email sequences (drip campaigns) for Feel The Gap
-- Onboarding + nurture flows, delivered via Resend, batched by a Vercel cron.

create table if not exists email_sequences (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists email_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid references email_sequences(id) on delete cascade,
  step_order int not null,
  delay_hours int not null,
  subject text not null,
  body_html text not null,
  body_text text,
  active boolean default true,
  unique (sequence_id, step_order)
);

create table if not exists email_sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  sequence_code text not null,
  current_step int default 0,
  next_send_at timestamptz,
  status text default 'active' check (status in ('active','paused','completed','unsubscribed')),
  started_at timestamptz default now(),
  last_sent_at timestamptz,
  unique (user_id, sequence_code)
);

create table if not exists email_sequence_sends (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid references email_sequence_enrollments(id) on delete cascade,
  step_order int not null,
  sent_at timestamptz default now(),
  resend_id text,
  opened_at timestamptz,
  clicked_at timestamptz
);

create index if not exists email_seq_enroll_pending_idx
  on email_sequence_enrollments(status, next_send_at)
  where status = 'active';

create index if not exists email_seq_enroll_user_idx
  on email_sequence_enrollments(user_id);

create index if not exists email_seq_sends_enroll_idx
  on email_sequence_sends(enrollment_id);
