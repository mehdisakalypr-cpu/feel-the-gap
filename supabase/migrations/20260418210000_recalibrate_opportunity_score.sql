-- Recalibrage opportunity_score — user feedback 2026-04-18
-- Problème : distribution brute LLM très biaisée vers le haut (17k ops à 95, 50k à 90)
-- → lecture du rapport impossible (tous les pays sont "excellents")
-- Solution : composite percent_rank sur gap_value_usd (70%) + opp_score LLM original (30%),
-- remappé sur la plage 40-100 pour garder le signal "pas tout est bon".

-- Sauvegarde du score LLM original (idempotent)
alter table public.opportunities add column if not exists opportunity_score_llm int;

-- Backup avant overwrite (une seule fois)
update public.opportunities
set opportunity_score_llm = opportunity_score
where opportunity_score_llm is null;

-- Recalibrage en une seule transaction
with ranked as (
  select
    id,
    percent_rank() over (order by coalesce(gap_value_usd, 0))             as pr_gap,
    percent_rank() over (order by coalesce(opportunity_score_llm, 50))    as pr_llm
  from public.opportunities
), calibrated as (
  select
    id,
    greatest(40, least(100, round(40 + 60 * (0.70 * pr_gap + 0.30 * pr_llm))::int)) as new_score
  from ranked
)
update public.opportunities o
set opportunity_score = c.new_score
from calibrated c
where o.id = c.id
  and o.opportunity_score is distinct from c.new_score;

-- Index pour tri rapide sur le nouveau score
create index if not exists idx_opportunities_score_desc
  on public.opportunities (opportunity_score desc)
  where opportunity_score is not null;

comment on column public.opportunities.opportunity_score is
  'Score calibré 40-100 via percent_rank composite (gap 70% + LLM 30%). Remappé 2026-04-18.';
comment on column public.opportunities.opportunity_score_llm is
  'Score LLM brut original avant calibrage — conservé pour audit/recalcul.';
