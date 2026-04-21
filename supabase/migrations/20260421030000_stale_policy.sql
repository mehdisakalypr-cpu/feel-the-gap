-- Stale policy: content ready > 60 days becomes stale and gets re-enqueued by
-- the runners. Keeps the platform fresh without manual intervention.
--
-- Strategy:
--   1. A SQL cron function marks `ready` rows with generated_at < now() - 60d
--      as `stale` (keeps the payload so the UI still shows "last known"
--      content while a fresh one generates).
--   2. The ftg_missing_product_country_{pairs,content} RPCs treat `stale`
--      rows as missing (they'll be re-generated on next runner pass).

create or replace function ftg_mark_stale_content(stale_days int default 60)
returns table(cache_name text, rows_marked int) language plpgsql as $$
declare
  v_videos int;
  v_base int;
  v_legacy int;
begin
  -- Videos cache
  update ftg_product_country_videos
     set status = 'stale'
   where status = 'ready'
     and generated_at < now() - (stale_days || ' days')::interval;
  get diagnostics v_videos = row_count;

  -- Layer 1 base content
  update ftg_product_country_content
     set status = 'stale'
   where status = 'ready'
     and generated_at < now() - (stale_days || ' days')::interval;
  get diagnostics v_base = row_count;

  -- Legacy per-opp
  update ftg_opportunity_content
     set status = 'stale'
   where status = 'ready'
     and generated_at < now() - (stale_days || ' days')::interval;
  get diagnostics v_legacy = row_count;

  return query values
    ('ftg_product_country_videos', v_videos),
    ('ftg_product_country_content', v_base),
    ('ftg_opportunity_content', v_legacy);
end;
$$;

-- RPCs now include `stale` rows in the "missing" set (left join where status != 'ready')
create or replace function ftg_missing_product_country_pairs(limit_count int default 500)
returns table(product_id text, country_iso text) language sql stable as $func$
  with pair_value as (
    select o.product_id, o.country_iso,
           max(coalesce(o.opportunity_score, 0)) as max_score,
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
     and v.status = 'ready'
   where v.product_id is null  -- missing, failed, stale, or truly absent
   order by p.max_score desc nulls last, p.total_gap desc nulls last, p.opp_count desc
   limit limit_count;
$func$;

create or replace function ftg_missing_product_country_content(limit_count int default 200, lang_filter text default 'fr')
returns table(product_id text, country_iso text, lang text) language sql stable as $func$
  with pair_value as (
    select o.product_id, o.country_iso,
           lang_filter::text as lang,
           max(coalesce(o.opportunity_score, 0)) as max_score,
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
     and c.status = 'ready'
   where c.product_id is null  -- stale or missing trigger regen
   order by p.max_score desc nulls last, p.total_gap desc nulls last, p.opp_count desc
   limit limit_count;
$func$;

-- Allow the runners to UPSERT on existing stale rows (overwrite). Primary key
-- conflicts on (product_id, country_iso[, lang]) keep the row; status will
-- transition stale → generating → ready on the next run.

comment on function ftg_mark_stale_content is
  'Marks content rows older than N days as stale (default 60). Call via cron daily; stale rows re-enter the missing queue for regen.';
