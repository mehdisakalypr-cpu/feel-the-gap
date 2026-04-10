-- Feel The Gap — Cached business plans (évite de regénérer à chaque visite)
-- Un plan est généré UNE fois avec les 3 modes (import_sell, produce_locally,
-- train_locals), puis filtré à l'affichage selon les modes cochés.

create table if not exists cached_business_plans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  country_iso     text not null,
  -- Liste triée des IDs d'opportunités — sert de clé de cache stable
  opp_ids         text[] not null,
  -- Plan complet JSON { strategies[3], action_plans_by_mode?, shared_sections, ... }
  plan            jsonb not null,
  -- Pourcentage de réduction d'ampleur demandé par l'utilisateur
  -- (option 1 "réduire budget" de la page /funding/scenarios)
  scope_reduction_pct int not null default 0 check (scope_reduction_pct between 0 and 100),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, country_iso, opp_ids)
);

create index if not exists idx_cached_bp_user on cached_business_plans(user_id);
create index if not exists idx_cached_bp_country on cached_business_plans(country_iso);

-- Trigger updated_at (réutilise set_updated_at de la migration funding_platform)
drop trigger if exists trg_cached_bp_updated on cached_business_plans;
create trigger trg_cached_bp_updated before update on cached_business_plans
  for each row execute function set_updated_at();

-- RLS : owner only
alter table cached_business_plans enable row level security;
drop policy if exists "cached_bp_owner" on cached_business_plans;
create policy "cached_bp_owner" on cached_business_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table cached_business_plans is 'Cache des business plans générés (3 modes) par user × pays × opportunités. Évite regénération LLM à chaque visite.';
