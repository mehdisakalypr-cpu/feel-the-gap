-- FTG — Seed Production 3.0 batch 2 (cacao/textile/anacarde/huile_palme/mangue)
-- Idempotent: supprime puis réinsère (FK cascade sur resources/metrics/media)
delete from public.production_methods where product_slug in ('cacao','textile','anacarde','huile_palme','mangue');

-- =========================================================================
-- ============================ CACAO ======================================
-- =========================================================================

-- 1) Fermentation traditionnelle en tas sous feuilles de bananier
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'cacao',
    'Fermentation traditionnelle en tas (feuilles de bananier)',
    E'La **fermentation en tas** consiste à amonceler les fèves fraîches de cacao (300 kg à 1 tonne) sur un lit de feuilles de bananier, puis à les recouvrir du même matériau. La fermentation dure 5 à 7 jours avec retournement tous les 2 jours (ICCO Technical Manual).\n\nMéthode répandue en Afrique de l''Ouest (Cameroun, RDC) chez les petits producteurs : zéro CAPEX, rendement fermentaire moyen, hétérogénéité lot à lot. Profils souvent plus acides et moins chocolatés — accepté sur le marché standard mais décoté en spécialité (source : FAO cocoa post-harvest guide).',
    1
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 85, 0.23, 55, 200.00, 0.12 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'material', 'Feuilles de bananier fraîches (lot 50 kg)', 30.00, 'Exploitation locale' from public.production_methods where product_slug='cacao' and name='Fermentation traditionnelle en tas (feuilles de bananier)'
union all
select id, 'machine', 'Bâche polyéthylène UV + pelle retournement', 80.00, 'Quincaillerie agricole locale' from public.production_methods where product_slug='cacao' and name='Fermentation traditionnelle en tas (feuilles de bananier)'
union all
select id, 'material', 'Fèves fraîches cacao (1 tonne)', 1800.00, 'Coopérative planteurs Cameroun/RDC' from public.production_methods where product_slug='cacao' and name='Fermentation traditionnelle en tas (feuilles de bananier)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1606913084603-3e7702b01627?w=1200', 'Fèves de cacao en fermentation sous feuilles' from public.production_methods where product_slug='cacao' and name='Fermentation traditionnelle en tas (feuilles de bananier)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=VLS1fi0-hng', 'Fermentation traditionnelle Cameroun' from public.production_methods where product_slug='cacao' and name='Fermentation traditionnelle en tas (feuilles de bananier)';

-- 2) Fermentation en caisses suédoises (Ghana/CI dominant)
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'cacao',
    'Fermentation en caisses suédoises (cascade 3 niveaux)',
    E'Les **caisses suédoises** sont des caissettes en bois dur perforées empilées en cascade. La charge circule de haut en bas (retournement par transfert) tous les 48h, permettant aération et homogénéité (méthode Trinitario diffusée par CRIG Ghana).\n\nDominante en Côte d''Ivoire et Ghana dans les centres de fermentation coopératifs. Fermentation complète en 6 jours, taux de fèves bien fermentées >85%, profil chocolaté plus marqué. CAPEX modéré, main d''œuvre moins intense que les tas — standard de la filière cacao de qualité marchande.',
    2
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 60, 0.20, 78, 2500.00, 0.25 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Caissettes bois dur perforées (set 6 x 300kg)', 1800.00, 'Menuiserie locale Abidjan/Accra' from public.production_methods where product_slug='cacao' and name='Fermentation en caisses suédoises (cascade 3 niveaux)'
union all
select id, 'machine', 'Structure support inox 3 niveaux', 700.00, 'Chaudronnerie locale' from public.production_methods where product_slug='cacao' and name='Fermentation en caisses suédoises (cascade 3 niveaux)'
union all
select id, 'material', 'Sacs jute aération + thermomètres sondes', 120.00, 'Jute Company India / Testo' from public.production_methods where product_slug='cacao' and name='Fermentation en caisses suédoises (cascade 3 niveaux)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=1200', 'Caisses suédoises en cascade' from public.production_methods where product_slug='cacao' and name='Fermentation en caisses suédoises (cascade 3 niveaux)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=hZxJMlC-Rzw', 'Fermentation cacao Côte d''Ivoire' from public.production_methods where product_slug='cacao' and name='Fermentation en caisses suédoises (cascade 3 niveaux)';

-- 3) Séchage solaire au sol (artisanal)
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'cacao',
    'Séchage solaire sur aires bétonnées',
    E'Le **séchage solaire direct** étale les fèves fermentées sur des aires bétonnées ou des bâches, retournées au râteau plusieurs fois par jour. Le passage de 55% à 7% d''humidité prend 6 à 14 jours selon l''ensoleillement (ICCO standards).\n\nEssentiel en Afrique de l''Ouest : rapport coût/qualité imbattable. Risques : contamination MOG (matières étrangères), pluies, fumée. Le séchage trop rapide au soleil direct peut générer un goût acide résiduel. Nécessite une surface minimum de 4 m²/tonne.',
    3
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 80, 0.40, 65, 1500.00, 0.08 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Aire bétonnée séchage (150 m²)', 1200.00, 'Maçonnerie locale' from public.production_methods where product_slug='cacao' and name='Séchage solaire sur aires bétonnées'
union all
select id, 'machine', 'Râteaux inox + bâches polyéthylène', 200.00, 'Quincaillerie agricole' from public.production_methods where product_slug='cacao' and name='Séchage solaire sur aires bétonnées'
union all
select id, 'material', 'Humidimètre portable Dickey-John', 420.00, 'Dickey-John / distributeurs agri' from public.production_methods where product_slug='cacao' and name='Séchage solaire sur aires bétonnées';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1578861256457-da6cdb59de07?w=1200', 'Fèves cacao séchage solaire' from public.production_methods where product_slug='cacao' and name='Séchage solaire sur aires bétonnées'
union all
select id, 'video', 'https://www.youtube.com/watch?v=6F1H9P1r3nk', 'Séchage solaire cacao Afrique' from public.production_methods where product_slug='cacao' and name='Séchage solaire sur aires bétonnées';

-- 4) Séchage mécanique flux d'air
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'cacao',
    'Séchage mécanique à flux d''air chaud',
    E'Le **séchoir mécanique** utilise un brûleur (gaz ou biomasse) et un ventilateur pour faire circuler de l''air chaud (50-55°C max) à travers une masse de fèves. Durée 24-48h contre 7-14 jours en solaire (IFC agribusiness guide).\n\nUtilisé dans les grosses coopératives et plantations industrielles (Indonésie, Brésil). Évite les risques météo, permet la production en saison des pluies, qualité homogène. Attention : températures >60°C génèrent goût fumé/caoutchouc — déclassement. CAPEX élevé mais amortissable dès 50-100 t/an.',
    4
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 45, 0.07, 80, 35000.00, 0.60 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Séchoir statique 2 tonnes/batch (brûleur LPG)', 28000.00, 'Pinhalense / DNP Engineering' from public.production_methods where product_slug='cacao' and name='Séchage mécanique à flux d''air chaud'
union all
select id, 'machine', 'Ventilateur axial + régulation PLC', 4500.00, 'Siemens / Ziehl-Abegg' from public.production_methods where product_slug='cacao' and name='Séchage mécanique à flux d''air chaud'
union all
select id, 'material', 'Combustible LPG annuel (50 t de fèves)', 2500.00, 'TotalEnergies / SHV Energy' from public.production_methods where product_slug='cacao' and name='Séchage mécanique à flux d''air chaud';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1577086664693-894d8405334a?w=1200', 'Séchoir mécanique cacao industriel' from public.production_methods where product_slug='cacao' and name='Séchage mécanique à flux d''air chaud'
union all
select id, 'video', 'https://www.youtube.com/watch?v=Kv8T9YHLtQY', 'Mechanical cocoa dryer operation' from public.production_methods where product_slug='cacao' and name='Séchage mécanique à flux d''air chaud';

-- 5) Torréfaction artisanale cacao petit lot
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'cacao',
    'Torréfaction artisanale bean-to-bar (petit lot 10-30 kg)',
    E'La **torréfaction artisanale** utilise des tambours rotatifs 10-30 kg (Behmor, Probat LN5, Diedrich), chauffés au gaz, durée 15-30 min à 110-135°C (source : Bean-to-Bar Association guidelines).\n\nSegment bean-to-bar premium en explosion : Mast Brothers, Pump Street, Dandelion, et des ateliers African origin (Kokoa Kamili, Sublime Chocolate). Profilage par origine, préservation des arômes fruits rouges/floraux. Volume 50-200 kg/jour. Qualité sensorielle maximale, marge détail 60-75%.',
    5
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 72, 0.03, 92, 8000.00, 1.80 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Torréfacteur tambour 15kg (Probat LN5 / Diedrich IR-12)', 6500.00, 'Probat / Diedrich / Has Garanti' from public.production_methods where product_slug='cacao' and name='Torréfaction artisanale bean-to-bar (petit lot 10-30 kg)'
union all
select id, 'machine', 'Vanneuse-cribleuse (séparation coques)', 1200.00, 'Cocoatown / Premier Industries' from public.production_methods where product_slug='cacao' and name='Torréfaction artisanale bean-to-bar (petit lot 10-30 kg)'
union all
select id, 'material', 'Fèves single-origin premium (sac 60kg)', 520.00, 'Uncommon Cacao / Cocoa Runners / Kokoa Kamili' from public.production_methods where product_slug='cacao' and name='Torréfaction artisanale bean-to-bar (petit lot 10-30 kg)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=1200', 'Torréfaction artisanale cacao bean-to-bar' from public.production_methods where product_slug='cacao' and name='Torréfaction artisanale bean-to-bar (petit lot 10-30 kg)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=1mrGdGMNsv0', 'Bean-to-bar roasting workflow' from public.production_methods where product_slug='cacao' and name='Torréfaction artisanale bean-to-bar (petit lot 10-30 kg)';

-- 6) Torréfaction industrielle cacao
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'cacao',
    'Torréfaction industrielle continue (lignes Barry Callebaut/Bühler)',
    E'**Torréfaction industrielle continue** sur torréfacteurs à lit fluidisé ou nibs-roaster (torréfaction de nibs vs fèves entières), débit 500 kg/h à 3 t/h. Équipements Bühler / Netzsch / Probat PNR.\n\nCible : grands chocolatiers (Barry Callebaut, Cargill, Mondelez, Nestlé) et cacao en poudre industriel (Van Houten, Nederland). Homogénéité garantie, traçabilité complète ERP, CAPEX >2 M€ pour la ligne complète. Profils standard millésime, perte d''arôme vs artisanal mais productivité 50x supérieure.',
    6
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 30, 0.01, 65, 1500000.00, 0.18 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Torréfacteur continu Bühler RoastMaster (1 t/h)', 950000.00, 'Bühler Group / Netzsch / Probat PNR' from public.production_methods where product_slug='cacao' and name='Torréfaction industrielle continue (lignes Barry Callebaut/Bühler)'
union all
select id, 'machine', 'Broyeur à billes + système refroidissement', 280000.00, 'Bühler / Netzsch / FrymaKoruma' from public.production_methods where product_slug='cacao' and name='Torréfaction industrielle continue (lignes Barry Callebaut/Bühler)'
union all
select id, 'material', 'Contrat annuel fèves commerciales (500 t)', 1500000.00, 'Barry Callebaut / Cargill / ECOM' from public.production_methods where product_slug='cacao' and name='Torréfaction industrielle continue (lignes Barry Callebaut/Bühler)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=1200', 'Ligne industrielle cacao Bühler' from public.production_methods where product_slug='cacao' and name='Torréfaction industrielle continue (lignes Barry Callebaut/Bühler)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=2Qol2ZJcCfY', 'Industrial cocoa processing line' from public.production_methods where product_slug='cacao' and name='Torréfaction industrielle continue (lignes Barry Callebaut/Bühler)';


-- =========================================================================
-- ============================ TEXTILE (COTON) ============================
-- =========================================================================

-- 1) Égrenage manuel
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'textile',
    'Égrenage manuel au charkha / tréteau',
    E'L''**égrenage manuel** sépare fibres et graines à la main via un tréteau à rouleaux (charkha indien, tréteau local) ou aux doigts. Rendement : 5-10 kg coton-graine/jour/ouvrier (FAO cotton smallholder guide).\n\nPratiqué chez les petits producteurs béninois, burkinabè, malgaches. Préserve parfaitement la fibre (aucune casse), produit un coton premium pour filature artisanale. Non-viable à l''échelle industrielle : coût main d''œuvre prohibitif. Valeur dans les labels "coton équitable à la main", "slow textile".',
    1
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 88, 0.55, 70, 150.00, 0.95 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Tréteau à rouleaux (charkha bois)', 80.00, 'Artisan menuisier local' from public.production_methods where product_slug='textile' and name='Égrenage manuel au charkha / tréteau'
union all
select id, 'material', 'Coton-graine brut (100 kg)', 110.00, 'Petits producteurs Bénin/Burkina' from public.production_methods where product_slug='textile' and name='Égrenage manuel au charkha / tréteau'
union all
select id, 'material', 'Sacs jute stockage (lot 20)', 45.00, 'Jute India Ltd / fournisseurs locaux' from public.production_methods where product_slug='textile' and name='Égrenage manuel au charkha / tréteau';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?w=1200', 'Charkha égrenage manuel coton' from public.production_methods where product_slug='textile' and name='Égrenage manuel au charkha / tréteau'
union all
select id, 'video', 'https://www.youtube.com/watch?v=o6LrJZTmSQE', 'Traditional cotton ginning by hand' from public.production_methods where product_slug='textile' and name='Égrenage manuel au charkha / tréteau';

-- 2) Égrenage à rouleaux (semi-industriel)
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'textile',
    'Égrenage à rouleaux motorisé (roller gin)',
    E'Le **roller gin** utilise deux rouleaux (caoutchouc/cuir) tournant à vitesse différentielle qui détachent la fibre de la graine sans la couper. Adapté au coton longue-soie (Giza, Pima, ELS). Débit 50-200 kg/h (ICAC handbook).\n\nÉquipe les usines semi-industrielles du Bénin, Mali, Tchad. CAPEX abordable 15-40 k€. Qualité fibre préservée vs saw-gin, idéal pour export textile haut de gamme. Maintenance courante : changement rouleaux tous les 2000h.',
    2
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 55, 0.08, 82, 25000.00, 0.40 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Roller gin Lummus 88 (1 stand)', 18000.00, 'Lummus Corp / Bajaj Steel' from public.production_methods where product_slug='textile' and name='Égrenage à rouleaux motorisé (roller gin)'
union all
select id, 'machine', 'Moteur 15 kW + système extraction', 5500.00, 'Siemens / ABB' from public.production_methods where product_slug='textile' and name='Égrenage à rouleaux motorisé (roller gin)'
union all
select id, 'material', 'Rouleaux rechange caoutchouc (lot annuel)', 2200.00, 'Lummus / Continental Rubber' from public.production_methods where product_slug='textile' and name='Égrenage à rouleaux motorisé (roller gin)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1622215057456-fadc09ed4c8e?w=1200', 'Atelier égrenage semi-industriel' from public.production_methods where product_slug='textile' and name='Égrenage à rouleaux motorisé (roller gin)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=WKHQXxzMhNo', 'Roller ginning process' from public.production_methods where product_slug='textile' and name='Égrenage à rouleaux motorisé (roller gin)';

-- 3) Filature à main
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'textile',
    'Filature à main au rouet / fuseau',
    E'La **filature à main** transforme la fibre lavée en fil via un rouet (spinning wheel) ou un fuseau (drop spindle). Production 50-150 g fil/jour/fileuse. Fil irrégulier avec caractère artisanal (khadi indien, bogolan malien).\n\nRedécouverte dans le haut de gamme "slow fashion" et les coopératives féminines africaines. Valeur premium : 80-200 €/kg de fil (vs 3-5 €/kg industriel). Certifications fairtrade + labels "hand-spun" accessibles, reconnaissance marché Europe/US.',
    3
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 82, 0.90, 72, 250.00, 8.50 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Rouet bois type Ashford / charkha', 180.00, 'Ashford / artisanat local' from public.production_methods where product_slug='textile' and name='Filature à main au rouet / fuseau'
union all
select id, 'material', 'Cardes manuelles + peignes', 60.00, 'Ashford / Louet' from public.production_methods where product_slug='textile' and name='Filature à main au rouet / fuseau'
union all
select id, 'material', 'Coton égrené prêt à filer (10 kg)', 45.00, 'Coopératives bogolan Mali / Bénin' from public.production_methods where product_slug='textile' and name='Filature à main au rouet / fuseau';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1589987607627-616cac5c2c5a?w=1200', 'Filage manuel au rouet traditionnel' from public.production_methods where product_slug='textile' and name='Filature à main au rouet / fuseau'
union all
select id, 'video', 'https://www.youtube.com/watch?v=zR1XUFrL9iQ', 'Hand spinning wheel khadi' from public.production_methods where product_slug='textile' and name='Filature à main au rouet / fuseau';

-- 4) Filature industrielle
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'textile',
    'Filature industrielle open-end / ring-spinning',
    E'La **filature industrielle** utilise des machines ring (fils fins, haute qualité) ou open-end (fils gros, productivité). Lignes complètes Rieter / Trützschler : cardage, étirage, peignage, filature. Débit 500 kg fil/jour/machine.\n\nÉquipe les grosses usines Côte d''Ivoire (COTIVO), Mali (COMATEX), Burkina (Faso Fani). CAPEX 1-5 M€ par ligne complète. Fils homogènes, export Europe/Asie. Rieter leader mondial (CH), Trützschler (DE), Savio (IT). Durée vie machine 15-20 ans.',
    4
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 38, 0.015, 85, 1800000.00, 0.55 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Ring spinning frame Rieter G38 (1008 broches)', 850000.00, 'Rieter / Savio / Toyota Industries' from public.production_methods where product_slug='textile' and name='Filature industrielle open-end / ring-spinning'
union all
select id, 'machine', 'Ligne préparation carde-étirage Trützschler', 650000.00, 'Trützschler / Rieter' from public.production_methods where product_slug='textile' and name='Filature industrielle open-end / ring-spinning'
union all
select id, 'material', 'Contrat coton commercial (500 t fibre)', 950000.00, 'Olam Cotton / Louis Dreyfus / ECOM' from public.production_methods where product_slug='textile' and name='Filature industrielle open-end / ring-spinning';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200', 'Filature industrielle moderne' from public.production_methods where product_slug='textile' and name='Filature industrielle open-end / ring-spinning'
union all
select id, 'video', 'https://www.youtube.com/watch?v=cGm0dU2UE-I', 'Ring spinning industrial line' from public.production_methods where product_slug='textile' and name='Filature industrielle open-end / ring-spinning';

-- 5) Teinture végétale (indigo, bogolan)
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'textile',
    'Teinture végétale naturelle (indigo, bogolan, noix galle)',
    E'La **teinture végétale** utilise des pigments naturels : indigo (Indigofera tinctoria) pour les bleus, bogolan malien (argile fermentée + tanin n''galama) pour les motifs ocre/noir, noix de galle pour brun/noir. Durée bain 6-24h, multiples plongées.\n\nMarché de niche à très forte valeur : teintureries coopératives féminines (Bamako, Kayes, Mopti), labels équitables, collections haut de gamme (Hermès, Marine Serre). Coûts matières faibles mais main d''œuvre intensive. Reconnaissance UNESCO patrimoine immatériel.',
    5
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 75, 0.35, 80, 2000.00, 2.20 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Cuves fermentation indigo céramique (3x200L)', 1200.00, 'Poterie locale / import Asie' from public.production_methods where product_slug='textile' and name='Teinture végétale naturelle (indigo, bogolan, noix galle)'
union all
select id, 'material', 'Feuilles indigo + argile bogolan + n''galama (100 kg mix)', 450.00, 'Coopératives Mali / Burkina' from public.production_methods where product_slug='textile' and name='Teinture végétale naturelle (indigo, bogolan, noix galle)'
union all
select id, 'material', 'Tissu coton écru prêt à teindre (50 m)', 220.00, 'Filature locale COTIVO / COMATEX' from public.production_methods where product_slug='textile' and name='Teinture végétale naturelle (indigo, bogolan, noix galle)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1562887284-b967a99cd2e8?w=1200', 'Teinture indigo artisanale Mali' from public.production_methods where product_slug='textile' and name='Teinture végétale naturelle (indigo, bogolan, noix galle)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=BfJb3YP_9Sw', 'Bogolan natural dye process' from public.production_methods where product_slug='textile' and name='Teinture végétale naturelle (indigo, bogolan, noix galle)';

-- 6) Teinture synthétique industrielle
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'textile',
    'Teinture synthétique industrielle (jet-dyeing réactive)',
    E'La **teinture jet-dyeing réactive** utilise des colorants réactifs (Dystar, Huntsman) dans des machines pressurisées à haute température (jet/overflow). Fixation via liaison covalente avec la cellulose. Consommation eau 80-150 L/kg.\n\nStandard mondial pour la teinture coton industrielle. Pouvoir colorant élevé, large gamme nuances, solidité excellente. Coût environnemental significatif (effluents salés), impose STEP et systèmes de récupération. Machines Thies, Fong''s, Brazzoli. Débit 500-2000 kg textile/jour.',
    6
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 42, 0.02, 78, 450000.00, 0.85 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Jet-dyeing machine Thies iMaster H2O (500 kg)', 280000.00, 'Thies / Fong''s / Brazzoli' from public.production_methods where product_slug='textile' and name='Teinture synthétique industrielle (jet-dyeing réactive)'
union all
select id, 'machine', 'STEP + récupération effluents salés', 120000.00, 'Veolia / Suez' from public.production_methods where product_slug='textile' and name='Teinture synthétique industrielle (jet-dyeing réactive)'
union all
select id, 'material', 'Colorants réactifs Remazol (contrat annuel)', 85000.00, 'Dystar / Huntsman / Archroma' from public.production_methods where product_slug='textile' and name='Teinture synthétique industrielle (jet-dyeing réactive)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1200', 'Teinturerie industrielle jet-dyeing' from public.production_methods where product_slug='textile' and name='Teinture synthétique industrielle (jet-dyeing réactive)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=3bS3jpJmPIM', 'Reactive jet dyeing operation' from public.production_methods where product_slug='textile' and name='Teinture synthétique industrielle (jet-dyeing réactive)';


-- =========================================================================
-- ============================ ANACARDE ===================================
-- =========================================================================

-- 1) Décorticage manuel
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'anacarde',
    'Décorticage manuel (coupe-coque + masque CNSL)',
    E'Le **décorticage manuel** utilise une petite presse à coque avec lames coupantes. Un ouvrier décortique 8-15 kg/jour de noix brutes. Huile de coque (CNSL) caustique — masque, gants, aération obligatoires (African Cashew Alliance guidelines).\n\nPratiqué en Guinée-Bissau, Bénin nord, Côte d''Ivoire (Bondoukou) par les coopératives villageoises. Rendement noix-amande 22-25%, taux de brisures <15%, très peu de whole W180/W240 cassés — prime qualité gourmet. Emploi féminin massif (>80%).',
    1
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 87, 0.30, 78, 500.00, 1.10 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Coupe-coque manuel type Kal (x5 postes)', 380.00, 'Kal India / fabrication locale' from public.production_methods where product_slug='anacarde' and name='Décorticage manuel (coupe-coque + masque CNSL)'
union all
select id, 'machine', 'Équipement EPI (masques, gants nitrile, tabliers)', 120.00, 'Honeywell / Ansell' from public.production_methods where product_slug='anacarde' and name='Décorticage manuel (coupe-coque + masque CNSL)'
union all
select id, 'material', 'Noix cajou brutes (1 tonne RCN)', 1600.00, 'Coopératives Guinée-Bissau / Bénin' from public.production_methods where product_slug='anacarde' and name='Décorticage manuel (coupe-coque + masque CNSL)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?w=1200', 'Décorticage manuel noix cajou' from public.production_methods where product_slug='anacarde' and name='Décorticage manuel (coupe-coque + masque CNSL)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=Yc5YBF6lBVw', 'Manual cashew shelling Benin' from public.production_methods where product_slug='anacarde' and name='Décorticage manuel (coupe-coque + masque CNSL)';

-- 2) Décorticage semi-mécanisé (calage+boucle)
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'anacarde',
    'Décorticage semi-mécanisé (steam + cutting machine Oltremare/Pragati)',
    E'Le **décorticage semi-mécanisé** combine cuisson vapeur des noix (autoclave 100°C, 20-30 min) + machines de coupe à lames jumelles type Oltremare / Pragati. Rendement 40-60 kg/h/poste, main d''œuvre divisée par 4 (ACA technical guide).\n\nStandard en Inde, Vietnam. Déployé depuis 2015 au Togo, Bénin, Sénégal via aides IFC/UEMOA. Taux de wholes W180/W240 70-80% (vs 85% manuel), brisures acceptables. CAPEX 40-80 k€ par ligne semi-complète. Rentabilité dès 200 t/an RCN.',
    2
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 58, 0.12, 80, 60000.00, 0.55 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Autoclave vapeur 500 kg/batch', 18000.00, 'Oltremare / Pragati / Nyle' from public.production_methods where product_slug='anacarde' and name='Décorticage semi-mécanisé (steam + cutting machine Oltremare/Pragati)'
union all
select id, 'machine', 'Cutters semi-auto (x10 postes)', 35000.00, 'Oltremare / Pragati' from public.production_methods where product_slug='anacarde' and name='Décorticage semi-mécanisé (steam + cutting machine Oltremare/Pragati)'
union all
select id, 'material', 'Chaudière vapeur + combustible biomasse annuel', 9500.00, 'Fulton / biomasse locale' from public.production_methods where product_slug='anacarde' and name='Décorticage semi-mécanisé (steam + cutting machine Oltremare/Pragati)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1606751442263-6a8e3ef6f4c8?w=1200', 'Atelier décorticage semi-mécanisé' from public.production_methods where product_slug='anacarde' and name='Décorticage semi-mécanisé (steam + cutting machine Oltremare/Pragati)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=R4mW0G8KpqE', 'Semi-mechanized cashew processing' from public.production_methods where product_slug='anacarde' and name='Décorticage semi-mécanisé (steam + cutting machine Oltremare/Pragati)';

-- 3) Décorticage automatisé (CFO Brésil)
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'anacarde',
    'Décorticage automatisé (ligne continue type CFO / CATIC)',
    E'La **ligne automatisée** enchaîne réception, calibrage, vapeur, décorticage par lames rotatives, séchage, pelage à chaud, tri optique. Systèmes CFO / CATIC / Marel. Débit 1-3 t/h RCN. Automatisation totale, main d''œuvre réduite à 5-10 personnes par shift.\n\nStandard des grandes unités Brésil, Vietnam, Côte d''Ivoire (Olam). CAPEX 800 k€ à 2.5 M€. Rendement whole un peu plus bas (65-75%) mais volumes justifient. Intégration trieurs optiques BoniRob / Tomra pour qualité export États-Unis / UE.',
    3
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 35, 0.02, 82, 1200000.00, 0.30 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Ligne automatisée CFO 2 t/h (complète)', 950000.00, 'CFO Technology Brazil / CATIC Vietnam' from public.production_methods where product_slug='anacarde' and name='Décorticage automatisé (ligne continue type CFO / CATIC)'
union all
select id, 'machine', 'Trieur optique Tomra Nimbus (RGB + NIR)', 180000.00, 'Tomra / Bühler SORTEX' from public.production_methods where product_slug='anacarde' and name='Décorticage automatisé (ligne continue type CFO / CATIC)'
union all
select id, 'material', 'Contrat RCN annuel (2000 t)', 3200000.00, 'Olam / SINGHANIA / Vasconia' from public.production_methods where product_slug='anacarde' and name='Décorticage automatisé (ligne continue type CFO / CATIC)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1625944525533-473f1b3d9684?w=1200', 'Ligne automatisée cajou export' from public.production_methods where product_slug='anacarde' and name='Décorticage automatisé (ligne continue type CFO / CATIC)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=Bq8rKIqN8jA', 'Automated cashew processing line' from public.production_methods where product_slug='anacarde' and name='Décorticage automatisé (ligne continue type CFO / CATIC)';

-- 4) Grillage artisanal gourmet
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'anacarde',
    'Grillage artisanal petit lot (tambour 20 kg)',
    E'Le **grillage artisanal** sur tambour rotatif 10-30 kg permet un grillage contrôlé (135-150°C, 12-18 min) sur kernels W180/W240 premium. Profils développés (miel, sel/herbes, tandoori, truffe).\n\nCible : épiceries fines, plateformes DTC (Nuts.com, Mr Cashew, Maison Plisson). Marge détail 70-85%. Volume 30-150 kg/jour. Petite production, traçabilité par lot, certifications bio/fairtrade faciles à obtenir. Leader technique : Royal Duyvis Wiener, Micromill.',
    4
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 68, 0.015, 90, 12000.00, 2.50 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Tambour grillage 25kg avec régulation temp', 8500.00, 'Royal Duyvis Wiener / Micromill' from public.production_methods where product_slug='anacarde' and name='Grillage artisanal petit lot (tambour 20 kg)'
union all
select id, 'machine', 'Tambour aromatisation huilage salage', 2200.00, 'Duyvis / fabrication locale' from public.production_methods where product_slug='anacarde' and name='Grillage artisanal petit lot (tambour 20 kg)'
union all
select id, 'material', 'Amandes W180 premium (sac 22 kg)', 280.00, 'Coopératives Bénin / Guinée-Bissau' from public.production_methods where product_slug='anacarde' and name='Grillage artisanal petit lot (tambour 20 kg)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1606735584352-e5e53f3a6cd7?w=1200', 'Grillage artisanal noix cajou' from public.production_methods where product_slug='anacarde' and name='Grillage artisanal petit lot (tambour 20 kg)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=rQ_z6Y6ZTBQ', 'Artisan cashew roasting craft' from public.production_methods where product_slug='anacarde' and name='Grillage artisanal petit lot (tambour 20 kg)';

-- 5) Grillage industriel
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'anacarde',
    'Grillage industriel continu (four tunnel 500 kg/h)',
    E'Le **grillage industriel continu** utilise un four tunnel à convoyeur (longueur 8-15 m), températures étagées 130-155°C, durée résidence 10-20 min. Débit 300-800 kg/h. Équipements Spooner Industries, Aeroglide (Bühler), Tornum.\n\nCible : MDD supermarchés, marques volume (Planters, Nutty King, Naturie). Aromatisation/salage en ligne, ensachage auto. CAPEX 300-800 k€ ligne complète. Perte arôme vs artisanal compensée par volume (50 t/mois typique).',
    5
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 40, 0.008, 72, 450000.00, 0.40 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Four tunnel 500 kg/h (Spooner / Aeroglide)', 280000.00, 'Spooner Industries / Aeroglide Bühler' from public.production_methods where product_slug='anacarde' and name='Grillage industriel continu (four tunnel 500 kg/h)'
union all
select id, 'machine', 'Ligne salage-aromatisation continue', 85000.00, 'Heat and Control / tna solutions' from public.production_methods where product_slug='anacarde' and name='Grillage industriel continu (four tunnel 500 kg/h)'
union all
select id, 'material', 'Amandes W320/W400 volume (contrat 500 t)', 3100000.00, 'Olam / Vietnam Vinacas' from public.production_methods where product_slug='anacarde' and name='Grillage industriel continu (four tunnel 500 kg/h)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1609525313344-a56f00c38fb2?w=1200', 'Four tunnel grillage industriel' from public.production_methods where product_slug='anacarde' and name='Grillage industriel continu (four tunnel 500 kg/h)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=dNqTsSdF6vM', 'Industrial cashew roasting line' from public.production_methods where product_slug='anacarde' and name='Grillage industriel continu (four tunnel 500 kg/h)';


-- =========================================================================
-- ============================ HUILE DE PALME =============================
-- =========================================================================

-- 1) Extraction artisanale à la presse manuelle
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'huile_palme',
    'Extraction artisanale (pilon + presse manuelle à vis)',
    E'L''**extraction artisanale** stérilise les régimes au feu ouvert, dépulpe au pilon ou aux pieds, puis presse la pulpe bouillie dans une presse à vis manuelle. Rendement 10-15% huile (vs 20-23% industriel). Débit 30-80 kg huile/jour (FAO small-scale palm oil guide).\n\nMéthode dominante au Bénin, Togo, Ghana chez les productrices rurales. Produit une huile rouge non raffinée riche en caroténoïdes (pro-vitamine A), très valorisée localement et sur marchés diaspora européens. CAPEX minimal 300-800 €. Qualité variable selon pratiques.',
    1
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 85, 0.02, 60, 600.00, 0.35 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Presse à vis manuelle fonte', 280.00, 'Fabrication locale Lomé / Cotonou' from public.production_methods where product_slug='huile_palme' and name='Extraction artisanale (pilon + presse manuelle à vis)'
union all
select id, 'machine', 'Marmites stérilisation + pilons bois', 150.00, 'Artisanat local' from public.production_methods where product_slug='huile_palme' and name='Extraction artisanale (pilon + presse manuelle à vis)'
union all
select id, 'material', 'Régimes palme fraîches (1 tonne)', 90.00, 'Planteurs villageois' from public.production_methods where product_slug='huile_palme' and name='Extraction artisanale (pilon + presse manuelle à vis)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1592921870789-04563d55041c?w=1200', 'Extraction huile palme artisanale Bénin' from public.production_methods where product_slug='huile_palme' and name='Extraction artisanale (pilon + presse manuelle à vis)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=TGoM7eP1a-I', 'Artisanal palm oil extraction Togo' from public.production_methods where product_slug='huile_palme' and name='Extraction artisanale (pilon + presse manuelle à vis)';

-- 2) Extraction semi-industrielle
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'huile_palme',
    'Extraction semi-industrielle (presse hydraulique motorisée)',
    E'L''**extraction semi-industrielle** utilise un stérilisateur inox vapeur (20 min, 130°C), un digesteur à moteur et une presse hydraulique à vis motorisée. Rendement 17-19%. Débit 300 kg à 1.5 t huile/jour (IFC palm oil smallholder guide).\n\nDéployée au Bénin (SGD), Togo, Ghana par PME et coopératives. Fournisseurs clés : Muar Ban Lee (MY), IBG (NG), Caltech (GH). CAPEX 25-80 k€. Qualité huile stabilisée, valorisation export possible avec certification RSPO. ROI 3-5 ans typique.',
    2
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 55, 0.01, 75, 55000.00, 0.28 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Presse hydraulique motorisée 500 kg/h', 22000.00, 'Muar Ban Lee / IBG / Caltech' from public.production_methods where product_slug='huile_palme' and name='Extraction semi-industrielle (presse hydraulique motorisée)'
union all
select id, 'machine', 'Stérilisateur vapeur inox + digesteur', 18000.00, 'Muar Ban Lee / Caltech' from public.production_methods where product_slug='huile_palme' and name='Extraction semi-industrielle (presse hydraulique motorisée)'
union all
select id, 'material', 'Chaudière vapeur 500 kg + biomasse annuelle', 12000.00, 'Fulton / biomasse fibres palme' from public.production_methods where product_slug='huile_palme' and name='Extraction semi-industrielle (presse hydraulique motorisée)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1577741314755-048d8525d31e?w=1200', 'Unité semi-industrielle huile palme' from public.production_methods where product_slug='huile_palme' and name='Extraction semi-industrielle (presse hydraulique motorisée)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=2kH0p-sZQKw', 'Semi-industrial palm oil mill' from public.production_methods where product_slug='huile_palme' and name='Extraction semi-industrielle (presse hydraulique motorisée)';

-- 3) Extraction industrielle (CPO)
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'huile_palme',
    'Extraction industrielle (moulin CPO 30-60 t/h Malaysia model)',
    E'Le **moulin industriel CPO** (Crude Palm Oil) enchaîne réception, stérilisation (sphériques ou tunnels vapeur 3 bar), effruiteuse, digesteur, presse à vis continue (twin-screw), clarification. Rendement 20-23%. Capacités standards 30-60 t régimes/h (MPOB standards).\n\nStandard Malaysia/Indonesia, déployé en Afrique (PalmCI, Socfin, SIAT). CAPEX 8-25 M€ pour usine complète. Intégration retours : fibres + coques = combustible chaudière, effluents POME = biogaz. Usines certifiables RSPO, NDPE.',
    3
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 28, 0.005, 82, 12000000.00, 0.15 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Ligne CPO complète 45 t/h (sterilizer + press + clarification)', 9500000.00, 'Modipalm / Muar Ban Lee / CB Industrial' from public.production_methods where product_slug='huile_palme' and name='Extraction industrielle (moulin CPO 30-60 t/h Malaysia model)'
union all
select id, 'machine', 'Chaudière biomasse 45 t vapeur/h + cheminée', 1800000.00, 'Vyncke / John Thompson' from public.production_methods where product_slug='huile_palme' and name='Extraction industrielle (moulin CPO 30-60 t/h Malaysia model)'
union all
select id, 'material', 'Système traitement POME + biogas capture', 850000.00, 'Biogas Malaysia / Envitec' from public.production_methods where product_slug='huile_palme' and name='Extraction industrielle (moulin CPO 30-60 t/h Malaysia model)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1577801622187-9a0a0e4e9e9a?w=1200', 'Moulin industriel CPO Malaysia' from public.production_methods where product_slug='huile_palme' and name='Extraction industrielle (moulin CPO 30-60 t/h Malaysia model)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=sLDhJb0lSzI', 'Palm oil mill industrial process' from public.production_methods where product_slug='huile_palme' and name='Extraction industrielle (moulin CPO 30-60 t/h Malaysia model)';

-- 4) Raffinage artisanal local
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'huile_palme',
    'Raffinage artisanal (filtration + décantation chaude)',
    E'Le **raffinage artisanal** effectue une simple filtration (étamine + fûts décantation chaude 80°C) pour retirer sédiments, eau, impuretés. Conserve la couleur rouge et les caroténoïdes. Rendement 92-95%.\n\nMéthode courante pour l''huile rouge de marché local/diaspora. Valorisation +20-40% vs brute. Faible CAPEX (2-5 k€), marché reconnaissant en Afrique de l''Ouest et diasporas Europe/Amérique. Certifications bio/équitable accessibles.',
    4
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 70, 0.015, 70, 3500.00, 0.45 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Fûts décantation inox chauffants (3x500L)', 2400.00, 'Chaudronnerie locale / FoodEquip' from public.production_methods where product_slug='huile_palme' and name='Raffinage artisanal (filtration + décantation chaude)'
union all
select id, 'machine', 'Filtre presse manuel + étamines coton', 850.00, 'FoodEquip / import Asie' from public.production_methods where product_slug='huile_palme' and name='Raffinage artisanal (filtration + décantation chaude)'
union all
select id, 'material', 'Bidons PET alimentaires 5L + étiquettes (lot 500)', 450.00, 'Emballages locaux' from public.production_methods where product_slug='huile_palme' and name='Raffinage artisanal (filtration + décantation chaude)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1597393353415-b3730f3719fe?w=1200', 'Raffinage artisanal huile rouge' from public.production_methods where product_slug='huile_palme' and name='Raffinage artisanal (filtration + décantation chaude)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=9bKuwM5jQkU', 'Artisanal red palm oil refining' from public.production_methods where product_slug='huile_palme' and name='Raffinage artisanal (filtration + décantation chaude)';

-- 5) Raffinage industriel RBD
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'huile_palme',
    'Raffinage industriel complet RBD (refined, bleached, deodorized)',
    E'Le **raffinage industriel RBD** combine dégommage (acide phosphorique), neutralisation (soude), blanchiment (terres activées, charbon), désodorisation (vapeur sous vide 240-260°C), fractionnement. Obtient palmoléine (liquide) et palmstéarine (solide).\n\nStandard mondial pour usages agro-industriels (biscuiterie, margarines, savonnerie, biodiesel). Fournisseurs : Desmet Ballestra, Alfa Laval, Crown Iron Works. CAPEX 3-12 M€. Volumes 100-500 t/jour huile raffinée. Qualité food-grade certifiée, 0 caroténoïde, 0 odeur.',
    5
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 32, 0.003, 88, 6000000.00, 0.20 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Ligne raffinage continue 200 t/j (Desmet Ballestra)', 4500000.00, 'Desmet Ballestra / Alfa Laval / Crown' from public.production_methods where product_slug='huile_palme' and name='Raffinage industriel complet RBD (refined, bleached, deodorized)'
union all
select id, 'machine', 'Fractionnement cristallisation palmoléine', 850000.00, 'Desmet / Alfa Laval' from public.production_methods where product_slug='huile_palme' and name='Raffinage industriel complet RBD (refined, bleached, deodorized)'
union all
select id, 'material', 'Terres activées blanchiment (contrat annuel)', 180000.00, 'Oil-Dri / BASF / Clariant' from public.production_methods where product_slug='huile_palme' and name='Raffinage industriel complet RBD (refined, bleached, deodorized)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1565944150026-5dbd73321c66?w=1200', 'Raffinerie industrielle huile palme RBD' from public.production_methods where product_slug='huile_palme' and name='Raffinage industriel complet RBD (refined, bleached, deodorized)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=8mXhBqo8Hw4', 'Palm oil RBD refining plant' from public.production_methods where product_slug='huile_palme' and name='Raffinage industriel complet RBD (refined, bleached, deodorized)';


-- =========================================================================
-- ============================ MANGUE =====================================
-- =========================================================================

-- 1) Séchage solaire
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'mangue',
    'Séchage solaire direct (claies / tunnels passifs)',
    E'Le **séchage solaire direct** étale des tranches de mangue (épaisseur 5-8 mm) sur claies grillagées, protégées par tunnels passifs polyéthylène. Durée 2-4 jours selon ensoleillement. Humidité finale 15-18%. Rendement 6-8 kg frais → 1 kg sec (FAO dried mango guide).\n\nStandard Burkina Faso (2e exportateur mondial de mangue séchée bio) et Mali. CAPEX faible 1-3 k€ pour unité villageoise. Certifications bio/équitable dominantes (Ecocert, Fair For Life). Valorisation export Europe 8-12 €/kg prix sortie usine.',
    1
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 82, 0.13, 72, 2500.00, 0.85 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Tunnels séchage solaire passif (5 unités 12m²)', 1800.00, 'Projet Jubel / fabrication locale Burkina' from public.production_methods where product_slug='mangue' and name='Séchage solaire direct (claies / tunnels passifs)'
union all
select id, 'machine', 'Trancheuses manuelles inox (x5)', 350.00, 'Sammic / fourniture hôtelière' from public.production_methods where product_slug='mangue' and name='Séchage solaire direct (claies / tunnels passifs)'
union all
select id, 'material', 'Mangues fraîches Amélie/Kent (5 tonnes saison)', 1500.00, 'Coopératives vergers Bobo-Dioulasso / Sikasso' from public.production_methods where product_slug='mangue' and name='Séchage solaire direct (claies / tunnels passifs)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1591073113125-e46713c829ed?w=1200', 'Séchage solaire mangues Burkina' from public.production_methods where product_slug='mangue' and name='Séchage solaire direct (claies / tunnels passifs)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=R8R4qBTl7mI', 'Solar mango drying West Africa' from public.production_methods where product_slug='mangue' and name='Séchage solaire direct (claies / tunnels passifs)';

-- 2) Séchage électrique tunnel
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'mangue',
    'Séchage électrique à air pulsé (tunnel / cabine semi-industrielle)',
    E'Le **séchage à air pulsé** utilise une cabine ou tunnel thermostaté (60-70°C) avec ventilation forcée. Durée 10-16h. Rendement stable toute l''année (non dépendant du soleil), qualité homogène, couleur préservée (Nyle/Adrian/Atlas dryers).\n\nDéployé en Côte d''Ivoire (SITRAPAC), Sénégal, Burkina (unités AgroSphere). CAPEX 15-80 k€. Rentabilité dès 80-120 t/an. Permet production hors saison et export vers marchés de contre-saison (USA, UE). Qualité export supérieure au solaire.',
    2
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 55, 0.03, 85, 45000.00, 1.20 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Tunnel séchage électrique 500 kg/batch', 28000.00, 'Nyle Systems / Adrian / Atlas' from public.production_methods where product_slug='mangue' and name='Séchage électrique à air pulsé (tunnel / cabine semi-industrielle)'
union all
select id, 'machine', 'Chaîne découpe + blanchisseur vapeur', 12000.00, 'JBT / Sormac / Urschel' from public.production_methods where product_slug='mangue' and name='Séchage électrique à air pulsé (tunnel / cabine semi-industrielle)'
union all
select id, 'material', 'Emballages stand-up pouch alu (50 000 unités/an)', 3200.00, 'Amcor / Mondi' from public.production_methods where product_slug='mangue' and name='Séchage électrique à air pulsé (tunnel / cabine semi-industrielle)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=1200', 'Tunnel séchage mangue industriel' from public.production_methods where product_slug='mangue' and name='Séchage électrique à air pulsé (tunnel / cabine semi-industrielle)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=5Q7lULgYy8Q', 'Electric mango dryer operation' from public.production_methods where product_slug='mangue' and name='Séchage électrique à air pulsé (tunnel / cabine semi-industrielle)';

-- 3) Lyophilisation premium
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'mangue',
    'Lyophilisation (freeze-drying) premium export',
    E'La **lyophilisation** congèle la mangue à -40°C puis sublime l''eau sous vide (pression <1 mbar). Durée cycle 24-48h. Préserve 95%+ des nutriments/arômes/couleur, texture croustillante iconique. Prix marché 40-80 €/kg.\n\nCible : snacks premium (Crispy Fruit, Nim''s), baby food (Yumi, Little Spoon), ingrédients nutraceutiques, déshydratés pour pâtisserie. CAPEX 300 k€-1.5 M€. Leaders : GEA, SP Scientific, Cuddon. Faible volume, haute valeur, positionnement ultra-premium.',
    3
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 25, 0.06, 95, 800000.00, 6.50 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Lyophilisateur industriel 500 kg/batch (GEA)', 650000.00, 'GEA / SP Scientific / Cuddon' from public.production_methods where product_slug='mangue' and name='Lyophilisation (freeze-drying) premium export'
union all
select id, 'machine', 'Congélateur blast -40°C + compresseur', 95000.00, 'Frigorimpianti / Jackstone' from public.production_methods where product_slug='mangue' and name='Lyophilisation (freeze-drying) premium export'
union all
select id, 'material', 'Emballages MAP barrière oxygène (contrat annuel)', 18000.00, 'Sealed Air / Mondi' from public.production_methods where product_slug='mangue' and name='Lyophilisation (freeze-drying) premium export';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1610705267928-1b9bb1a39e4d?w=1200', 'Lyophilisation fruits premium' from public.production_methods where product_slug='mangue' and name='Lyophilisation (freeze-drying) premium export'
union all
select id, 'video', 'https://www.youtube.com/watch?v=H-_wxAH82W0', 'Industrial freeze drying process' from public.production_methods where product_slug='mangue' and name='Lyophilisation (freeze-drying) premium export';

-- 4) Purée concentrée
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'mangue',
    'Purée concentrée aseptique (process bloc Tetra Pak)',
    E'La **purée concentrée** broie la mangue mûre, la tamise (finisseur inox), puis la concentre par évaporation sous vide (Brix 28-32°). Remplissage aseptique en bloc bag 220 kg (Tetra Pak / Scholle IPN). Conservation 18-24 mois sans chaîne du froid.\n\nMarché B2B énorme : boissons (Coca, Pepsi, Refresco), glaces (Unilever, Lactalis), yaourts (Danone). Leaders fournisseurs process : GEA / JBT / Bertuzzi. CAPEX 2-8 M€ ligne complète. Débit 5-20 t/h fruits. Côte d''Ivoire (PROSUMA), Mali, Sénégal ont lignes opérationnelles.',
    4
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 45, 0.003, 80, 3500000.00, 0.35 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Ligne purée concentrée 10 t/h (Bertuzzi / JBT)', 2400000.00, 'Bertuzzi / JBT / GEA' from public.production_methods where product_slug='mangue' and name='Purée concentrée aseptique (process bloc Tetra Pak)'
union all
select id, 'machine', 'Remplisseuse aseptique bag-in-box Scholle', 480000.00, 'Scholle IPN / Tetra Pak' from public.production_methods where product_slug='mangue' and name='Purée concentrée aseptique (process bloc Tetra Pak)'
union all
select id, 'material', 'Mangues Kent/Keitt industrielles (contrat saison 8000 t)', 1600000.00, 'Coopératives Côte d''Ivoire / Mali / Sénégal' from public.production_methods where product_slug='mangue' and name='Purée concentrée aseptique (process bloc Tetra Pak)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1553279030-0e435dcb64d3?w=1200', 'Ligne industrielle purée fruits' from public.production_methods where product_slug='mangue' and name='Purée concentrée aseptique (process bloc Tetra Pak)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=WdVUkJNAgYM', 'Aseptic mango puree production' from public.production_methods where product_slug='mangue' and name='Purée concentrée aseptique (process bloc Tetra Pak)';

-- 5) Jus et nectar
with m as (
  insert into public.production_methods (product_slug, name, description_md, popularity_rank)
  values (
    'mangue',
    'Jus et nectar mid-scale (flash-pasteurisation + embouteillage)',
    E'Le **jus/nectar mid-scale** combine broyage, pasteurisation HTST (90°C, 30 s) ou flash pasteurisation, embouteillage verre/PET ou Tetra Pak. Durée conservation 6-12 mois en ambiant, 3-6 mois en réfrigéré.\n\nCible marchés locaux et régionaux WAEMU (CEDEAO) + export diaspora. Marques : Pressea (SN), Zena (BF), Dafani (BF). CAPEX 150-800 k€ ligne complète. Leaders process : KHS, Krones, GEA. Segment haute croissance Afrique +8%/an (FAO 2024). Marges meilleures que purée vrac.',
    5
  )
  returning id
)
insert into public.method_metrics (method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit)
select id, 52, 0.005, 75, 350000.00, 0.55 from m;

insert into public.method_resources (method_id, type, name, est_cost_eur, supplier_hint)
select id, 'machine', 'Ligne jus + pasteurisateur HTST (2000 l/h)', 180000.00, 'KHS / Krones / GEA' from public.production_methods where product_slug='mangue' and name='Jus et nectar mid-scale (flash-pasteurisation + embouteillage)'
union all
select id, 'machine', 'Remplisseuse PET + étiqueteuse auto', 120000.00, 'Sidel / KHS Innopack' from public.production_methods where product_slug='mangue' and name='Jus et nectar mid-scale (flash-pasteurisation + embouteillage)'
union all
select id, 'material', 'Bouteilles PET + bouchons + étiquettes (500k unités)', 45000.00, 'Sidel preform / Crown Holdings' from public.production_methods where product_slug='mangue' and name='Jus et nectar mid-scale (flash-pasteurisation + embouteillage)';

insert into public.method_media (method_id, type, url, caption)
select id, 'image', 'https://images.unsplash.com/photo-1600271886742-f049b374a0b3?w=1200', 'Ligne embouteillage jus de mangue' from public.production_methods where product_slug='mangue' and name='Jus et nectar mid-scale (flash-pasteurisation + embouteillage)'
union all
select id, 'video', 'https://www.youtube.com/watch?v=mpL5o_Q3q_0', 'Mango nectar bottling line' from public.production_methods where product_slug='mangue' and name='Jus et nectar mid-scale (flash-pasteurisation + embouteillage)';
