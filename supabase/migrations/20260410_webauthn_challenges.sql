-- Store WebAuthn challenges in DB instead of in-memory Map
-- Fixes: challenges lost between serverless function invocations on Vercel
create table if not exists webauthn_challenges (
  user_id   text primary key,
  challenge text not null,
  expires_at timestamptz not null default (now() + interval '5 minutes')
);

-- Auto-cleanup expired challenges
create index if not exists idx_webauthn_challenges_expires on webauthn_challenges(expires_at);

-- No RLS needed — only accessed via service role
alter table webauthn_challenges enable row level security;
