-- Feel The Gap — Funding & Investment Platform
-- Phase 1: dossiers d'analyse financement/investissement + offres

-- 1. Role column on profiles
do $$ begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('entrepreneur', 'financeur', 'investisseur');
  end if;
end $$;

alter table profiles add column if not exists role user_role not null default 'entrepreneur';
create index if not exists idx_profiles_role on profiles(role);

-- 2. Budget saisi + scénarios choisis par l'entrepreneur
create table if not exists user_budgets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  country_iso     text not null,
  product_slug    text,
  business_plan_id uuid references business_plans(id) on delete set null,
  budget_eur      numeric not null check (budget_eur >= 0),
  required_eur    numeric,                       -- budget requis par le plan
  shortfall_eur   numeric generated always as (greatest(required_eur - budget_eur, 0)) stored,
  -- Options cochées sur la page /funding/scenarios
  selected_options text[] not null default '{}', -- ['reduce_scope','financement','investissement']
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_user_budgets_user on user_budgets(user_id);
create index if not exists idx_user_budgets_country on user_budgets(country_iso);

-- 3. Dossiers d'analyse (financement OU investissement)
do $$ begin
  if not exists (select 1 from pg_type where typname = 'dossier_type') then
    create type dossier_type as enum ('financement', 'investissement');
  end if;
  if not exists (select 1 from pg_type where typname = 'dossier_status') then
    create type dossier_status as enum ('draft', 'submitted', 'under_review', 'matched', 'archived');
  end if;
end $$;

create table if not exists funding_dossiers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  user_budget_id  uuid references user_budgets(id) on delete set null,
  business_plan_id uuid references business_plans(id) on delete set null,
  type            dossier_type not null,
  title           text not null,                 -- ex: "Cacao — CIV (financement 45k€)"
  country_iso     text,
  product_slug    text,
  amount_eur      numeric not null check (amount_eur > 0),
  status          dossier_status not null default 'draft',
  -- Structure de sections + questions générée par l'agent
  structure       jsonb not null default '{"sections":[]}'::jsonb,
  -- Réponses de l'utilisateur (merged avec structure pour rendu)
  answers         jsonb not null default '{}'::jsonb,
  completion_pct  int not null default 0 check (completion_pct between 0 and 100),
  -- Scoring qualité du dossier (calculé plus tard)
  quality_score   int,
  -- Affichage anonymisé pour financeurs/investisseurs tant que non premium
  public_number   int, -- "Dossier #1", "#2", attribué à la soumission
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  submitted_at    timestamptz
);
create index if not exists idx_funding_dossiers_user on funding_dossiers(user_id);
create index if not exists idx_funding_dossiers_type_status on funding_dossiers(type, status);
create index if not exists idx_funding_dossiers_country on funding_dossiers(country_iso);

-- 4. Offres de financement (de la part des financeurs)
do $$ begin
  if not exists (select 1 from pg_type where typname = 'offer_status') then
    create type offer_status as enum ('draft', 'sent', 'accepted', 'declined', 'withdrawn');
  end if;
end $$;

create table if not exists funding_offers (
  id              uuid primary key default gen_random_uuid(),
  dossier_id      uuid not null references funding_dossiers(id) on delete cascade,
  financeur_id    uuid not null references auth.users(id) on delete cascade,
  amount_eur      numeric not null check (amount_eur > 0),
  interest_rate_pct numeric check (interest_rate_pct >= 0),
  duration_months int check (duration_months > 0),
  has_insurance   boolean not null default false,
  fees_eur        numeric,
  message         text,
  contact_requested boolean not null default false,
  status          offer_status not null default 'draft',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_funding_offers_dossier on funding_offers(dossier_id);
create index if not exists idx_funding_offers_financeur on funding_offers(financeur_id);

-- 5. Offres d'investissement (de la part des investisseurs)
create table if not exists investor_offers (
  id              uuid primary key default gen_random_uuid(),
  dossier_id      uuid not null references funding_dossiers(id) on delete cascade,
  investor_id     uuid not null references auth.users(id) on delete cascade,
  -- % capital demandé (curseur 0-33)
  pct_capital     numeric not null check (pct_capital between 0 and 33),
  -- Valorisation calculée par la plateforme
  platform_valuation_eur numeric not null,
  -- Valo imposée par l'entrepreneur (si refus valo plateforme)
  user_valuation_eur numeric,
  valuation_warning_flagged boolean not null default false,
  amount_eur      numeric not null,              -- pct_capital * retained valuation
  message         text,
  contact_requested boolean not null default false,
  status          offer_status not null default 'draft',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_investor_offers_dossier on investor_offers(dossier_id);
create index if not exists idx_investor_offers_investor on investor_offers(investor_id);

-- 6. Triggers updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_user_budgets_updated on user_budgets;
create trigger trg_user_budgets_updated before update on user_budgets
  for each row execute function set_updated_at();

drop trigger if exists trg_funding_dossiers_updated on funding_dossiers;
create trigger trg_funding_dossiers_updated before update on funding_dossiers
  for each row execute function set_updated_at();

drop trigger if exists trg_funding_offers_updated on funding_offers;
create trigger trg_funding_offers_updated before update on funding_offers
  for each row execute function set_updated_at();

drop trigger if exists trg_investor_offers_updated on investor_offers;
create trigger trg_investor_offers_updated before update on investor_offers
  for each row execute function set_updated_at();

-- 7. Sequence pour public_number (attribué à la soumission)
create sequence if not exists funding_dossiers_public_number_seq start 1;

-- 8. RLS
alter table user_budgets enable row level security;
alter table funding_dossiers enable row level security;
alter table funding_offers enable row level security;
alter table investor_offers enable row level security;

-- user_budgets: owner only
drop policy if exists "user_budgets_owner" on user_budgets;
create policy "user_budgets_owner" on user_budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- funding_dossiers:
--  - entrepreneur (owner) : full access
--  - financeur : read-only sur dossiers soumis type=financement (data masquée côté API si non-premium)
--  - investisseur : read-only sur dossiers soumis type=investissement
drop policy if exists "funding_dossiers_owner" on funding_dossiers;
create policy "funding_dossiers_owner" on funding_dossiers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "funding_dossiers_financeur_read" on funding_dossiers;
create policy "funding_dossiers_financeur_read" on funding_dossiers
  for select using (
    status in ('submitted','under_review','matched')
    and type = 'financement'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'financeur')
  );

drop policy if exists "funding_dossiers_investor_read" on funding_dossiers;
create policy "funding_dossiers_investor_read" on funding_dossiers
  for select using (
    status in ('submitted','under_review','matched')
    and type = 'investissement'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'investisseur')
  );

-- funding_offers: financeur owner + dossier entrepreneur read
drop policy if exists "funding_offers_financeur_own" on funding_offers;
create policy "funding_offers_financeur_own" on funding_offers
  for all using (auth.uid() = financeur_id) with check (auth.uid() = financeur_id);

drop policy if exists "funding_offers_dossier_owner_read" on funding_offers;
create policy "funding_offers_dossier_owner_read" on funding_offers
  for select using (
    exists (select 1 from funding_dossiers d where d.id = dossier_id and d.user_id = auth.uid())
  );

-- investor_offers: investor owner + dossier entrepreneur read
drop policy if exists "investor_offers_investor_own" on investor_offers;
create policy "investor_offers_investor_own" on investor_offers
  for all using (auth.uid() = investor_id) with check (auth.uid() = investor_id);

drop policy if exists "investor_offers_dossier_owner_read" on investor_offers;
create policy "investor_offers_dossier_owner_read" on investor_offers
  for select using (
    exists (select 1 from funding_dossiers d where d.id = dossier_id and d.user_id = auth.uid())
  );

comment on table user_budgets is 'Budget saisi par l''entrepreneur + options de résolution de manque de trésorerie';
comment on table funding_dossiers is 'Dossiers d''analyse financement ou investissement, structure/réponses en jsonb';
comment on table funding_offers is 'Offres de financement faites par les financeurs sur un dossier';
comment on table investor_offers is 'Offres d''investissement faites par les investisseurs sur un dossier';
