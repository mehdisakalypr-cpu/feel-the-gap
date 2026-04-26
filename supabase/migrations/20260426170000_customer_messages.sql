-- Unified customer messages pipeline for the SaaS portfolio.
-- All sites' /api/contact write here. CC dashboard /admin/customer-messages
-- drafts AI replies (Claude), supports inline edit + bulk approve & send.
-- Internal addresses contact.saas@gapup.io / dpo.saas@gapup.io are NEVER
-- exposed publicly — clients always use forms.

create table if not exists public.customer_messages (
  id              uuid primary key default gen_random_uuid(),
  product_slug    text not null,                    -- aici / aiplb / ancf / ftg / ofa / ...
  type            text not null default 'contact',  -- contact / dpo / rgpd / partnership / press
  customer_id     uuid,                             -- nullable, FK to authenticated user
  name            text,
  email           text not null,
  phone           text,
  company         text,
  subject         text,
  message         text not null,
  metadata        jsonb default '{}'::jsonb,        -- { url, locale, user_agent, source }
  received_at     timestamptz not null default now(),
  ai_draft        text,
  ai_classification text,                            -- sales / support / rgpd / spam / other
  ai_confidence   numeric(3,2),                      -- 0.00 - 1.00
  draft_status    text not null default 'pending'
    check (draft_status in ('pending','draft_ready','approved','sent','discarded','failed')),
  approved_by     text,                              -- admin email
  sent_at         timestamptz,
  replied_at      timestamptz,
  thread_id       uuid,                              -- groups initial + replies (default = id)
  parent_id       uuid references public.customer_messages(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists customer_messages_product_status_idx
  on public.customer_messages (product_slug, draft_status, received_at desc);

create index if not exists customer_messages_thread_idx
  on public.customer_messages (thread_id, received_at);

create index if not exists customer_messages_email_idx
  on public.customer_messages (email);

create index if not exists customer_messages_customer_idx
  on public.customer_messages (customer_id);

-- Auto thread_id (initial message = its own thread root)
create or replace function public.customer_messages_set_thread()
returns trigger language plpgsql as $$
begin
  if new.thread_id is null and new.parent_id is null then
    new.thread_id := new.id;
  elsif new.thread_id is null and new.parent_id is not null then
    select thread_id into new.thread_id from public.customer_messages where id = new.parent_id;
  end if;
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists customer_messages_thread_trigger on public.customer_messages;
create trigger customer_messages_thread_trigger
  before insert or update on public.customer_messages
  for each row execute function public.customer_messages_set_thread();

-- Atomic claim for the AI drafter: pick 1 pending row, mark draft-in-progress
create or replace function public.claim_pending_message()
returns table (
  id uuid, product_slug text, type text, customer_id uuid,
  name text, email text, phone text, company text,
  subject text, message text, metadata jsonb, received_at timestamptz
) language plpgsql as $$
begin
  return query
  update public.customer_messages m
  set draft_status = 'pending', updated_at = now()
  where m.id = (
    select m2.id from public.customer_messages m2
    where m2.draft_status = 'pending'
      and m2.ai_draft is null
    order by m2.received_at asc
    limit 1
    for update skip locked
  )
  returning m.id, m.product_slug, m.type, m.customer_id,
            m.name, m.email, m.phone, m.company,
            m.subject, m.message, m.metadata, m.received_at;
end$$;

alter table public.customer_messages enable row level security;

drop policy if exists customer_messages_service on public.customer_messages;
create policy customer_messages_service on public.customer_messages
  for all to service_role using (true) with check (true);

grant usage on schema public to anon, authenticated, service_role;
grant all on public.customer_messages to anon, authenticated, service_role;
grant execute on function public.claim_pending_message to anon, authenticated, service_role;

-- Register the new cron in cron_registry
insert into public.cron_registry (cron_name, schedule, expected_interval_s, alert_after_s, host, repo, description)
values ('customer-messages-draft', '*/5 * * * *', 300, 1200, 'vercel', 'command-center',
  'Drafts AI replies for new customer_messages — Claude Sonnet')
on conflict (cron_name) do update set
  schedule = excluded.schedule, expected_interval_s = excluded.expected_interval_s,
  alert_after_s = excluded.alert_after_s, host = excluded.host, repo = excluded.repo,
  description = excluded.description, active = true;

notify pgrst, 'reload schema';
