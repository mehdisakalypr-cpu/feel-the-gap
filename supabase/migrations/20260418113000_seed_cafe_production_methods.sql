-- Seed Production 3.0 — Café (MVP pilote)
-- 6 méthodes : 3 traitements post-récolte (washed/natural/honey) + 3 échelles torréfaction (artisanal/semi/industriel)
-- Ressources + métriques (coût/temps/qualité/capex/opex) + médias d'illustration.
-- Schéma défini par 20260417220000_production_methods.sql.
-- Idempotent via ON CONFLICT (product_slug, name).

do $$
declare
  washed_id     uuid;
  natural_id    uuid;
  honey_id      uuid;
  roast_art_id  uuid;
  roast_semi_id uuid;
  roast_ind_id  uuid;
begin
  -- ═══════════ 1. WASHED ═══════════
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'cafe',
    'Washed — traitement lavé',
    E'Le grain est dépulpé mécaniquement (disque ou vis) puis fermenté en bac d''eau 12-36h pour dissoudre le mucilage, rincé, et séché sur lits africains ou patios 8-14 jours (12% humidité cible). Standard des cafés de spécialité — clarté aromatique, notes florales et fruits rouges, acidité vive. Consommation eau 10-20 L/kg parchemin.',
    1
  )
  on conflict (product_slug, name) do update set
    description_md = excluded.description_md,
    popularity_rank = excluded.popularity_rank
  returning id into washed_id;

  -- ═══════════ 2. NATURAL ═══════════
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'cafe',
    'Natural — traitement nature',
    E'La cerise entière (pulpe + mucilage + parche) est séchée au soleil 20-30 jours sur patios ou lits surélevés, retournée 3-5 fois/jour. Une fois la cerise craquante, le grain est extrait mécaniquement. Zéro consommation d''eau — adapté zones arides (Éthiopie, Yémen, Brésil). Profil : corps ample, sucres concentrés, notes fruits rouges mûrs / vin / chocolat.',
    2
  )
  on conflict (product_slug, name) do update set
    description_md = excluded.description_md,
    popularity_rank = excluded.popularity_rank
  returning id into natural_id;

  -- ═══════════ 3. HONEY ═══════════
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'cafe',
    'Honey — traitement miel (semi-washed)',
    E'Dépulpage mécanique sans fermentation — le grain sèche avec son mucilage collant (d''où le nom "miel"). Trois niveaux : white honey (≤25% mucilage), yellow/red honey (50%), black honey (100%). Séchage 10-20 jours avec brassage fréquent pour éviter moisissures. Compromis entre washed (propre) et natural (intensité) — notes miel, sucre brun, fruits compotés. Signature Costa Rica, El Salvador.',
    3
  )
  on conflict (product_slug, name) do update set
    description_md = excluded.description_md,
    popularity_rank = excluded.popularity_rank
  returning id into honey_id;

  -- ═══════════ 4. ROAST ARTISANAL ═══════════
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'cafe',
    'Torréfaction artisanale (micro-lot)',
    E'Torréfacteurs tambour 1-15 kg/batch (Probat P-series, Giesen W-series, Loring S7). Profil de chauffe contrôlé manuellement par l''opérateur (feu bois, gaz ou électrique), 12-18 min par cycle. Courbe de température suivie au thermocouple + logiciel (Cropster, Artisan). Traçabilité lot/origine/date pour cafés de spécialité (SCA ≥ 80 pts). Consommation énergétique 1.2-1.8 kWh/kg.',
    4
  )
  on conflict (product_slug, name) do update set
    description_md = excluded.description_md,
    popularity_rank = excluded.popularity_rank
  returning id into roast_art_id;

  -- ═══════════ 5. ROAST SEMI ═══════════
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'cafe',
    'Torréfaction semi-industrielle (30-120 kg/batch)',
    E'Torréfacteurs automatisés avec recettes pré-programmées (Probat P-30/P-60, IMF RM series). Cycles 10-14 min, 4-6 batches/h. Refroidissement forcé par air pulsé, dégazage sous silo 12-48h avant conditionnement. Analyse qualité par lot (densité Agtron, taux humidité résiduelle). Consommation énergétique 0.8-1.2 kWh/kg. Rendement 18-24% (pertes masse lors torréfaction).',
    5
  )
  on conflict (product_slug, name) do update set
    description_md = excluded.description_md,
    popularity_rank = excluded.popularity_rank
  returning id into roast_semi_id;

  -- ═══════════ 6. ROAST INDUSTRIAL ═══════════
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'cafe',
    'Torréfaction industrielle continue (>500 kg/h)',
    E'Torréfacteurs continus à flux tubulaire (Neuhaus Neotec RFB 1500, Probat Neptune) — flash-roast 4-8 min sous azote ou air chaud. Process contrôlé par PLC, recette figée pour volumes. Refroidissement cryogénique (CO2) optionnel pour préserver arômes. Destiné grandes marques (Lavazza, Illy, Nestlé, Starbucks). Coût énergétique 0.4-0.7 kWh/kg, rendement 22-25%. Non adapté aux nuances de spécialité.',
    6
  )
  on conflict (product_slug, name) do update set
    description_md = excluded.description_md,
    popularity_rank = excluded.popularity_rank
  returning id into roast_ind_id;

  -- ═══════════ RESOURCES ═══════════
  -- Delete existing for these methods then re-insert (idempotent)
  delete from public.method_resources where method_id in (washed_id, natural_id, honey_id, roast_art_id, roast_semi_id, roast_ind_id);

  insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint) values
    (washed_id, 'machine',  'Dépulpeuse à disques 500 kg/h', 3500, 'Penagos (CO), McKinnon (CR)'),
    (washed_id, 'machine',  'Bacs fermentation béton 2×4 m', 1200, 'Constructeur local béton'),
    (washed_id, 'machine',  'Lits africains séchage 20×2 m', 2800, 'Artisan local + filet moustiquaire'),
    (washed_id, 'material', 'Eau potable 10-20 L/kg parchemin', 0.05, 'Réseau municipal ou source'),

    (natural_id, 'machine',  'Patio béton 100-500 m² cimenté', 4500, 'Construction locale'),
    (natural_id, 'machine',  'Ratissoirs bois (retournement)', 120, 'Artisan local'),
    (natural_id, 'machine',  'Égreneuse post-séchage 300 kg/h', 2200, 'Penagos, Pinhalense (BR)'),
    (natural_id, 'material', 'Bâches plastique UV pluie/rosée', 850, 'Local / import Chine'),

    (honey_id, 'machine',  'Dépulpeuse sans eau 400 kg/h', 4200, 'Penagos HD-4, McKinnon'),
    (honey_id, 'machine',  'Lits africains surélevés 15×2 m', 2100, 'Artisan local'),
    (honey_id, 'machine',  'Hygromètre numérique grain', 180, 'Digi-Sense, Agraf'),

    (roast_art_id, 'machine',  'Probat P12-2 (12 kg/batch)', 78000, 'Probat Cologne (DE)'),
    (roast_art_id, 'machine',  'Logiciel profilage Cropster (annuel)', 890, 'Cropster.com'),
    (roast_art_id, 'machine',  'Agtron SCM-IV analyse colorimétrique', 12500, 'Agtron (US)'),
    (roast_art_id, 'material', 'Café vert spécialité SCA 85+', 8.5, 'Importeurs directs (Cafe Imports)'),

    (roast_semi_id, 'machine',  'Probat P60-2 (60 kg/batch)', 220000, 'Probat (DE)'),
    (roast_semi_id, 'machine',  'Silo dégazage 500 kg × 4', 18000, 'Buhler, Probat'),
    (roast_semi_id, 'machine',  'Conditionnement automatique one-way valve', 42000, 'Kolbus, Mespack'),
    (roast_semi_id, 'material', 'Café vert mix commodity + origin', 4.2, 'Volcafe, ECOM, Sucafina'),

    (roast_ind_id, 'machine',  'Neuhaus Neotec RFB 1500 (1500 kg/h)', 1850000, 'Neuhaus Neotec (DE)'),
    (roast_ind_id, 'machine',  'Ligne conditionnement 120 caps/min', 680000, 'IMA, GEA'),
    (roast_ind_id, 'machine',  'Refroidisseur CO2 cryogénique', 125000, 'Air Liquide, Linde'),
    (roast_ind_id, 'material', 'Café vert commodity bulk', 3.6, 'Louis Dreyfus, ECOM');

  -- ═══════════ METRICS ═══════════
  insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit) values
    (washed_id,     65, 0.5, 88,    7500, 0.45),
    (natural_id,    85, 1.0, 82,    6800, 0.18),
    (honey_id,      75, 0.7, 86,    6500, 0.28),
    (roast_art_id,  40, 0.1, 92,   91390, 1.20),
    (roast_semi_id, 65, 0.1, 82,  280000, 0.55),
    (roast_ind_id,  85, 0.1, 70, 2655000, 0.18)
  on conflict (method_id) do update set
    cost_score = excluded.cost_score,
    time_months = excluded.time_months,
    quality_score = excluded.quality_score,
    capex_eur = excluded.capex_eur,
    opex_eur_per_unit = excluded.opex_eur_per_unit,
    updated_at = now();

  -- ═══════════ MEDIA ═══════════
  delete from public.method_media where method_id in (washed_id, natural_id, honey_id, roast_art_id, roast_semi_id, roast_ind_id);

  insert into public.method_media (method_id, type, url, caption) values
    (washed_id,     'image', 'https://images.unsplash.com/photo-1611854779393-1b2da9d400fe?w=1200', 'Lit africain de séchage — café washed'),
    (washed_id,     'image', 'https://images.unsplash.com/photo-1559525839-d9acfd388ac3?w=1200',  'Bacs fermentation washed'),
    (natural_id,    'image', 'https://images.unsplash.com/photo-1599572078543-9d4ed45069b4?w=1200', 'Cerises entières en séchage naturel sur patio'),
    (natural_id,    'image', 'https://images.unsplash.com/photo-1623073538780-a2b66b7378ab?w=1200', 'Ratissage des cerises sur patio'),
    (honey_id,      'image', 'https://images.unsplash.com/photo-1610889556528-9a770e32642f?w=1200', 'Grain avec mucilage — traitement honey'),
    (roast_art_id,  'image', 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=1200', 'Torréfacteur artisanal Probat P12'),
    (roast_art_id,  'image', 'https://images.unsplash.com/photo-1621495064048-38c1e48afa73?w=1200', 'Courbe torréfaction sur logiciel Cropster'),
    (roast_semi_id, 'image', 'https://images.unsplash.com/photo-1587734005433-8a5b2f8d6a2a?w=1200', 'Probat P60 — torréfaction semi-industrielle'),
    (roast_ind_id,  'image', 'https://images.unsplash.com/photo-1523362289600-a70b4a0e09aa?w=1200', 'Ligne continue industrielle Neuhaus Neotec');
end $$;
