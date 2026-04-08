-- ══════════════════════════════════════════════════════════════
-- Admin Delegates, Refund Tickets & Revenue Events
-- ══════════════════════════════════════════════════════════════

-- Admin délégué: flag sur profiles
alter table profiles add column if not exists is_delegate_admin boolean not null default false;

-- Revenue events (paiements Stripe enregistrés)
create table if not exists revenue_events (
  id               text primary key,
  product          text not null default 'feel-the-gap',
  stripe_event_id  text,
  event_type       text not null,  -- subscription_created, invoice_paid, subscription_cancelled, refund...
  customer_id      text,
  user_id          uuid references profiles(id) on delete set null,
  email            text,
  amount_eur       numeric(10,2) default 0,
  plan             text,
  interval         text,
  metadata         jsonb default '{}',
  created_at       timestamptz default now()
);

create index if not exists idx_re_user     on revenue_events(user_id);
create index if not exists idx_re_customer on revenue_events(customer_id);
create index if not exists idx_re_type     on revenue_events(event_type);
create index if not exists idx_re_created  on revenue_events(created_at desc);

alter table revenue_events enable row level security;
-- Service role only (no public access)

-- ── Tickets de remboursement ──────────────────────────────────────────────────
create table if not exists refund_tickets (
  id              uuid primary key default gen_random_uuid(),
  ticket_number   serial,                    -- numéro lisible
  user_id         uuid not null references profiles(id) on delete cascade,  -- client concerné
  requested_by    uuid not null references profiles(id),  -- admin ou admin délégué
  status          text not null default 'pending',
    -- pending: en attente de validation (admin délégué → super admin)
    -- approved: approuvé par super admin
    -- rejected: refusé
    -- info_requested: super admin demande plus d'infos
    -- completed: remboursement effectué via Stripe
  reason          text not null,             -- raison du remboursement
  months          jsonb not null default '[]',  -- [{month: '2026-03', plan: 'data', amount_eur: 29, stripe_invoice_id: '...'}]
  total_amount_eur numeric(10,2) not null default 0,
  stripe_refund_ids text[] default '{}',     -- IDs des refunds Stripe créés
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_rt_user      on refund_tickets(user_id);
create index if not exists idx_rt_requester on refund_tickets(requested_by);
create index if not exists idx_rt_status    on refund_tickets(status);

alter table refund_tickets enable row level security;
-- Service role only

-- ── Messages de ticket (échanges admin/délégué) ──────────────────────────────
create table if not exists refund_ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references refund_tickets(id) on delete cascade,
  author_id   uuid not null references profiles(id),
  message     text not null,
  action      text,  -- null (commentaire), 'approve', 'reject', 'request_info', 'respond'
  created_at  timestamptz default now()
);

create index if not exists idx_rtm_ticket on refund_ticket_messages(ticket_id);

alter table refund_ticket_messages enable row level security;
-- Service role only
