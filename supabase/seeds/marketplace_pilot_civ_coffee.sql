-- FTG Marketplace — seed pilote Café Côte d'Ivoire (2026-04-18)
-- 10 producteurs simulés (CIV, robusta, volumes 500kg → 5t, mix certifs)
-- + 3 acheteurs simulés (transformateur FR, torréfacteur DE, trader NL)
-- Objectif : valider le matcher E2E sur un dataset réaliste.

-- Nettoyage idempotent du seed (cibleur : notes commence par '[pilot-civ-coffee]')
delete from public.marketplace_matches
where volume_id in (select id from public.production_volumes where notes like '[pilot-civ-coffee]%')
   or demand_id in (select id from public.buyer_demands      where notes like '[pilot-civ-coffee]%');
delete from public.production_volumes where notes like '[pilot-civ-coffee]%';
delete from public.buyer_demands      where notes like '[pilot-civ-coffee]%';

-- ─── 10 volumes producteurs CIV robusta ─────────────────────────────────────
insert into public.production_volumes
  (producer_id, country_iso, product_slug, product_label, quantity_kg, quality_grade, certifications, floor_price_eur_per_kg, incoterm, available_from, available_until, notes, status)
values
  (null, 'CIV', 'cafe', 'Café robusta CIV — Coopérative Yamoussoukro',   2500, 'standard',  ARRAY['fairtrade']::text[],                              1.85, 'FOB', current_date, current_date + interval '90 days', '[pilot-civ-coffee] coop-yamo', 'open'),
  (null, 'CIV', 'cafe', 'Café robusta CIV — Producteur Daloa',            800, 'grade_2',   ARRAY[]::text[],                                         1.60, 'FOB', current_date, current_date + interval '60 days', '[pilot-civ-coffee] solo-daloa', 'open'),
  (null, 'CIV', 'cafe', 'Café robusta CIV — Coop San-Pédro',             5000, 'premium',   ARRAY['organic','fairtrade','rainforest_alliance']::text[], 2.40, 'FOB', current_date, current_date + interval '120 days','[pilot-civ-coffee] coop-sp', 'open'),
  (null, 'CIV', 'cafe', 'Café robusta CIV — Coop Gagnoa',                1500, 'standard',  ARRAY['utz']::text[],                                    1.70, 'FOB', current_date, current_date + interval '90 days', '[pilot-civ-coffee] coop-gag', 'open'),
  (null, 'CIV', 'cafe', 'Café robusta CIV — Coop Man (washed)',          3200, 'specialty', ARRAY['organic','rainforest_alliance']::text[],          2.80, 'FOB', current_date + interval '15 days', current_date + interval '150 days','[pilot-civ-coffee] coop-man-washed', 'open'),
  (null, 'CIV', 'cafe', 'Café robusta CIV — Producteur Abengourou',       500, 'commercial',ARRAY[]::text[],                                         1.45, 'EXW', current_date, current_date + interval '45 days', '[pilot-civ-coffee] solo-abengourou', 'open'),
  (null, 'CIV', 'cafe', 'Café robusta CIV — Coop Divo',                  2200, 'grade_1',   ARRAY['fairtrade','utz']::text[],                        2.10, 'FOB', current_date, current_date + interval '90 days', '[pilot-civ-coffee] coop-divo', 'open'),
  (null, 'CIV', 'cafe', 'Café robusta CIV — Coop Bouaflé',               1200, 'standard',  ARRAY['fairtrade']::text[],                              1.75, 'FOB', current_date, current_date + interval '75 days', '[pilot-civ-coffee] coop-bouafle', 'open'),
  (null, 'CIV', 'cafe', 'Café robusta CIV — Coop Soubré (bio)',          4200, 'premium',   ARRAY['organic','fairtrade']::text[],                    2.55, 'CIF', current_date + interval '30 days', current_date + interval '180 days','[pilot-civ-coffee] coop-soubre-bio', 'open'),
  (null, 'CIV', 'cafe', 'Café robusta CIV — Producteur Aboisso',        1000,  'grade_2',   ARRAY[]::text[],                                         1.55, 'FOB', current_date, current_date + interval '60 days', '[pilot-civ-coffee] solo-aboisso', 'open');

-- ─── 3 demandes acheteurs ───────────────────────────────────────────────────
insert into public.buyer_demands
  (buyer_id, product_slug, product_label, quantity_kg_min, quantity_kg_max, quality_grade, required_certifications, ceiling_price_eur_per_kg, incoterm, origin_country_whitelist, delivery_country_iso, deadline, notes, status)
values
  -- Transformateur FR — volume moyen, quality standard, fairtrade requis, ceiling raisonnable
  (null, 'cafe', 'Café vert robusta pour torréfaction artisanale',
    1000, 3000, 'standard',
    ARRAY['fairtrade']::text[],
    2.20, 'FOB',
    ARRAY['CIV','GHA','CMR','UGA']::text[],
    'FRA', current_date + interval '90 days',
    '[pilot-civ-coffee] torrefacteur-fr', 'open'),

  -- Torréfacteur DE premium — volume haut, specialty required, bio + rainforest
  (null, 'cafe', 'Café vert spécialité pour torréfacteur artisanal DE',
    2500, 5000, 'specialty',
    ARRAY['organic','rainforest_alliance']::text[],
    3.10, 'CIF',
    ARRAY['CIV','ETH','PER','COL']::text[],
    'DEU', current_date + interval '120 days',
    '[pilot-civ-coffee] torrefacteur-de', 'open'),

  -- Trader NL — gros volume, grade_1+, pas de certifs obligatoires, ceiling serré
  (null, 'cafe', 'Café vert robusta gros volume — trader B2B',
    5000, 20000, 'grade_1',
    ARRAY[]::text[],
    2.30, 'FOB',
    ARRAY['CIV','VNM','IDN','BRA']::text[],
    'NLD', current_date + interval '180 days',
    '[pilot-civ-coffee] trader-nl', 'open');
