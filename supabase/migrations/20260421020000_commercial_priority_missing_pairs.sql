-- Commercial priority ordering for Eishi Layer 1 + Rock Lee v2 RPCs.
-- Previous version returned pairs alphabetically → low-traffic markets (Aruba,
-- Afghanistan) were filled before high-value ones (USA, China).
--
-- New ordering: SUM(gap_value_usd) DESC per pair. Top commercial markets
-- (vehicles × USA, pharma × USA, semiconductors × China, …) get filled first.
-- Expected impact: top 500 pairs cover ~80% of real user traffic and now
-- land in cache within the first 1-2 days of cron execution.

create index if not exists idx_opp_product_country_gap
  on opportunities(product_id, country_iso, gap_value_usd);

create or replace function ftg_missing_product_country_pairs(limit_count int default 500)
returns table(product_id text, country_iso text) language sql stable as $func$
  with pair_value as (
    select o.product_id, o.country_iso,
           sum(coalesce(o.gap_value_usd, 0)) as total_gap,
           count(*) as opp_count
      from opportunities o
     where o.product_id is not null and o.country_iso is not null
     group by o.product_id, o.country_iso
  )
  select p.product_id, p.country_iso
    from pair_value p
    left join ftg_product_country_videos v
      on v.product_id = p.product_id and v.country_iso = p.country_iso
   where v.product_id is null
   order by p.total_gap desc nulls last, p.opp_count desc
   limit limit_count;
$func$;

create or replace function ftg_missing_product_country_content(limit_count int default 200, lang_filter text default 'fr')
returns table(product_id text, country_iso text, lang text) language sql stable as $func$
  with pair_value as (
    select o.product_id, o.country_iso,
           lang_filter::text as lang,
           sum(coalesce(o.gap_value_usd, 0)) as total_gap,
           count(*) as opp_count
      from opportunities o
     where o.product_id is not null and o.country_iso is not null
     group by o.product_id, o.country_iso
  )
  select p.product_id, p.country_iso, p.lang
    from pair_value p
    left join ftg_product_country_content c
      on c.product_id = p.product_id and c.country_iso = p.country_iso and c.lang = p.lang
   where c.product_id is null
   order by p.total_gap desc nulls last, p.opp_count desc
   limit limit_count;
$func$;
