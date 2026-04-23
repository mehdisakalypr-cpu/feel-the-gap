-- Pair aggregate materialized view — fixes statement timeouts on
-- ftg_missing_product_country_{pairs,content} which previously scanned 938k
-- opportunities rows + HashAggregate + Sort on every call (~14s, over 8s limit).
--
-- New approach:
--   1. Materialized view pre-computes aggregates per (product_id, country_iso)
--      → ~31k rows, refresh daily.
--   2. RPCs read from the matview (milliseconds).
--   3. Daily cron refresh via ftg_refresh_pair_agg() called from Vercel cron.

create materialized view if not exists ftg_product_country_pair_agg as
select
  o.product_id,
  o.country_iso,
  max(coalesce(o.opportunity_score, 0)) as max_score,
  sum(coalesce(o.gap_value_usd, 0))     as total_gap,
  count(*)                              as opp_count
from opportunities o
where o.product_id is not null and o.country_iso is not null
group by o.product_id, o.country_iso;

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
create unique index if not exists idx_ftg_pcpa_pk
  on ftg_product_country_pair_agg(product_id, country_iso);

-- Covering index for the ORDER BY used by the RPCs
create index if not exists idx_ftg_pcpa_order
  on ftg_product_country_pair_agg(max_score desc nulls last, total_gap desc nulls last, opp_count desc);

-- Rewrite RPCs to read from the matview (join stays on cache tables for freshness)
create or replace function ftg_missing_product_country_pairs(limit_count int default 500)
returns table(product_id text, country_iso text) language sql stable as $func$
  select p.product_id, p.country_iso
    from ftg_product_country_pair_agg p
    left join ftg_product_country_videos v
      on v.product_id = p.product_id
     and v.country_iso = p.country_iso
     and v.status = 'ready'
   where v.product_id is null
   order by p.max_score desc nulls last, p.total_gap desc nulls last, p.opp_count desc
   limit limit_count;
$func$;

create or replace function ftg_missing_product_country_content(limit_count int default 200, lang_filter text default 'fr')
returns table(product_id text, country_iso text, lang text) language sql stable as $func$
  select p.product_id, p.country_iso, lang_filter::text as lang
    from ftg_product_country_pair_agg p
    left join ftg_product_country_content c
      on c.product_id = p.product_id
     and c.country_iso = p.country_iso
     and c.lang = lang_filter
     and c.status = 'ready'
   where c.product_id is null
   order by p.max_score desc nulls last, p.total_gap desc nulls last, p.opp_count desc
   limit limit_count;
$func$;

-- Refresh helper (called from daily cron /api/cron/refresh-matviews)
create or replace function ftg_refresh_pair_agg()
returns void language sql as $$
  refresh materialized view concurrently ftg_product_country_pair_agg;
$$;

comment on materialized view ftg_product_country_pair_agg is
  'Daily-refreshed aggregates per (product_id, country_iso). Backs missing_product_country_{pairs,content} RPCs — avoids 14s seq scan on opportunities.';
comment on function ftg_refresh_pair_agg is
  'Call daily from cron (refresh-matviews) to keep pair aggregates current after new scout ingestion.';
