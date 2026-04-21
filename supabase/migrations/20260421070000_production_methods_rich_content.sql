-- Production Methods v2 — contenu riche (diagrammes, tableaux, graphiques)
-- Session Shaka 2026-04-21 · demande user : "il faut texte images schémas ou/et tableau ou/et graphiques"
--
-- 3 colonnes JSONB ajoutées à production_methods :
--   diagrams_json         : array d'étapes visualisables (svg inline ou ascii flow)
--   comparison_table_json : tableau structuré "cette méthode vs autres" (rows × cols)
--   graph_data_json       : séries de données pour Recharts (bar/line/pie)
--
-- YouTube reste dans method_media type='video' (complément, pas principal).

alter table public.production_methods
  add column if not exists diagrams_json jsonb default '[]'::jsonb,
  add column if not exists comparison_table_json jsonb default '{}'::jsonb,
  add column if not exists graph_data_json jsonb default '{}'::jsonb,
  add column if not exists process_steps_json jsonb default '[]'::jsonb,
  add column if not exists pros_cons_json jsonb default '{"pros":[],"cons":[]}'::jsonb,
  add column if not exists updated_at timestamptz default now();

-- Schéma indicatif des colonnes JSONB (validé par agent method-scribe, pas par CHECK DB)
--
-- diagrams_json : [
--   {
--     "id": "flow-1",
--     "title": "Flux général de transformation",
--     "type": "flow",                -- flow | svg | ascii
--     "svg": "<svg>...</svg>",       -- optionnel si type=svg
--     "ascii": "Cueillette → Séchage → Torréfaction → Mouture",  -- optionnel si type=ascii
--     "nodes": [{"id":"n1","label":"Cueillette"},...],           -- optionnel si type=flow (rendu client)
--     "edges": [{"from":"n1","to":"n2","label":"48h"}]
--   }
-- ]
--
-- comparison_table_json : {
--   "headers": ["Critère", "Cette méthode", "Artisanal", "Industriel"],
--   "rows": [
--     ["Coût /kg (€)", "1.20", "0.80", "2.50"],
--     ["Empreinte eau", "Faible", "Moyenne", "Élevée"]
--   ]
-- }
--
-- graph_data_json : {
--   "type": "bar",                   -- bar | line | pie | radar
--   "xKey": "year",
--   "series": [
--     {"name": "Rendement kg/ha", "dataKey": "yield", "color": "#C9A84C"}
--   ],
--   "data": [
--     {"year": "Y1", "yield": 800},
--     {"year": "Y2", "yield": 1100}
--   ]
-- }
--
-- process_steps_json : [
--   {"order": 1, "title": "Cueillette", "description_md": "...", "duration": "2-3 semaines", "icon": "🌾"},
--   ...
-- ]
--
-- pros_cons_json : {"pros": ["Qualité optimale","Traçable"], "cons": ["Coût main d'œuvre élevé"]}

comment on column public.production_methods.diagrams_json is 'Array de schémas/flux (flow|svg|ascii). Rendu client via DiagramRenderer.';
comment on column public.production_methods.comparison_table_json is 'Tableau comparaison "cette méthode vs autres" (headers + rows).';
comment on column public.production_methods.graph_data_json is 'Données Recharts (type + xKey + series + data).';
comment on column public.production_methods.process_steps_json is 'Étapes ordonnées du process avec titre, description, durée, icône.';
comment on column public.production_methods.pros_cons_json is '{"pros":[...], "cons":[...]} synthèse forces/faiblesses.';

-- Trigger auto-update updated_at
create or replace function public.touch_production_method() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_production_method on public.production_methods;
create trigger trg_touch_production_method
  before update on public.production_methods
  for each row execute function public.touch_production_method();
