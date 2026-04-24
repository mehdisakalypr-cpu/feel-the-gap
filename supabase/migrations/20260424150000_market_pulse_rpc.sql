-- Market Pulse RPC — surface indicative trade volumes from opportunities matview.
-- No fake seed data: we surface REAL aggregated trade flows (Comtrade/FAO sourced)
-- to populate marketplace landing with honest liquidity signals.
--
-- Why: feedback_no_flattery_rigor + feedback_ofa_visits_not_clients require
-- transparent data provenance. Fake seed volumes would frustrate real buyers
-- and risk legal/ethical issues.
--
-- Perf: reads ftg_product_country_pair_agg matview (5ms) + small joins on
-- products + countries lookup tables (both <300 rows).

create or replace function ftg_market_pulse_top(
  limit_count int default 20,
  country_filter text default null,
  category_filter text default null
)
returns table(
  product_id text,
  product_label text,
  country_iso text,
  country_name text,
  flag text,
  category text,
  indicative_gap_usd numeric,
  opportunity_count int,
  max_opportunity_score int
) language sql stable as $func$
  select
    p.product_id,
    coalesce(pr.name_fr, pr.name, p.product_id)::text as product_label,
    p.country_iso,
    coalesce(co.name_fr, co.name, p.country_iso)::text as country_name,
    coalesce(co.flag, '')::text as flag,
    coalesce(pr.category::text, 'other')::text as category,
    p.total_gap::numeric as indicative_gap_usd,
    p.opp_count::int as opportunity_count,
    coalesce(p.max_score, 0)::int as max_opportunity_score
  from ftg_product_country_pair_agg p
  left join products pr on pr.id = p.product_id
  left join countries co on co.id = p.country_iso
  where p.total_gap > 0
    and (country_filter is null or p.country_iso = country_filter)
    and (category_filter is null or pr.category::text = category_filter)
  order by coalesce(p.max_score, 0) desc, p.total_gap desc
  limit limit_count;
$func$;

-- Public read: marketplace landing must work for anonymous visitors
grant execute on function ftg_market_pulse_top(int, text, text) to anon, authenticated;

comment on function ftg_market_pulse_top is
  'Market Pulse — indicative trade volumes from opportunities matview. Used to populate marketplace landing with real liquidity signals (no fake seed). Always transparent: ''Indicative — source Comtrade''.';
