-- Dashboard entrepreneur — persist opportunity selections and product sheets
-- per authenticated user. Lets /dashboard render the 4 blocks (opps, products,
-- financing, investment dossiers) without relying on localStorage.

create table if not exists public.user_opp_selections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  country_iso text not null,
  product_slug text,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, opportunity_id)
);

create index if not exists idx_user_opp_selections_user on public.user_opp_selections(user_id);
create index if not exists idx_user_opp_selections_country on public.user_opp_selections(user_id, country_iso);

alter table public.user_opp_selections enable row level security;

drop policy if exists user_opp_selections_owner_select on public.user_opp_selections;
create policy user_opp_selections_owner_select on public.user_opp_selections
  for select using (auth.uid() = user_id);

drop policy if exists user_opp_selections_owner_insert on public.user_opp_selections;
create policy user_opp_selections_owner_insert on public.user_opp_selections
  for insert with check (auth.uid() = user_id);

drop policy if exists user_opp_selections_owner_delete on public.user_opp_selections;
create policy user_opp_selections_owner_delete on public.user_opp_selections
  for delete using (auth.uid() = user_id);


create table if not exists public.user_product_sheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  name text not null,
  tagline text,
  description text,
  country_iso text,
  photos jsonb not null default '[]'::jsonb,
  specs jsonb not null default '{}'::jsonb,
  completion_pct int not null default 0 check (completion_pct between 0 and 100),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create index if not exists idx_user_product_sheets_user on public.user_product_sheets(user_id);

alter table public.user_product_sheets enable row level security;

drop policy if exists user_product_sheets_owner_all on public.user_product_sheets;
create policy user_product_sheets_owner_all on public.user_product_sheets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Touch updated_at on writes
create or replace function public.user_product_sheets_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_user_product_sheets_updated_at on public.user_product_sheets;
create trigger trg_user_product_sheets_updated_at
  before update on public.user_product_sheets
  for each row execute function public.user_product_sheets_touch_updated_at();
