-- Allow business_plans without an associated opportunity (e.g. enriched_3_scenarios pilots).
alter table public.business_plans
  alter column opportunity_id drop not null;
