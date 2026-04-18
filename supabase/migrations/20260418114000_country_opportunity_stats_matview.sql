-- Senku RCA 2026-04-18 — /map affichait les SEED_COUNTRIES (20) au lieu des 211 réels.
-- Root cause : /api/countries lisait la VIEW `country_opportunity_stats` qui fait
-- COUNT(*) GROUP BY country_iso sur 938k opportunités → Parallel Seq Scan de 7-8s.
-- Avec la logique retry 3-tour du endpoint, latence 17-20s → client abandonnait
-- la fetch avant que la réponse arrive → fallback SEED 20 pays.
--
-- Fix : materialized view pré-agrégée, refresh nocturne via cron.
-- Perf: 7488ms (live view) → 32ms (matview scan index uniq sur country_iso).

drop materialized view if exists country_opportunity_stats_mv;

create materialized view country_opportunity_stats_mv as
select
  country_iso,
  count(*)::int as opportunity_count,
  max(opportunity_score)::numeric as top_opportunity_score
from opportunities
group by country_iso;

create unique index if not exists country_opportunity_stats_mv_country_iso_idx
  on country_opportunity_stats_mv (country_iso);

grant select on country_opportunity_stats_mv to anon, authenticated;

-- Fonction de rafraîchissement (pourra être appelée par cron Vercel via pg_net, ou endpoint /api/cron/refresh-matview).
create or replace function refresh_country_opportunity_stats_mv()
returns void
language sql
security definer
as $$
  refresh materialized view concurrently country_opportunity_stats_mv;
$$;

grant execute on function refresh_country_opportunity_stats_mv() to service_role;
