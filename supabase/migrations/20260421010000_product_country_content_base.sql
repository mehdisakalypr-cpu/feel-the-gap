-- Shared BASE layer for LLM content agents, keyed on (product × country × lang).
-- Replaces the per-opportunity duplication for content that's intrinsic to the
-- commodity + market rather than a specific user's market angle.
--
-- Architecture (Eishi hybrid pattern):
--   Layer 1 (this table) = pre-computed BASE, shared across all opps in a pair
--   Layer 2 (ftg_opportunity_content) = per-opp personalization overrides
--   UI merge: base + personalized overrides = final render
--
-- Dedup factor: ~20-25× fewer LLM generations vs the old (opp × country × lang)
-- scheme. Full DB coverage moves from "years" to "weeks".

create table if not exists ftg_product_country_content (
  product_id text not null references products(id) on delete cascade,
  country_iso text not null,
  lang text not null default 'fr',

  -- Base payloads (one jsonb per agent — same shape as per-opp content)
  production_methods jsonb,      -- Shikamaru: generic methods for (product × country)
  business_plans jsonb,          -- Itachi: 3 scenario BPs for the market
  potential_clients jsonb,       -- Hancock: B2B leads in the country for this product

  status text not null default 'pending' check (status in ('pending','generating','ready','stale','failed')),
  generated_at timestamptz,
  stale_at timestamptz,
  cost_eur numeric(10,4) default 0,
  attempt_count int default 0,
  last_error text,
  agent_versions jsonb default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (product_id, country_iso, lang)
);

create index if not exists idx_ftg_pcc_status on ftg_product_country_content (status) where status != 'ready';
create index if not exists idx_ftg_pcc_country_lang on ftg_product_country_content (country_iso, lang) where status = 'ready';

-- Auto-touch updated_at
create or replace function ftg_pcc_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists trg_ftg_pcc_touch on ftg_product_country_content;
create trigger trg_ftg_pcc_touch before update on ftg_product_country_content
for each row execute function ftg_pcc_touch_updated_at();

-- Public read when ready; admin write via service role
alter table ftg_product_country_content enable row level security;

drop policy if exists "public read ready base content" on ftg_product_country_content;
create policy "public read ready base content" on ftg_product_country_content
  for select using (status = 'ready');

-- Queue helper: distinct (product_id, country_iso, lang) triples missing from cache
create or replace function ftg_missing_product_country_content(limit_count int default 200, lang_filter text default 'fr')
returns table(product_id text, country_iso text, lang text) language sql stable as $func$
  with triples as (
    select distinct o.product_id, o.country_iso, lang_filter::text as lang
      from opportunities o
     where o.product_id is not null and o.country_iso is not null
  )
  select t.product_id, t.country_iso, t.lang
    from triples t
    left join ftg_product_country_content c
      on c.product_id = t.product_id and c.country_iso = t.country_iso and c.lang = t.lang
   where c.product_id is null
   limit limit_count;
$func$;

comment on table ftg_product_country_content is
  'Eishi Layer 1 — shared BASE content per (product × country × lang). Opportunity pages read this first, then merge per-opp personalization from ftg_opportunity_content.';
