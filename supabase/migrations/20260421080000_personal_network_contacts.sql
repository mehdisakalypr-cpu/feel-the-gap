-- Personal network contacts — Shaka 2026-04-21
--
-- User importe ses contacts LinkedIn persos (CSV export ou Phantombuster).
-- Il exclut ceux qu'il ne veut PAS approcher (amis, famille, clients, concurrents).
-- Le reste alimente une persona LinkedIn dédiée (alex/maria/thomas) qui démarche.
-- User invisible dans le flow — persona envoie comme cold contact (ou "connection of connection").

create table if not exists public.personal_network_contacts (
  id                 uuid primary key default gen_random_uuid(),
  owner_profile_id   uuid not null references public.profiles(id) on delete cascade,

  -- Données LinkedIn import
  linkedin_url       text,
  linkedin_public_id text,            -- slug profil ex "john-doe-123456"
  full_name          text not null,
  first_name         text,
  last_name          text,
  headline           text,
  company            text,
  position           text,
  location           text,
  connected_on       date,
  email              text,            -- si présent dans export Linkedin My Network
  phone              text,
  raw_csv_row        jsonb default '{}'::jsonb,

  -- Exclusion explicite
  excluded           boolean default false,
  exclude_reason     text check (exclude_reason in (
    'family', 'friend', 'client', 'competitor', 'sensitive',
    'already_contacted', 'opt_out', 'other'
  )),
  excluded_at        timestamptz,
  excluded_by        uuid references public.profiles(id),
  exclude_notes      text,

  -- Routing vers persona outreach
  assigned_persona   text check (assigned_persona in ('alex', 'maria', 'thomas', null)),
  assignment_reason  text,              -- "founder-match" | "trader-match" | "corp-match" | "manual"

  -- Statut outreach
  outreach_status    text default 'pending' check (outreach_status in (
    'pending', 'queued', 'contacted', 'replied', 'converted', 'opted_out', 'bounced'
  )),
  last_contact_at    timestamptz,
  last_contact_persona text,
  reply_at           timestamptz,

  -- Metadata
  tags               text[] default '{}',
  notes              text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  unique (owner_profile_id, linkedin_url)
);

create index if not exists idx_pnc_owner on public.personal_network_contacts(owner_profile_id);
create index if not exists idx_pnc_status on public.personal_network_contacts(outreach_status) where excluded = false;
create index if not exists idx_pnc_persona on public.personal_network_contacts(assigned_persona) where excluded = false;
create index if not exists idx_pnc_excluded on public.personal_network_contacts(excluded);

-- RLS : chaque user voit uniquement ses propres contacts
alter table public.personal_network_contacts enable row level security;

drop policy if exists pnc_owner_read on public.personal_network_contacts;
create policy pnc_owner_read on public.personal_network_contacts
  for select using (owner_profile_id = auth.uid() or exists (
    select 1 from profiles p where p.id = auth.uid() and p.is_admin
  ));

drop policy if exists pnc_owner_write on public.personal_network_contacts;
create policy pnc_owner_write on public.personal_network_contacts
  for all using (owner_profile_id = auth.uid() or exists (
    select 1 from profiles p where p.id = auth.uid() and p.is_admin
  ));

-- Trigger auto-timestamp
create or replace function public.touch_pnc() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

drop trigger if exists trg_touch_pnc on public.personal_network_contacts;
create trigger trg_touch_pnc before update on public.personal_network_contacts
  for each row execute function public.touch_pnc();

-- Vue dispatch-ready : contacts non-exclus, groupés par persona suggérée
create or replace view public.v_warm_network_ready as
select
  c.id,
  c.owner_profile_id,
  c.full_name,
  c.company,
  c.headline,
  c.linkedin_url,
  c.email,
  coalesce(c.assigned_persona, (
    case
      when c.headline ilike any (array['%CEO%','%founder%','%co-founder%','%entrepreneur%']) then 'maria'
      when c.headline ilike any (array['%trader%','%investor%','%VC%','%analyst%','%data%']) then 'alex'
      when c.headline ilike any (array['%procurement%','%purchasing%','%buyer%','%director%','%head of%']) then 'thomas'
      else 'maria'
    end
  )) as persona,
  c.outreach_status,
  c.last_contact_at,
  c.tags
from personal_network_contacts c
where c.excluded = false
  and c.outreach_status in ('pending', 'queued');

comment on table personal_network_contacts is
  'User''s personal LinkedIn network — imported CSV or via Phantombuster. User excludes sensitive contacts. Rest fed to outreach persona (alex/maria/thomas). User invisible as sender.';
