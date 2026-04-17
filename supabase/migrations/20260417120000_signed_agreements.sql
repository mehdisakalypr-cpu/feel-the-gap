-- Signed agreements — FTG ContractGate evidence store.
-- Captures one row per signed subscription/account agreement, with SHA256 hash of the
-- exact rendered document body, IP, UA, time-on-doc, and typed-signature text.
-- Retention: 10 years (FR commerce code L123-22). Enforce via external scheduled job.

create table if not exists public.signed_agreements (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid references auth.users(id) on delete set null,
  email                  text not null,
  product                text not null default 'ftg',                      -- ftg | ofa | ...
  plan                   text not null,                                    -- data | strategy | premium | account_signup | ...
  agreement_version      text not null,                                    -- pinned in lib/contracts-ftg.ts
  agreement_hash_sha256  text not null,                                    -- hash of canonical template body
  body_hash_sha256       text not null,                                    -- hash of the exact HTML/markdown shown to the user
  ip                     text,
  user_agent             text,
  time_on_doc_ms         integer,
  total_time_on_page_ms  integer,
  scroll_completed       boolean not null default false,
  signature_text         text not null,                                    -- typed name (min 3 chars)
  acceptance_method      text not null default 'typed_signature',
  purchase_intent        jsonb default '{}'::jsonb,
  email_sent_at          timestamptz,
  email_message_id       text,
  signed_at              timestamptz not null default now()
);

create index if not exists signed_agreements_user_idx    on public.signed_agreements(user_id);
create index if not exists signed_agreements_email_idx   on public.signed_agreements(email);
create index if not exists signed_agreements_product_idx on public.signed_agreements(product, plan);
create index if not exists signed_agreements_signed_idx  on public.signed_agreements(signed_at desc);

alter table public.signed_agreements enable row level security;

-- Authenticated users may read only their own signed agreements.
drop policy if exists signed_agreements_select_own on public.signed_agreements;
create policy signed_agreements_select_own
  on public.signed_agreements
  for select
  to authenticated
  using (user_id = auth.uid());

-- Writes are service_role only (route /api/contracts/accept uses SUPABASE_SERVICE_ROLE_KEY).
-- No policy for insert/update/delete => blocked for anon/authenticated.

comment on table public.signed_agreements is
  'ContractGate evidence store — FTG subscription/account agreements. Service-role write, RLS-read-own. 10y retention.';
