-- Marketplace email idempotency flags — Vague 1 #2 · 2026-04-18
-- Évite d'envoyer plusieurs fois les emails transactionnels marketplace.

alter table public.marketplace_matches
  add column if not exists new_match_email_sent_at timestamptz,
  add column if not exists confirmed_email_sent_at timestamptz,
  add column if not exists released_email_sent_at  timestamptz;
