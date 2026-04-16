-- Custom password reset OTP flow (bypass Supabase default SMTP).
-- OTP 6-digit code + 10min TTL + single-use.

create table if not exists password_reset_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,              -- sha256 of the 6-digit OTP
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  used_at timestamptz,
  attempts int not null default 0
);

create index if not exists idx_reset_otps_email on password_reset_otps (email, created_at desc);
create index if not exists idx_reset_otps_expires on password_reset_otps (expires_at);

-- No RLS — accessed only by server-side admin clients.
alter table password_reset_otps enable row level security;
-- Policy "nothing" — falls through (no policy = no access for anon/auth)

-- Cleanup RPC : remove expired/used rows > 24h (called by cron or on-demand)
create or replace function cleanup_reset_otps()
returns void language sql as $$
  delete from password_reset_otps
  where (used_at is not null or expires_at < now())
    and created_at < now() - interval '24 hours';
$$;
