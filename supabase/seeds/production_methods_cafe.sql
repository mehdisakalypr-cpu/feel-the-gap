-- Production 3.0 — Seed MVP Café
-- Idempotent: supprime les données cafe existantes avant insertion
delete from public.production_methods where product_slug = 'cafe';

-- =========================================================================
-- 1) NATURAL (cerise séchée entière)
-- =========================================================================
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'cafe',
    'Procédé Natural (séchage cerise entière)',
    E'Le procédé **natural** (ou "dry process") consiste à sécher la cerise de café entière au soleil, sans enlever la pulpe. C''est la méthode la plus ancienne, pratiquée en Éthiopie et au Brésil.\n\nLe séchage dure 2 à 4 semaines sur des lits africains ou des patios. Le sucre de la pulpe fermente et imprègne le grain, donnant un profil fruité, sirupeux, avec des notes de baies rouges et de fruits tropicaux. Faible besoin en eau (avantage majeur zones arides), mais qualité hétérogène si séchage mal maîtrisé.',
    1
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 80, 1.0, 60, 3000.00, 0.35 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Lits africains de séchage (200m²)', 2500.00, 'Fabrication locale bois/grillage' from public.production_methods where product_slug='cafe' and name='Procédé Natural (séchage cerise entière)'
union all
select id, 'machine', 'Humidimètre grain (Dickey-John mini GAC)', 400.00, 'Dickey-John / Agriexpert' from public.production_methods where product_slug='cafe' and name='Procédé Natural (séchage cerise entière)'
union all
select id, 'material', 'Cerises de café fraîches (1 tonne)', 800.00, 'Coopératives locales Éthiopie/Brésil' from public.production_methods where product_slug='cafe' and name='Procédé Natural (séchage cerise entière)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=1200', 'Cerises de café séchant sur lits africains' from public.production_methods where product_slug='cafe' and name='Procédé Natural (séchage cerise entière)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=UjV3W7qJc2U', 'Natural process — ferme éthiopienne' from public.production_methods where product_slug='cafe' and name='Procédé Natural (séchage cerise entière)';

-- =========================================================================
-- 2) WASHED (dépulpage + fermentation humide)
-- =========================================================================
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'cafe',
    'Procédé Washed (lavé, fermentation humide)',
    E'Le procédé **washed** dépulpe la cerise mécaniquement, puis fait fermenter les grains en cuve d''eau 12 à 36h pour dissoudre le mucilage. Le grain est ensuite lavé, trié par densité et séché.\n\nC''est la méthode reine de la spécialité : profil propre, acidité vive, flaveurs florales et agrumes. Très répandue en Amérique centrale, Colombie, Kenya. Consommation d''eau élevée (40-150 L/kg) — nécessite gestion des effluents.',
    2
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 50, 0.75, 85, 15000.00, 0.55 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Dépulpeuse mécanique Penagos UCBE-500', 4500.00, 'Penagos Hermanos (Colombie)' from public.production_methods where product_slug='cafe' and name='Procédé Washed (lavé, fermentation humide)'
union all
select id, 'machine', 'Cuves de fermentation béton (3x2m³)', 6000.00, 'Maçonnerie locale' from public.production_methods where product_slug='cafe' and name='Procédé Washed (lavé, fermentation humide)'
union all
select id, 'material', 'Réservoir eau + pompe circulation', 2500.00, 'Grundfos / Pedrollo' from public.production_methods where product_slug='cafe' and name='Procédé Washed (lavé, fermentation humide)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=1200', 'Grains en cuve de fermentation washed' from public.production_methods where product_slug='cafe' and name='Procédé Washed (lavé, fermentation humide)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=8_BYR9s-VBI', 'Washed process — Colombie' from public.production_methods where product_slug='cafe' and name='Procédé Washed (lavé, fermentation humide)';

-- =========================================================================
-- 3) HONEY (semi-washed, mucilage conservé)
-- =========================================================================
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'cafe',
    'Procédé Honey (semi-lavé, mucilage conservé)',
    E'Le procédé **honey** (ou "pulped natural") dépulpe mais conserve tout ou partie du mucilage (miel) autour du grain lors du séchage. Selon le % conservé, on parle de white/yellow/red/black honey.\n\nCompromis entre natural et washed : corps doux du natural + propreté du washed. Sucrosité, notes miel, fruits à noyau. Popularisé au Costa Rica depuis 2008. Consommation d''eau réduite vs washed.',
    3
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 65, 0.85, 75, 10000.00, 0.45 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Dépulpeuse sans démucilageur', 3800.00, 'Penagos / McKinnon' from public.production_methods where product_slug='cafe' and name='Procédé Honey (semi-lavé, mucilage conservé)'
union all
select id, 'machine', 'Patios béton de séchage (300m²)', 4500.00, 'Construction locale' from public.production_methods where product_slug='cafe' and name='Procédé Honey (semi-lavé, mucilage conservé)'
union all
select id, 'material', 'Bâches UV + rateaux inox retournement', 600.00, 'Agriplast / quincaillerie agricole' from public.production_methods where product_slug='cafe' and name='Procédé Honey (semi-lavé, mucilage conservé)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1580933073521-dc49ac0d4e6a?w=1200', 'Grains honey en séchage sur patio' from public.production_methods where product_slug='cafe' and name='Procédé Honey (semi-lavé, mucilage conservé)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=pZWzfbGhDIQ', 'Honey process — Costa Rica' from public.production_methods where product_slug='cafe' and name='Procédé Honey (semi-lavé, mucilage conservé)';

-- =========================================================================
-- 4) TORRÉFACTION ARTISANALE
-- =========================================================================
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'cafe',
    'Torréfaction artisanale (tambour 5-15 kg)',
    E'**Torréfaction artisanale** sur torréfacteur à tambour rotatif de 5 à 15 kg par batch, chauffage gaz, contrôle manuel de la courbe (temp, air, gaz). Durée 10-15 min, first crack ~9 min, développement 15-25%.\n\nQualité maximale : chaque batch est profilé selon l''origine et le niveau de cuisson visé (filtre/espresso). Permet cuissons claires Scandinaves, fiches de traçabilité, lots micro (single origin). Volume : 20-200 kg/jour par torréfacteur.',
    4
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 70, 0.02, 90, 5000.00, 1.20 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Torréfacteur tambour 5kg (Probat Probatino / Has Garanti)', 4500.00, 'Probat / Has Garanti / Diedrich' from public.production_methods where product_slug='cafe' and name='Torréfaction artisanale (tambour 5-15 kg)'
union all
select id, 'machine', 'Logiciel profilage Artisan + sonde bean probe', 350.00, 'artisan-scope.org (open source) + Phidgets' from public.production_methods where product_slug='cafe' and name='Torréfaction artisanale (tambour 5-15 kg)'
union all
select id, 'material', 'Cafés verts spécialité (sac 60kg)', 450.00, 'Belco / Cafe Import / Mercanta' from public.production_methods where product_slug='cafe' and name='Torréfaction artisanale (tambour 5-15 kg)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1442550528053-c431ecb55509?w=1200', 'Torréfacteur artisanal à tambour' from public.production_methods where product_slug='cafe' and name='Torréfaction artisanale (tambour 5-15 kg)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=Ih0iuiQYeRY', 'Profil de torréfaction artisanale' from public.production_methods where product_slug='cafe' and name='Torréfaction artisanale (tambour 5-15 kg)';

-- =========================================================================
-- 5) TORRÉFACTION SEMI-INDUSTRIELLE
-- =========================================================================
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'cafe',
    'Torréfaction semi-industrielle (30-60 kg)',
    E'**Torréfaction semi-industrielle** sur torréfacteur 30-60 kg, gaz ou mixte, souvent avec post-combustion (dépollution fumées). Profils automatisés mais supervisés, reproductibilité serrée pour grandes séries (blends supermarché spécialisé, HoReCa).\n\nCapacité 300-800 kg/jour. Compromis qualité/volume : permet de servir des chaînes cafés ou la distribution premium avec homogénéité lot à lot. Nécessite conformité ICPE + post-brûleur.',
    5
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 55, 0.015, 78, 50000.00, 0.70 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Torréfacteur 45kg Probat Probatone ou Loring S35', 45000.00, 'Probat / Loring / Giesen' from public.production_methods where product_slug='cafe' and name='Torréfaction semi-industrielle (30-60 kg)'
union all
select id, 'machine', 'Post-combustion catalytique (dépollution)', 8000.00, 'Probat / CPL Group' from public.production_methods where product_slug='cafe' and name='Torréfaction semi-industrielle (30-60 kg)'
union all
select id, 'material', 'Lot café vert commercial (tonne)', 5500.00, 'Sucafina / ECOM / Volcafe' from public.production_methods where product_slug='cafe' and name='Torréfaction semi-industrielle (30-60 kg)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1611854779393-1b2da9d400fe?w=1200', 'Torréfacteur semi-industriel Loring' from public.production_methods where product_slug='cafe' and name='Torréfaction semi-industrielle (30-60 kg)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=D1gI3d-8xPU', 'Atelier torréfaction 45kg' from public.production_methods where product_slug='cafe' and name='Torréfaction semi-industrielle (30-60 kg)';

-- =========================================================================
-- 6) TORRÉFACTION INDUSTRIELLE
-- =========================================================================
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'cafe',
    'Torréfaction industrielle (lit fluidisé continu 500+ kg/h)',
    E'**Torréfaction industrielle continue** sur lit fluidisé (air chaud) ou tambour géant, débit 500 kg/h à 3 t/h. Systèmes Neuhaus Neotec / Probat Jupiter, PLC Siemens, profils digitaux, traçabilité totale.\n\nCible : grande distribution, capsules, soluble. Cuissons rapides (90-240 s) et homogénéité absolue. Investissement lourd (>500 k€) + ligne complète (silos verts, dégazage, ensachage) souvent >2 M€. Qualité standardisée, peu de nuance sensorielle.',
    6
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 35, 0.01, 55, 500000.00, 0.25 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Ligne torréfaction lit fluidisé 1 t/h (Neuhaus RFB)', 450000.00, 'Neuhaus Neotec / Probat Jupiter' from public.production_methods where product_slug='cafe' and name='Torréfaction industrielle (lit fluidisé continu 500+ kg/h)'
union all
select id, 'machine', 'Silos verts + système pneumatique alimentation', 80000.00, 'Probat / Bühler' from public.production_methods where product_slug='cafe' and name='Torréfaction industrielle (lit fluidisé continu 500+ kg/h)'
union all
select id, 'material', 'Contrat annuel café vert commercial (100 t)', 480000.00, 'ECOM / Volcafe / Olam' from public.production_methods where product_slug='cafe' and name='Torréfaction industrielle (lit fluidisé continu 500+ kg/h)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1497636577773-f1231844b336?w=1200', 'Usine de torréfaction industrielle' from public.production_methods where product_slug='cafe' and name='Torréfaction industrielle (lit fluidisé continu 500+ kg/h)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=GSFQg9nHKi8', 'Ligne industrielle Neuhaus Neotec' from public.production_methods where product_slug='cafe' and name='Torréfaction industrielle (lit fluidisé continu 500+ kg/h)';
