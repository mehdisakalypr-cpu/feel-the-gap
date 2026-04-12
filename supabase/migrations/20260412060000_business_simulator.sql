-- Business Simulator: scenarios + active agent targets

create table if not exists business_scenarios (
  id uuid primary key default gen_random_uuid(),
  name text,
  product text not null check (product in ('ofa','ftg','estate','shiftdynamics')),
  objective_type text not null check (objective_type in ('mrr','clients','revenue')),
  objective_value numeric not null,
  horizon_days int not null default 30,
  hypotheses_json jsonb not null default '{}'::jsonb,
  results_json jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists agent_targets (
  product text primary key check (product in ('ofa','ftg','estate','shiftdynamics')),
  target_json jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_scenarios_product on business_scenarios (product, created_at desc);

alter table business_scenarios enable row level security;
alter table agent_targets enable row level security;

-- Service role full access (admin dashboards)
drop policy if exists service_all_scenarios on business_scenarios;
create policy service_all_scenarios on business_scenarios for all using (true) with check (true);

drop policy if exists service_all_targets on agent_targets;
create policy service_all_targets on agent_targets for all using (true) with check (true);
