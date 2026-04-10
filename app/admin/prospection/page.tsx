'use client'

import { useState } from 'react'

// ============================================================================
// FEEL THE GAP — PLAN DE PROSPECTION MASSIF
// 4 profils x sequences completes x pipeline automation x budget x KPIs
// 95% executable par agents AI — budget proche de 0 EUR
// Date: 2026-04-10
// ============================================================================

type Profile = 'entrepreneurs' | 'influenceurs' | 'financeurs' | 'investisseurs'
type TabKey = 'overview' | 'entrepreneurs' | 'influenceurs' | 'financeurs' | 'investisseurs' | 'pipeline' | 'budget' | 'kpis' | 'timeline'

interface EmailTemplate {
  day: number
  subject_a: string
  subject_b: string
  body: string
  cta: string
}

interface LinkedInMsg {
  step: string
  message: string
}

interface Source {
  name: string
  url: string
  free_limit: string
  estimated_contacts: string
  gdpr_notes: string
}

// ── SOURCING DATABASES ──────────────────────────────────────────────────────

const SOURCES_ENTREPRENEURS: Source[] = [
  { name: 'LinkedIn Sales Navigator (free tier)', url: 'linkedin.com/sales', free_limit: '~50 profile views/mo', estimated_contacts: '200-300 qualified/mo', gdpr_notes: 'Public profiles only, no scraping' },
  { name: 'Apollo.io Free Tier', url: 'apollo.io', free_limit: '25 email credits/mo + unlimited search', estimated_contacts: '25 verified emails/mo', gdpr_notes: 'GDPR-compliant, opt-out mechanism' },
  { name: 'Hunter.io Free Tier', url: 'hunter.io', free_limit: '25 searches + 50 verifications/mo', estimated_contacts: '25 verified emails/mo', gdpr_notes: 'Public data only, GDPR compliant' },
  { name: 'Crunchbase Free', url: 'crunchbase.com', free_limit: '5 searches/day, basic profiles', estimated_contacts: '150 company profiles/mo', gdpr_notes: 'Public business data' },
  { name: 'Google Maps Scraping', url: 'maps.google.com', free_limit: 'Manual + Apify free tier (100 results)', estimated_contacts: '100-200 import/export businesses/mo', gdpr_notes: 'Public business listings' },
  { name: 'Trade Fair Exhibitor Lists', url: 'Various (SIAL, Anuga, Canton Fair)', free_limit: 'PDF downloads (public)', estimated_contacts: '500-2000 contacts per fair', gdpr_notes: 'Public exhibitor data' },
  { name: 'CCI France International', url: 'ccifrance-international.org', free_limit: 'Public directory', estimated_contacts: '50-100/mo', gdpr_notes: 'Public institutional data' },
  { name: 'Enterprise Europe Network', url: 'een.ec.europa.eu', free_limit: 'Public partner search', estimated_contacts: '100-200/mo', gdpr_notes: 'EU public data' },
  { name: 'CEPEX (Tunisie)', url: 'cepex.nat.tn', free_limit: 'Public exporter database', estimated_contacts: '200+', gdpr_notes: 'Public govt data' },
  { name: 'APEX Brasil', url: 'apexbrasil.com.br', free_limit: 'Public exporter lists', estimated_contacts: '300+', gdpr_notes: 'Public govt data' },
]

const SOURCES_INFLUENCEURS: Source[] = [
  { name: 'Instagram Hashtag Search', url: 'instagram.com', free_limit: 'Manual (unlimited)', estimated_contacts: '100-200/mo manual', gdpr_notes: 'Public profiles only' },
  { name: 'TikTok Creator Marketplace', url: 'creatormarketplace.tiktok.com', free_limit: 'Free access (brand account)', estimated_contacts: '200-500 in niche', gdpr_notes: 'Creators opt in' },
  { name: 'YouTube Search (business niches)', url: 'youtube.com', free_limit: 'Unlimited manual', estimated_contacts: '50-100 channels/mo', gdpr_notes: 'Public data' },
  { name: 'Apify Instagram Scraper (free tier)', url: 'apify.com', free_limit: '48 actor runs/mo', estimated_contacts: '200 profiles/mo', gdpr_notes: 'Public data only' },
  { name: 'Modash Free Tier', url: 'modash.io', free_limit: '50 searches/mo', estimated_contacts: '50 micro-influencers/mo', gdpr_notes: 'Public data, GDPR compliant' },
]

const SOURCES_FINANCEURS: Source[] = [
  { name: 'Afreximbank Member Directory', url: 'afreximbank.com', free_limit: 'Public', estimated_contacts: '50-100 contacts', gdpr_notes: 'Public institutional' },
  { name: 'Ecobank Regional Contacts', url: 'ecobank.com', free_limit: 'Public branches', estimated_contacts: '100+ branch managers', gdpr_notes: 'Public business data' },
  { name: 'AfDB Project Database', url: 'afdb.org/en/projects-and-operations', free_limit: 'Public', estimated_contacts: '200+ project contacts', gdpr_notes: 'Public development data' },
  { name: 'IFC Investment Portfolio', url: 'ifc.org', free_limit: 'Public', estimated_contacts: '100+ project managers', gdpr_notes: 'Public development data' },
  { name: 'Proparco Portfolio', url: 'proparco.fr', free_limit: 'Public', estimated_contacts: '50+ contacts', gdpr_notes: 'Public French DFI data' },
  { name: 'LinkedIn "Trade Finance"', url: 'linkedin.com', free_limit: 'Free search', estimated_contacts: '300-500 profiles', gdpr_notes: 'Public profiles' },
  { name: 'ITFA Member List', url: 'itfa.org', free_limit: 'Public members', estimated_contacts: '200+ members', gdpr_notes: 'Association public data' },
  { name: 'FCI (Factors Chain Int.)', url: 'fci.nl', free_limit: 'Public directory', estimated_contacts: '100+ factor companies', gdpr_notes: 'Public association data' },
]

const SOURCES_INVESTISSEURS: Source[] = [
  { name: 'Crunchbase Free', url: 'crunchbase.com', free_limit: '5 searches/day', estimated_contacts: '150 VC/angel profiles/mo', gdpr_notes: 'Public business data' },
  { name: 'AngelList / Wellfound', url: 'wellfound.com', free_limit: 'Free browse', estimated_contacts: '100+ angel profiles', gdpr_notes: 'Public opt-in profiles' },
  { name: 'Partech Africa Portfolio', url: 'partechpartners.com/africa', free_limit: 'Public', estimated_contacts: '30-50 portfolio contacts', gdpr_notes: 'Public' },
  { name: 'TLcom Capital', url: 'tlcomcapital.com', free_limit: 'Public portfolio', estimated_contacts: '20-30', gdpr_notes: 'Public' },
  { name: 'Novastar Ventures', url: 'novastarventures.com', free_limit: 'Public', estimated_contacts: '20-30', gdpr_notes: 'Public' },
  { name: 'French Business Angels (FRANCE ANGELS)', url: 'franceangels.org', free_limit: 'Public network list', estimated_contacts: '80+ network contacts', gdpr_notes: 'Public association' },
  { name: 'ABAN (African Business Angels)', url: 'aikigroup.com/aban', free_limit: 'Public', estimated_contacts: '100+ members', gdpr_notes: 'Public network' },
  { name: 'GIIN Impact Investors', url: 'thegiin.org', free_limit: 'Public member directory', estimated_contacts: '200+ impact investors', gdpr_notes: 'Public' },
  { name: 'LinkedIn "Business Angel" + "Africa"', url: 'linkedin.com', free_limit: 'Free search', estimated_contacts: '500+ profiles', gdpr_notes: 'Public profiles' },
]

// ── LINKEDIN GROUPS TO TARGET ───────────────────────────────────────────────

const LINKEDIN_GROUPS = [
  { name: 'Africa Trade & Investment', members: '~45K', profile: 'entrepreneurs' as Profile },
  { name: 'Import Export Business Network', members: '~120K', profile: 'entrepreneurs' as Profile },
  { name: 'International Trade Professionals', members: '~85K', profile: 'entrepreneurs' as Profile },
  { name: 'Africa Business Community', members: '~60K', profile: 'entrepreneurs' as Profile },
  { name: 'Entrepreneurship in Africa', members: '~35K', profile: 'entrepreneurs' as Profile },
  { name: 'Global Trade Finance', members: '~15K', profile: 'financeurs' as Profile },
  { name: 'Trade Finance & Forfaiting', members: '~8K', profile: 'financeurs' as Profile },
  { name: 'Supply Chain Finance Community', members: '~25K', profile: 'financeurs' as Profile },
  { name: 'Africa Startup Ecosystem', members: '~40K', profile: 'investisseurs' as Profile },
  { name: 'Impact Investing Network', members: '~30K', profile: 'investisseurs' as Profile },
  { name: 'Venture Capital Africa', members: '~12K', profile: 'investisseurs' as Profile },
]

// ── REDDIT / QUORA / X ─────────────────────────────────────────────────────

const REDDIT_SUBS = [
  { name: 'r/Entrepreneur', members: '3.8M', relevance: 'General entrepreneurs, post trade gap analyses' },
  { name: 'r/smallbusiness', members: '1.5M', relevance: 'SME owners looking for sourcing opportunities' },
  { name: 'r/importexport', members: '~15K', relevance: 'Direct target audience, highly qualified' },
  { name: 'r/supplychain', members: '~80K', relevance: 'Logistics and trade professionals' },
  { name: 'r/Africa', members: '~150K', relevance: 'African diaspora entrepreneurs' },
  { name: 'r/startups', members: '~1.2M', relevance: 'Early-stage founders looking for market data' },
  { name: 'r/SideProject', members: '~200K', relevance: 'Builders who might use trade intelligence' },
  { name: 'r/ecommerce', members: '~300K', relevance: 'Sellers looking for product sourcing' },
]

// ── INSTAGRAM / TIKTOK HASHTAGS ─────────────────────────────────────────────

const SOCIAL_HASHTAGS = [
  '#importexport', '#tradebusiness', '#africanentrepreneur', '#madeinafrica',
  '#sourcingproducts', '#businessinafrica', '#commerceinternational', '#exportateur',
  '#entrepreneurafricain', '#cacaobusiness', '#textilebusiness', '#agribusiness',
  '#afriquebusiness', '#madeinivory', '#madeincotedivoire', '#madeincolombia',
  '#tradeshow', '#africanfashion', '#ethicalsourcing', '#fairtradeproducts',
]

// ── EMAIL SEQUENCES ─────────────────────────────────────────────────────────

const EMAILS_ENTREPRENEURS: EmailTemplate[] = [
  {
    day: 0,
    subject_a: 'Le gap {PRODUCT} {COUNTRY_FROM} -> {COUNTRY_TO} vaut ${GAP_VALUE}M',
    subject_b: '{FIRST_NAME}, une opportunite {PRODUCT} identifiee par l\'IA',
    body: `Bonjour {FIRST_NAME},

Je me permets de vous contacter car j'ai identifie une donnee qui pourrait vous interesser directement.

Notre plateforme Feel The Gap a detecte un gap commercial de {GAP_VALUE}M$ sur {PRODUCT} entre {COUNTRY_FROM} et {COUNTRY_TO}. Concretement, {COUNTRY_TO} importe {IMPORT_VALUE}M$/an de {PRODUCT} mais {COUNTRY_FROM} n'exporte que {EXPORT_VALUE}M$ vers ce marche — c'est un deficit d'offre de {GAP_PCT}%.

Ce que ca signifie pour un entrepreneur comme vous :
- Marges potentielles de {MARGIN_PCT}% (benchmark secteur)
- Barriere a l'entree : {BARRIER_LEVEL} (notre score : {OPP_SCORE}/100)
- Capex estime pour demarrer : {CAPEX_ESTIMATE}

Je vous ai prepare un acces demo gratuit pour explorer ces donnees vous-meme sur notre carte interactive.

Pas de carte bancaire, pas d'engagement — juste de la data.`,
    cta: 'Creer mon compte demo gratuit ->',
  },
  {
    day: 3,
    subject_a: 'Business plan {PRODUCT} {COUNTRY_TO} — genere en 30 sec',
    subject_b: 'Capex, opex, ROI : votre plan {PRODUCT} en un clic',
    body: `{FIRST_NAME},

Suite a mon precedent message, je voulais vous montrer concretement ce que Feel The Gap genere pour un entrepreneur dans votre secteur.

Voici un extrait du business plan IA pour {PRODUCT} vers {COUNTRY_TO} :

SCENARIO ARTISANAL :
- Capex : {CAPEX_ARTISAN}
- Opex mensuel : {OPEX_ARTISAN}
- ROI estime : {ROI_ARTISAN} mois
- DSCR : {DSCR_ARTISAN}

SCENARIO MECANISE :
- Capex : {CAPEX_MECH}
- ROI estime : {ROI_MECH} mois

Le plan complet inclut aussi les fournisseurs recommandes, les corridors logistiques (cout maritime/aerien/routier), la reglementation pays, et un scoring de risque.

Tout ca genere par IA en 30 secondes. Voulez-vous voir le votre ?`,
    cta: 'Generer mon business plan IA ->',
  },
  {
    day: 7,
    subject_a: 'Comment {EXAMPLE_NAME} a identifie un marche a {EXAMPLE_VALUE}M$',
    subject_b: '{PRODUCT} : les 3 pays que personne ne regarde (et qui rapportent)',
    body: `{FIRST_NAME},

Un rapide cas d'usage concret.

{EXAMPLE_NAME}, entrepreneur {EXAMPLE_SECTOR}, utilisait les memes sources que tout le monde (foires, LinkedIn, bouche-a-oreille) pour identifier ses marches export.

En testant Feel The Gap, il a decouvert que {EXAMPLE_COUNTRY} avait un deficit de {EXAMPLE_GAP}M$ en {PRODUCT} — un marche que personne dans son reseau ne ciblait.

Resultat :
- Premier contact acheteur en 2 semaines
- Premier echantillon envoye en 6 semaines
- Commande pilote de {EXAMPLE_ORDER}K$ signee

La difference ? Des donnees que 99% des entrepreneurs n'ont pas.

Notre carte interactive couvre 115 pays et 500+ categories de produits. Le compte Explorer est gratuit — a vie.`,
    cta: 'Explorer la carte mondiale ->',
  },
  {
    day: 14,
    subject_a: 'Vos 3 meilleurs marches {PRODUCT} (scoring IA)',
    subject_b: 'Classement IA : ou vendre {PRODUCT} en 2026',
    body: `{FIRST_NAME},

J'ai demande a notre IA de scorer les 10 meilleurs marches d'export pour {PRODUCT} depuis {COUNTRY_FROM}.

Voici le top 3 :

1. {TOP1_COUNTRY} — Score {TOP1_SCORE}/100
   Gap: {TOP1_GAP}M$ | Croissance: +{TOP1_GROWTH}%/an | Barriere: {TOP1_BARRIER}

2. {TOP2_COUNTRY} — Score {TOP2_SCORE}/100
   Gap: {TOP2_GAP}M$ | Croissance: +{TOP2_GROWTH}%/an | Barriere: {TOP2_BARRIER}

3. {TOP3_COUNTRY} — Score {TOP3_SCORE}/100
   Gap: {TOP3_GAP}M$ | Croissance: +{TOP3_GROWTH}%/an | Barriere: {TOP3_BARRIER}

Le classement complet (10 pays) + business plans detailles sont disponibles dans votre espace.

Ce scoring est personnalise : il tient compte de votre pays d'origine, de votre secteur, et des corridors logistiques les plus rentables.`,
    cta: 'Voir mon classement personnalise ->',
  },
  {
    day: 21,
    subject_a: 'Derniere chance : votre acces Strategy offert 7 jours',
    subject_b: '{FIRST_NAME}, 7 jours gratuits sur le plan Strategy (99EUR/mois)',
    body: `{FIRST_NAME},

C'est mon dernier message (promis).

Je vous offre 7 jours d'acces gratuit au plan Strategy (normalement 99EUR/mois). Ca inclut :

- Business plans IA illimites (3 scenarios : artisanal, mecanise, automatise)
- AI Trade Advisor (posez n'importe quelle question sur n'importe quel marche)
- Opportunity Farming (scanner de produits)
- Credits IA inclus (valeur 20EUR)
- Donnees de production, logistique et reglementation sur 30 pays

Pas de carte bancaire requise pour l'essai. Si ca ne vous convient pas dans 7 jours, vous restez sur le plan gratuit Explorer — aucun risque.

Le lien d'activation expire dans 48h.`,
    cta: 'Activer mes 7 jours Strategy gratuits ->',
  },
]

const EMAILS_INFLUENCEURS: EmailTemplate[] = [
  {
    day: 0,
    subject_a: 'Gagnez des commissions sur le commerce international (18% par vente)',
    subject_b: '{FIRST_NAME}, monetisez votre audience avec du commerce reel',
    body: `Bonjour {FIRST_NAME},

Je suis tombe(e) sur votre contenu sur {PLATFORM} et j'ai ete impressionne par votre communaute de {FOLLOWER_COUNT} abonnes engages dans {NICHE}.

Chez Feel The Gap, on connecte les entrepreneurs du commerce international avec les marches sous-approvisionnes. Et on cherche des createurs de contenu pour promouvoir des opportunites concretes.

Le deal :
- Commission de 18% sur chaque vente generee via votre lien
- Produits reels : cacao ivoirien, textile colombien, anacarde senegalais...
- Lien d'affiliation tracke + dashboard temps reel
- Paiement automatique via Stripe Connect (seuil : 20EUR)

Nos premiers affilies gagnent entre 200 et 800EUR/mois en partageant simplement des fiches opportunites avec leur audience.

Ca vous interesse ? Je peux vous creer un compte influenceur en 2 minutes.`,
    cta: 'Creer mon compte influenceur ->',
  },
  {
    day: 3,
    subject_a: 'Simulation : combien vous pourriez gagner avec {FOLLOWER_COUNT} abonnes',
    subject_b: 'Le calcul est simple : {FOLLOWER_COUNT} abonnes x 0.5% conversion = ...',
    body: `{FIRST_NAME},

Faisons le calcul ensemble.

Votre audience : {FOLLOWER_COUNT} abonnes
Taux de clic moyen (stories/reels) : 3-5%
Taux de conversion (visiteur -> inscription gratuite) : 8-12%
Taux d'upgrade (gratuit -> payant) : 5-8%
Commission par abonnement : 18% x 99EUR = 17.82EUR/mois recurrent

Scenario conservateur ({FOLLOWER_COUNT} abonnes) :
- 1 story/semaine = ~{CLICK_EST} clics/semaine
- {SIGNUP_EST} inscriptions/semaine
- {PAID_EST} upgrade payant/mois
- = {REVENUE_EST}EUR/mois en commissions recurrentes

Et ca croit chaque mois car les abonnements sont recurrents. Apres 6 mois, les commissions se cumulent.

Tout est tracke dans votre dashboard. Vous voyez chaque clic, chaque inscription, chaque conversion.`,
    cta: 'Voir mon dashboard influenceur ->',
  },
  {
    day: 7,
    subject_a: 'Contenu pret a poster : 3 hooks {NICHE} qui convertissent',
    subject_b: 'On vous a prepare du contenu — il suffit de poster',
    body: `{FIRST_NAME},

On sait que creer du contenu prend du temps. Alors on a prepare 3 hooks prets a poster pour votre niche ({NICHE}) :

HOOK 1 (Story/Reel) :
"Saviez-vous que la Cote d'Ivoire produit 40% du cacao mondial mais que seulement 5% est transforme sur place ? Le gap vaut 4.2 milliards $. (lien en bio)"

HOOK 2 (Carousel) :
"5 produits africains avec des marges de 40-60% a l'export : 1/ Cacao CIV 2/ Anacarde SEN 3/ Textile VNM 4/ Mangue COL 5/ Cafe ETH — Analyse complete gratuite sur Feel The Gap"

HOOK 3 (Video) :
"Je viens de decouvrir une plateforme qui identifie les marches sous-approvisionnes dans le monde. Elle m'a montre que [PAYS] importe pour [X]M$ de [PRODUIT] mais personne ne s'y positionne. Voici comment ca marche... (lien en bio)"

Chaque post inclut votre lien d'affiliation tracke. Vous gagnez a chaque inscription payante.`,
    cta: 'Recuperer mes liens d\'affiliation ->',
  },
  {
    day: 14,
    subject_a: 'Offre speciale createurs : bonus 50EUR sur votre premier mois',
    subject_b: 'Bonus de bienvenue : 50EUR credites a votre premiere commission',
    body: `{FIRST_NAME},

Dernier message de ma part.

Pour vous remercier de votre interet, je vous propose un bonus de bienvenue : 50EUR credites directement sur votre compte influenceur des que vous generez votre premier abonnement payant.

Concretement : votre premiere vente = 17.82EUR (commission) + 50EUR (bonus) = 67.82EUR pour un seul post.

L'offre est valable 7 jours.

Pour info, voici ce que gagnent nos top affilies ce mois-ci :
- @{TOP1_HANDLE} : {TOP1_EARNINGS}EUR (niche: {TOP1_NICHE})
- @{TOP2_HANDLE} : {TOP2_EARNINGS}EUR (niche: {TOP2_NICHE})
- @{TOP3_HANDLE} : {TOP3_EARNINGS}EUR (niche: {TOP3_NICHE})

Votre lien d'activation est pret.`,
    cta: 'Activer mon compte + bonus 50EUR ->',
  },
]

const EMAILS_FINANCEURS: EmailTemplate[] = [
  {
    day: 0,
    subject_a: 'Deal flow qualifie : dossiers de financement avec scoring DSCR automatique',
    subject_b: 'PME export pre-qualifiees — scoring risque + business plans IA',
    body: `Bonjour {FIRST_NAME},

Je vous contacte car Feel The Gap genere un flux de dossiers de financement pre-qualifies pour les institutions comme {COMPANY}.

Notre plateforme analyse les gaps commerciaux mondiaux et genere des business plans IA complets pour des PME dans l'import/export. Chaque dossier inclut :

- Scoring d'opportunite (0-100) base sur des donnees reelles
- DSCR (Debt Service Coverage Ratio) calcule automatiquement sur 3 scenarios
- Capex/Opex detailles avec benchmarks sectoriels
- Corridors logistiques chiffres (maritime, aerien, routier)
- Reglementation pays (tarifs douaniers, certifications requises)

Volume actuel : 36 business plans complets sur 6 pays x 6 produits pilotes (cacao, cafe, textile, anacarde, huile de palme, mangue). Pipeline en cours sur 30 pays producteurs.

Notre objectif : devenir votre source de deal flow PME export en Afrique et pays emergents.`,
    cta: 'Demander l\'acces au dashboard financeur ->',
  },
  {
    day: 5,
    subject_a: 'Exemple concret : dossier cacao CIV->EU, DSCR 2.4x',
    subject_b: 'Business plan IA : cacao Cote d\'Ivoire, 3 scenarios de financement',
    body: `{FIRST_NAME},

Voici un extrait concret d'un de nos dossiers :

PRODUIT : Cacao transforme (beurre de cacao)
CORRIDOR : Cote d'Ivoire -> Union Europeenne
GAP IDENTIFIE : 4.2Mds $ (difference entre demande EU et offre CIV transformee)

SCENARIO MECANISE (le plus finance) :
- Capex initial : 180,000 EUR
- Opex mensuel : 12,500 EUR
- CA previsionnel Y1 : 320,000 EUR
- DSCR : 2.4x (seuil de confort bancaire : 1.3x)
- Payback : 14 mois

SCORING FEEL THE GAP :
- Score opportunite : 87/100
- Risque reglementaire : Faible (certif EUR1 requise, process standard)
- Risque logistique : Modere (Abidjan->Rotterdam, 18j, 2,800 EUR/conteneur 20ft)

Nos PME clientes recoivent ce type de dossier avec toutes les pieces justificatives. Souhaitez-vous acceder a notre pipeline complet ?`,
    cta: 'Acceder au pipeline de deals ->',
  },
  {
    day: 10,
    subject_a: 'Integration API : recevez les dossiers directement dans votre CRM',
    subject_b: 'Automatisez votre sourcing de dossiers PME export',
    body: `{FIRST_NAME},

Au-dela de la consultation ponctuelle, Feel The Gap peut s'integrer a votre workflow existant :

OPTION 1 — Dashboard Financeur (gratuit)
- Acces web aux dossiers pre-qualifies
- Filtres par pays, produit, DSCR minimum, montant
- Alertes email quand un nouveau dossier matche vos criteres

OPTION 2 — API / Webhook (Enterprise)
- Push automatique des dossiers qualifies vers votre CRM/core banking
- Format JSON standardise (compatible avec la plupart des solutions)
- SLA : dossiers enrichis en < 24h apres detection du gap

OPTION 3 — Co-branding
- Interface en marque blanche pour vos clients PME
- Ils generent leurs business plans via Feel The Gap
- Vous recevez les dossiers pre-remplis

Quel format vous conviendrait le mieux ? Je peux organiser une demo de 15 minutes.`,
    cta: 'Planifier une demo 15 min ->',
  },
  {
    day: 18,
    subject_a: 'Offre de lancement : acces gratuit 3 mois au dashboard financeur',
    subject_b: '3 mois gratuits — testez notre deal flow sans engagement',
    body: `{FIRST_NAME},

Dernier message. Pour les 10 premieres institutions financieres partenaires, nous offrons :

- 3 mois d'acces gratuit au dashboard financeur complet
- Integration prioritaire (API/webhook si necessaire)
- Support dedie pour parametrer vos criteres de qualification
- Co-construction du scoring credit (on adapte nos metriques a vos grilles)

En contrepartie, nous vous demanderons simplement un feedback mensuel sur la qualite des dossiers, pour ameliorer notre IA.

Actuellement 3 institutions ont deja rejoint le programme pilote. Il reste 7 places.

L'offre expire le {EXPIRY_DATE}.`,
    cta: 'Rejoindre le programme pilote financeur ->',
  },
]

const EMAILS_INVESTISSEURS: EmailTemplate[] = [
  {
    day: 0,
    subject_a: 'Deal flow Afrique pre-qualifie — valorisations early-stage attractives',
    subject_b: '{FIRST_NAME}, un pipeline de deals commerce international en Afrique',
    body: `Bonjour {FIRST_NAME},

Feel The Gap est une plateforme SaaS qui identifie les gaps commerciaux mondiaux par IA et genere des business plans complets pour les entrepreneurs.

Pourquoi ca interesse un investisseur :

1. DEAL FLOW QUALIFIE
- Chaque entrepreneur sur notre plateforme a un business plan valide par l'IA
- Scoring d'opportunite (0-100), DSCR, Capex/Opex, corridors logistiques
- Vous accedez a des deals pre-structures, pas juste des pitch decks

2. MARCHE
- Commerce intra-africain : 2.5% du commerce mondial -> objectif AfCFTA : 25%
- ZLECAf (Zone de Libre-Echange) = 1.3Mds de consommateurs
- Gap identifie par notre IA sur 30 pays : > 50Mds $ d'opportunites non exploitees

3. TRACTION
- 115 pays en base, 36 business plans complets, 442 benchmarks de couts
- Pipeline en expansion (30 pays producteurs x 6 produits)
- 4 parcours utilisateurs : entrepreneur, influenceur, financeur, investisseur

Je vous propose un acces direct a notre dashboard investisseur pour evaluer la qualite du deal flow.`,
    cta: 'Acceder au dashboard investisseur ->',
  },
  {
    day: 5,
    subject_a: 'Portfolio type : 5 deals commerce Afrique, TRI moyen 35%',
    subject_b: 'Simulation portefeuille : 5 tickets x 50K EUR en commerce africain',
    body: `{FIRST_NAME},

Voici une simulation basee sur nos donnees reelles :

PORTEFEUILLE TYPE (5 deals) :

1. Cacao transforme CIV->EU | Ticket: 50K | TRI estime: 42% | Payback: 14mo
2. Textile ethique VNM->FR | Ticket: 30K | TRI estime: 38% | Payback: 10mo
3. Anacarde brut SEN->IND | Ticket: 25K | TRI estime: 55% | Payback: 8mo
4. Mangue sechee COL->US | Ticket: 40K | TRI estime: 28% | Payback: 18mo
5. Cafe specialty ETH->DE | Ticket: 35K | TRI estime: 32% | Payback: 12mo

TOTAL INVESTI : 180K EUR
TRI MOYEN PONDERE : 35%
DIVERSIFICATION : 5 pays, 5 produits, 3 continents

Chaque deal est documente avec :
- Business plan IA complet (3 scenarios)
- Benchmarks de couts de production reels
- Corridors logistiques chiffres
- Reglementation et barrieres tarifaires

Ce type de diversification geographique et sectorielle est rare sur les marches emergents.`,
    cta: 'Voir les deals disponibles ->',
  },
  {
    day: 10,
    subject_a: 'Comment Feel The Gap selectionne les deals (notre scoring)',
    subject_b: 'Due diligence automatisee : le scoring IA explique',
    body: `{FIRST_NAME},

Notre scoring repose sur 7 dimensions :

1. GAP SCORE (30%) — Difference offre/demande reelle, donnees UN Comtrade + FAO
2. MARGIN POTENTIAL (20%) — Benchmarks de couts de production + logistique
3. REGULATORY RISK (15%) — Tarifs douaniers, certifications, accords bilateraux
4. LOGISTICS SCORE (10%) — Couts et delais par corridor (maritime/aerien/routier)
5. MARKET GROWTH (10%) — Tendance de croissance du gap sur 5 ans
6. COMPETITION INDEX (10%) — Nombre de concurrents positionnes sur le gap
7. ENTREPRENEUR QUALITY (5%) — Completude du profil, engagement plateforme

Seuls les deals avec un score > 70/100 sont presentes aux investisseurs.

Chaque dimension est calculee a partir de donnees reelles (pas de projections fantaisistes). Notre base contient :
- 442 benchmarks de couts de production
- 225 corridors logistiques chiffres
- 327 regles reglementaires sur 30 pays

Souhaitez-vous qu'on programme un appel de 20 minutes pour discuter de vos criteres d'investissement ?`,
    cta: 'Planifier un appel de 20 minutes ->',
  },
  {
    day: 18,
    subject_a: 'Programme investisseur fondateur — acces privilegie + advisory',
    subject_b: 'Rejoignez nos 5 premiers investisseurs partenaires',
    body: `{FIRST_NAME},

Nous ouvrons un programme "Investisseur Fondateur" pour les 5 premiers investisseurs qui rejoignent la plateforme :

CE QUE VOUS RECEVEZ :
- Acces anticipe a tous les deals (avant publication generale)
- Filtres personnalises selon vos criteres (geographie, secteur, ticket, TRI minimum)
- 1 rapport mensuel "Top 10 Deals" genere par notre IA
- Seat advisory board Feel The Gap (influence sur la roadmap produit)
- Co-investissement facilite entre membres du programme

CE QU'ON VOUS DEMANDE :
- Feedback trimestriel sur la qualite des deals
- Ticket minimum de 20K EUR sur au moins 1 deal dans les 6 premiers mois
- Participation a 1 advisory call par trimestre (30 min max)

Actuellement 2 places prises sur 5. L'offre est strictement limitee.`,
    cta: 'Postuler au programme Investisseur Fondateur ->',
  },
]

// ── LINKEDIN DM SEQUENCES ───────────────────────────────────────────────────

const LINKEDIN_DM_ENTREPRENEURS: LinkedInMsg[] = [
  {
    step: 'Connection Request',
    message: `Bonjour {FIRST_NAME}, je travaille sur le commerce international {COUNTRY_FROM}-{COUNTRY_TO} et j'ai vu votre activite dans {INDUSTRY}. J'aimerais echanger avec vous sur les opportunites dans ce corridor. — Mehdi, Feel The Gap`,
  },
  {
    step: 'Follow-up J+2 (apres acceptation)',
    message: `Merci pour la connexion {FIRST_NAME} ! Je voulais partager une donnee que j'ai trouvee en analysant les flux commerciaux : le gap {PRODUCT} sur {COUNTRY_TO} est de {GAP_VALUE}M$ — c'est un marche sous-approvisionne avec des marges de {MARGIN_PCT}%. On a un outil gratuit qui cartographie tout ca si ca vous interesse : feel-the-gap.com/map`,
  },
  {
    step: 'Value-add J+7',
    message: `{FIRST_NAME}, suite a notre echange, j'ai genere un mini-rapport IA pour {PRODUCT} vers {COUNTRY_TO}. Les 3 points cles : 1/ Gap de {GAP_VALUE}M$ 2/ Capex entre {CAPEX_MIN} et {CAPEX_MAX} EUR 3/ ROI estime en {ROI_MONTHS} mois. Le rapport complet (business plan + fournisseurs + logistique) est dans notre version Strategy. Je peux vous activer un essai gratuit de 7 jours si ca vous interesse ?`,
  },
]

const LINKEDIN_DM_INFLUENCEURS: LinkedInMsg[] = [
  {
    step: 'Connection Request',
    message: `Salut {FIRST_NAME} ! J'ai decouvert votre contenu sur {PLATFORM} — j'adore ce que vous faites sur {NICHE}. On lance un programme d'affiliation pour createurs de contenu dans le commerce international. Ca pourrait vous plaire.`,
  },
  {
    step: 'Follow-up J+2',
    message: `Merci pour la connexion ! En bref : Feel The Gap est une plateforme de donnees commerciales mondiales. On paie 18% de commission recurrente aux createurs qui partagent des opportunites avec leur audience. Nos top affilies gagnent 200-800EUR/mois. Voici un exemple de contenu qui convertit bien : "Saviez-vous que la CIV produit 40% du cacao mondial mais transforme seulement 5% sur place ?" — ce type de hook genere 5-8% de taux de clic. Interesse(e) ?`,
  },
  {
    step: 'CTA J+5',
    message: `{FIRST_NAME}, je vous ai prepare un lien pour creer votre espace influenceur : feel-the-gap.com/influencer. Vous aurez acces a votre dashboard, vos liens trackes, et du contenu pret a poster. Bonus : 50EUR credites sur votre premiere vente. N'hesitez pas si vous avez des questions !`,
  },
]

const LINKEDIN_DM_FINANCEURS: LinkedInMsg[] = [
  {
    step: 'Connection Request',
    message: `Bonjour {FIRST_NAME}, je dirige Feel The Gap — une plateforme d'intelligence commerciale qui genere des dossiers de financement pre-qualifies pour PME export. Je vois que vous etes chez {COMPANY} et j'aimerais discuter de synergies potentielles.`,
  },
  {
    step: 'Follow-up J+3',
    message: `{FIRST_NAME}, merci pour la connexion. Pour vous donner du contexte concret : notre IA genere des business plans complets avec scoring DSCR, benchmarks de couts reels (442 datapoints), et corridors logistiques chiffres sur 30 pays. Un exemple : dossier cacao CIV->EU, DSCR 2.4x, capex 180K EUR, payback 14 mois. On offre 3 mois d'acces gratuit au dashboard financeur pour les institutions pilotes. Ca vous interesse ?`,
  },
  {
    step: 'CTA J+8',
    message: `{FIRST_NAME}, je me permets de relancer car l'offre pilote financeur (3 mois gratuits) se termine bientot. On a deja 3 institutions partenaires et il reste 7 places. Si vous voulez, je peux vous envoyer un dossier exemple complet par email — quel est le meilleur email pour vous joindre ?`,
  },
]

const LINKEDIN_DM_INVESTISSEURS: LinkedInMsg[] = [
  {
    step: 'Connection Request',
    message: `Bonjour {FIRST_NAME}, je construis Feel The Gap — une SaaS d'intelligence commerciale qui identifie les gaps import/export par IA. Notre deal flow couvre le commerce Afrique et pays emergents. J'aimerais echanger sur vos criteres d'investissement.`,
  },
  {
    step: 'Follow-up J+4',
    message: `{FIRST_NAME}, merci pour la connexion. En quelques chiffres : nous avons identifie > 50Mds$ de gaps commerciaux sur 30 pays, genere 36 business plans complets, et construit une base de 442 benchmarks de couts + 225 corridors logistiques. Notre portfolio type (5 deals diversifies) affiche un TRI moyen de 35%. On offre un programme "Investisseur Fondateur" avec acces anticipe aux deals + seat advisory. Interesse ?`,
  },
]

// ── CONTENT HOOKS BY INDUSTRY ───────────────────────────────────────────────

const CONTENT_HOOKS = [
  { industry: 'Cacao', hook_fr: 'Le gap cacao CIV->EU vaut 4.2 milliards $. La CIV produit 40% du cacao mondial mais transforme seulement 5% sur place.', hook_en: 'The cocoa gap CIV->EU is worth $4.2B. Ivory Coast produces 40% of world cocoa but processes only 5% locally.', score: 87 },
  { industry: 'Textile', hook_fr: 'Les marges textile Vietnam->France atteignent 45%. Le gap textile ethique en Europe vaut 1.8Mds $.', hook_en: 'Vietnam->France textile margins reach 45%. The ethical textile gap in Europe is worth $1.8B.', score: 82 },
  { industry: 'Cafe', hook_fr: 'Le cafe specialty ethiopien se vend 3x plus cher en Europe. Gap cafe ETH->DE : 890M$.', hook_en: 'Ethiopian specialty coffee sells at 3x in Europe. Coffee gap ETH->DE: $890M.', score: 79 },
  { industry: 'Anacarde', hook_fr: 'Le Senegal exporte 90% de ses anacards bruts. La transformation locale offre une marge de 60%.', hook_en: 'Senegal exports 90% of cashews raw. Local processing offers 60% margins.', score: 91 },
  { industry: 'Mangue', hook_fr: 'La mangue sechee colombienne connait une croissance de 25%/an aux USA. Gap identifie : 340M$.', hook_en: 'Colombian dried mango grows 25%/year in the US. Gap identified: $340M.', score: 74 },
  { industry: 'Huile de palme', hook_fr: 'L\'huile de palme durable certifiee RSPO a un premium de 15-20% en Europe.', hook_en: 'RSPO-certified sustainable palm oil carries a 15-20% premium in Europe.', score: 76 },
  { industry: 'Energie renouvelable', hook_fr: 'Opportunite energie renouvelable en Afrique : score 87/100. Le gap solaire au Sahel = 12GW non exploites.', hook_en: 'Renewable energy opportunity in Africa: score 87/100. Sahel solar gap = 12GW untapped.', score: 87 },
  { industry: 'Agro-transformation', hook_fr: 'L\'agro-transformation en Afrique ne represente que 10% du PIB agricole. Gap valorisable : > 100Mds $/an.', hook_en: 'Agro-processing in Africa represents only 10% of agricultural GDP. Addressable gap: >$100B/year.', score: 93 },
]

// ── VIDEO STRATEGY ──────────────────────────────────────────────────────────

const VIDEO_SCRIPTS = [
  {
    target: 'Entrepreneur (generique)',
    duration: '30 sec',
    script: `[Face camera] "Saviez-vous que {COUNTRY_TO} importe pour {IMPORT_VALUE} millions de dollars de {PRODUCT} par an... mais que seulement {SUPPLY_PCT}% est couvert par les producteurs actuels ? [Montrer ecran FTG] J'ai utilise Feel The Gap pour identifier ce gap commercial. En 30 secondes, l'IA m'a genere un business plan complet : capex, marge, fournisseurs, logistique. [CTA] Le compte de base est gratuit — lien en bio."`,
    when_to_use: 'Cold outreach a des entrepreneurs identifies, quand le taux d\'ouverture email < 15%',
  },
  {
    target: 'Influenceur',
    duration: '30 sec',
    script: `[Face camera] "Je viens de decouvrir comment gagner de l'argent en partageant des opportunites de commerce international. [Montrer dashboard] Feel The Gap me paie 18% de commission a chaque fois que quelqu'un s'abonne via mon lien. [Montrer earnings] En un mois, j'ai genere {EARNINGS} EUR juste en postant des stats sur le commerce africain. [CTA] Lien en bio pour creer votre compte influenceur."`,
    when_to_use: 'Outreach Instagram/TikTok DM a des micro-influenceurs business/Africa, quand le DM text ne convertit pas',
  },
  {
    target: 'Financeur',
    duration: '45 sec',
    script: `[Bureau professionnel] "En tant qu'institution financiere, votre defi est de trouver des dossiers PME export de qualite. [Montrer dashboard financeur] Feel The Gap genere des business plans complets avec scoring DSCR automatique. [Montrer exemple] Ce dossier cacao Cote d'Ivoire->Europe : DSCR 2.4x, capex 180K, payback 14 mois. [CTA] On offre 3 mois d'acces gratuit aux 10 premieres institutions partenaires."`,
    when_to_use: 'Suivi d\'un email non ouvert a J+5, envoye via LinkedIn InMail',
  },
]

const VIDEO_DECISION_TREE = [
  { condition: 'Email ouvert mais pas de clic apres email 2', action: 'Envoyer video personnalisee (HeyGen)' },
  { condition: 'Email non ouvert apres email 1', action: 'LinkedIn DM texte d\'abord, video apres si pas de reponse J+5' },
  { condition: 'LinkedIn connexion acceptee mais pas de reponse au DM', action: 'Video personnalisee via LinkedIn message' },
  { condition: 'Prospect a ouvert 3+ emails sans cliquer', action: 'Video de 30sec avec demo live de la plateforme' },
  { condition: 'Micro-influenceur (< 10K followers)', action: 'DM texte suffit (ratio effort/impact)' },
  { condition: 'Macro-influenceur (> 50K followers)', action: 'Video personnalisee obligatoire' },
  { condition: 'Institution financiere (C-level)', action: 'Video de 45sec, ton professionnel, donnees chiffrees' },
]

// ── AUTOMATION PIPELINE ─────────────────────────────────────────────────────

const PIPELINE_AGENTS = [
  {
    name: 'Data Collection Agent',
    frequency: 'Hebdomadaire (lundi 6h UTC)',
    stack: 'Claude Code agent + Apify + Apollo.io API + Hunter.io API',
    input: 'Sources list (Apollo, Hunter, LinkedIn public, Google Maps, trade fair PDFs)',
    output: 'contacts table in Supabase (email, name, company, industry, country, source)',
    free_limits: 'Apollo: 25/mo, Hunter: 25/mo, Apify: 48 runs/mo, LinkedIn: manual/public',
    monthly_contacts: '~400-600 contacts (free tier total)',
    implementation: `// agents/prospection-collector.ts
// 1. Apollo.io API: search "import export" + country filters -> 25 contacts
// 2. Hunter.io API: domain search on trade companies -> 25 verified emails
// 3. Apify: Instagram hashtag scraper for influencers -> 200 profiles
// 4. Google Maps: search "import export [city]" -> extract business listings
// 5. Trade fair PDF parser (Gemini vision): extract exhibitor contacts
// All results -> Supabase prospect_contacts table with dedup on email`,
  },
  {
    name: 'Enrichment Agent',
    frequency: 'Quotidien (apres collection)',
    stack: 'Claude Code agent + Gemini 2.5 Flash + public APIs',
    input: 'Raw contacts from prospect_contacts',
    output: 'Enriched contacts (company size, revenue estimate, social profiles, activity)',
    free_limits: 'Gemini: 260EUR credit, Clearbit free tier: 50/mo',
    monthly_contacts: 'All collected contacts',
    implementation: `// agents/prospection-enricher.ts
// 1. For each contact without enrichment:
//    a. Google search "{name} {company}" -> extract LinkedIn URL, website
//    b. If company website found: extract employee count, activity description
//    c. Gemini: classify into profile (entrepreneur/influenceur/financeur/investisseur)
//    d. Gemini: extract industry, country focus, estimated relevance (0-100)
// 2. Update prospect_contacts with enriched data
// 3. Flag contacts with relevance < 30 as low_priority`,
  },
  {
    name: 'Segmentation Agent',
    frequency: 'Post-enrichment (auto-trigger)',
    stack: 'Gemini 2.5 Flash classification',
    input: 'Enriched contacts',
    output: 'profile assignment + priority score + recommended sequence',
    free_limits: 'Included in Gemini credit',
    monthly_contacts: 'All enriched contacts',
    implementation: `// agents/prospection-segmenter.ts
// Rules engine + LLM fallback:
// IF title contains "CEO|Founder|Entrepreneur|Export" -> entrepreneur
// IF title contains "Influencer|Creator|Content" OR source=instagram/tiktok -> influenceur
// IF title contains "Credit|Finance|Lending|Bank" OR company in DFI_LIST -> financeur
// IF title contains "Investor|VC|Angel|Partner|Fund" -> investisseur
// ELSE -> Gemini classification based on full profile
// Assign priority: HIGH (>70 relevance), MEDIUM (40-70), LOW (<40)
// Assign sequence: email_v1 (default), linkedin_only (no email), video_priority (high-value)`,
  },
  {
    name: 'Personalization Agent',
    frequency: 'Pre-send (batch, 1h before outreach)',
    stack: 'Gemini 2.5 Flash + Supabase data',
    input: 'Segmented contact + profile + sequence template',
    output: 'Personalized email/DM with real data points from FTG database',
    free_limits: 'Included in Gemini credit',
    monthly_contacts: 'All contacts in active sequences',
    implementation: `// agents/prospection-personalizer.ts
// 1. For each contact in today's send queue:
//    a. Identify their country/industry from enrichment data
//    b. Query Supabase: opportunities, countries, business_plans matching their profile
//    c. Extract real numbers: gap_value, margin, capex, DSCR from our data
//    d. Gemini: generate personalized hook (1 sentence) based on their LinkedIn activity
//    e. Fill template variables: {FIRST_NAME}, {PRODUCT}, {COUNTRY}, {GAP_VALUE}, etc.
//    f. Select A/B subject line variant (alternate per contact)
// 2. Store personalized content in prospect_sequences table
// 3. Mark as ready_to_send`,
  },
  {
    name: 'Outreach Agent',
    frequency: 'Quotidien (9h heure locale du prospect)',
    stack: 'Resend API (email) + LinkedIn automation (manual queue)',
    input: 'Personalized messages from prospect_sequences',
    output: 'Sent messages with tracking IDs',
    free_limits: 'Resend: 100 emails/day free, 3000/mo. LinkedIn: manual (compliance)',
    monthly_contacts: '~3000 emails/mo + ~200 LinkedIn DMs/mo (manual)',
    implementation: `// agents/prospection-outreach.ts
// EMAIL:
// 1. Query prospect_sequences WHERE status=ready_to_send AND channel=email
// 2. For each (batch 50/hour to avoid spam flags):
//    a. Send via Resend API with tracking pixel
//    b. Custom headers: List-Unsubscribe, Reply-To
//    c. Store message_id, sent_at in prospect_sequence_events
// LINKEDIN (generates manual queue):
// 1. Query prospect_sequences WHERE channel=linkedin AND status=ready
// 2. Generate CSV: name, profile_url, message_text
// 3. Admin downloads CSV from /admin/prospection and sends manually
// NOTE: No LinkedIn automation tools (violates ToS). Manual sends only.`,
  },
  {
    name: 'Follow-up Agent',
    frequency: 'Quotidien (check opens/clicks, advance sequences)',
    stack: 'Resend webhooks + Supabase',
    input: 'Email events (open, click, bounce, unsubscribe)',
    output: 'Next sequence step trigger or sequence pause',
    free_limits: 'Resend webhooks: included',
    monthly_contacts: 'All active sequences',
    implementation: `// agents/prospection-followup.ts
// 1. Process Resend webhook events (via /api/webhooks/resend):
//    - open -> mark email_opened_at, if step=1 -> schedule step 2 at day+3
//    - click -> mark link_clicked_at, increase priority score
//    - bounce -> pause sequence, flag contact
//    - unsubscribe -> stop sequence, delete from future sends, GDPR log
// 2. For contacts in sequence but not yet due:
//    - Check if next step date reached -> queue for personalization+send
// 3. Escalation rules:
//    - 3 opens, 0 clicks -> switch to video outreach
//    - 0 opens after 2 emails -> switch to LinkedIn channel
//    - Click on CTA but no signup -> send reminder at +48h`,
  },
  {
    name: 'Conversion Agent',
    frequency: 'Temps reel (Supabase trigger)',
    stack: 'Supabase DB trigger + Resend',
    input: 'New user signup on Feel The Gap (profiles table insert)',
    output: 'Updated sequence status + welcome email + onboarding nudges',
    free_limits: 'Supabase triggers: included, Resend: included in quota',
    monthly_contacts: 'All new signups',
    implementation: `// Supabase trigger: on INSERT profiles -> check prospect_contacts match
// If match found:
//   1. Update prospect_contacts.status = 'converted'
//   2. Stop outreach sequence
//   3. Start onboarding sequence:
//      - Day 0: Welcome email with guided tour link (demo/tour?parcours={profile})
//      - Day 1: "Did you explore the map?" nudge
//      - Day 3: "Here's your personalized opportunity report" (Gemini-generated)
//      - Day 7: "Upgrade to Data plan — save your searches" (if still explorer)
//      - Day 14: "7-day free Strategy trial" (if engaged but not upgraded)
// If no match: new organic user -> start retention sequence`,
  },
  {
    name: 'Reporting Agent',
    frequency: 'Hebdomadaire (dimanche 20h UTC)',
    stack: 'Supabase queries + Resend (report email)',
    input: 'All prospect_* tables',
    output: 'Weekly metrics report emailed to admin',
    free_limits: 'All included',
    monthly_contacts: 'N/A (admin only)',
    implementation: `// agents/prospection-reporter.ts
// Queries:
// 1. SELECT COUNT(*) FROM prospect_contacts WHERE created_at > now() - interval '7d' -> new contacts
// 2. SELECT profile, COUNT(*) FROM prospect_contacts GROUP BY profile -> distribution
// 3. SELECT step, COUNT(*), AVG(opened::int), AVG(clicked::int) FROM prospect_sequences -> funnel
// 4. SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '7d' -> new signups
// 5. SELECT tier, COUNT(*) FROM profiles WHERE tier != 'explorer' -> paying users
// Format as HTML email with charts (inline SVG)
// Send to admin@feelthegap.app via Resend`,
  },
]

// ── BUDGET BREAKDOWN ────────────────────────────────────────────────────────

const BUDGET_TABLE = [
  { tool: 'Resend (email)', free_limit: '100/jour, 3000/mo', cost_1k: '0 EUR (dans la limite)', cost_5k: '20 EUR/mo (Starter)', cost_10k: '20 EUR/mo (100K emails incl.)' },
  { tool: 'Apollo.io', free_limit: '25 credits/mo', cost_1k: '0 EUR (free tier)', cost_5k: '49 USD/mo (Basic)', cost_10k: '49 USD/mo' },
  { tool: 'Hunter.io', free_limit: '25 searches/mo', cost_1k: '0 EUR', cost_5k: '49 EUR/mo (Starter)', cost_10k: '49 EUR/mo' },
  { tool: 'Apify', free_limit: '48 runs/mo, 5 USD credit', cost_1k: '0 EUR', cost_5k: '49 USD/mo (Personal)', cost_10k: '49 USD/mo' },
  { tool: 'Gemini AI (credit)', free_limit: '260 EUR credit (expire 06/07/26)', cost_1k: '0 EUR', cost_5k: '0 EUR (credit)', cost_10k: '~20 EUR/mo apres credit' },
  { tool: 'HeyGen (video)', free_limit: '1 video/jour gratuit', cost_1k: '0 EUR', cost_5k: '24 USD/mo (Creator)', cost_10k: '24 USD/mo' },
  { tool: 'Supabase', free_limit: '500 MB, 50K rows', cost_1k: '0 EUR', cost_5k: '25 USD/mo (Pro)', cost_10k: '25 USD/mo' },
  { tool: 'Vercel', free_limit: 'Hobby (100GB bandwidth)', cost_1k: '0 EUR', cost_5k: '20 USD/mo (Pro)', cost_10k: '20 USD/mo' },
  { tool: 'Modash', free_limit: '50 searches/mo', cost_1k: '0 EUR', cost_5k: '0 EUR (free tier)', cost_10k: '120 EUR/mo (Essentials)' },
  { tool: 'Claude Code (agents)', free_limit: 'Existing subscription', cost_1k: '0 EUR', cost_5k: '0 EUR', cost_10k: '0 EUR' },
  { tool: 'TOTAL MENSUEL', free_limit: '—', cost_1k: '0 EUR', cost_5k: '~236 USD (~220 EUR)', cost_10k: '~327 USD (~305 EUR)' },
]

// ── KPIs & TARGETS ──────────────────────────────────────────────────────────

const KPIS = [
  { metric: 'Contacts sources / mois', month1: '400', month3: '2,000', month6: '5,000', target: '10,000' },
  { metric: 'Emails envoyes / mois', month1: '1,200', month3: '6,000', month6: '15,000', target: '30,000' },
  { metric: 'Taux d\'ouverture', month1: '25%', month3: '30%', month6: '35%', target: '35%+' },
  { metric: 'Taux de reponse', month1: '3%', month3: '5%', month6: '7%', target: '8%+' },
  { metric: 'Taux de clic (CTA)', month1: '4%', month3: '6%', month6: '8%', target: '10%+' },
  { metric: 'Inscriptions demo / mois', month1: '30', month3: '150', month6: '500', target: '1,000' },
  { metric: 'Demo -> compte gratuit', month1: '60%', month3: '65%', month6: '70%', target: '75%' },
  { metric: 'Gratuit -> payant', month1: '3%', month3: '5%', month6: '7%', target: '8%' },
  { metric: 'Nouveaux payants / mois', month1: '1', month3: '8', month6: '35', target: '80' },
  { metric: 'MRR', month1: '99 EUR', month3: '1,200 EUR', month6: '5,000 EUR', target: '12,000 EUR' },
  { metric: 'CAC (cout acquisition client)', month1: '0 EUR', month3: '~28 EUR', month6: '~15 EUR', target: '< 20 EUR' },
  { metric: 'LTV/CAC ratio', month1: 'Infini (0 cost)', month3: '~12x', month6: '~22x', target: '> 10x' },
]

// ── TIMELINE (8 WEEKS) ──────────────────────────────────────────────────────

const TIMELINE = [
  {
    week: 1,
    title: 'Infrastructure & Premier Batch',
    tasks: [
      { task: 'Creer tables Supabase: prospect_contacts, prospect_sequences, prospect_events', agent: true, hours: 2 },
      { task: 'Developper Data Collection Agent (Apollo + Hunter + Google Maps)', agent: true, hours: 4 },
      { task: 'Developper Enrichment Agent (Gemini classification)', agent: true, hours: 3 },
      { task: 'Collecter premier batch: 100 entrepreneurs, 50 influenceurs', agent: true, hours: 2 },
      { task: 'Configurer Resend: domaine, DKIM, templates de base', agent: false, hours: 1 },
      { task: 'Creer page /admin/prospection (cette page)', agent: true, hours: 3 },
    ],
    deliverable: '100 contacts enrichis + pipeline operationnel',
  },
  {
    week: 2,
    title: 'Sequences Email & Premier Envoi',
    tasks: [
      { task: 'Developper Personalization Agent (template filling avec data FTG)', agent: true, hours: 3 },
      { task: 'Developper Outreach Agent (Resend integration + tracking)', agent: true, hours: 3 },
      { task: 'Envoyer Email 1 a 100 entrepreneurs (A/B test sujets)', agent: true, hours: 1 },
      { task: 'Envoyer 20 connexions LinkedIn manuelles (entrepreneurs)', agent: false, hours: 2 },
      { task: 'Poster 3 contenus sur r/importexport et r/Entrepreneur', agent: false, hours: 1 },
      { task: 'Creer 5 hooks Instagram (stories) pour test', agent: true, hours: 1 },
    ],
    deliverable: '100 emails envoyes + 20 connexions LinkedIn + mesures ouverture',
  },
  {
    week: 3,
    title: 'Follow-up & Influenceurs',
    tasks: [
      { task: 'Developper Follow-up Agent (webhook Resend + sequences)', agent: true, hours: 3 },
      { task: 'Envoyer Email 2 aux entrepreneurs qui ont ouvert Email 1', agent: true, hours: 0.5 },
      { task: 'Collecter 50 influenceurs (Instagram + TikTok hashtag search)', agent: true, hours: 2 },
      { task: 'Lancer sequence Email 1 influenceurs (50 contacts)', agent: true, hours: 1 },
      { task: 'Envoyer 10 DMs Instagram manuels a micro-influenceurs', agent: false, hours: 1 },
      { task: 'Creer 1 video HeyGen (entrepreneur generique)', agent: false, hours: 1 },
      { task: 'Analyser metriques S2: open rate, click rate, premiers signups', agent: true, hours: 1 },
    ],
    deliverable: '150 contacts en sequence + 5-10 premiers signups + metriques',
  },
  {
    week: 4,
    title: 'Financeurs & Optimisation',
    tasks: [
      { task: 'Collecter 30 contacts financeurs (LinkedIn + annuaires DFI)', agent: true, hours: 2 },
      { task: 'Lancer sequence Email 1 financeurs (30 contacts)', agent: true, hours: 1 },
      { task: 'Envoyer 15 connexions LinkedIn financeurs', agent: false, hours: 1 },
      { task: 'A/B test: optimiser sujets emails entrepreneurs (meilleur variant)', agent: true, hours: 1 },
      { task: 'Developper Conversion Agent (Supabase trigger on signup)', agent: true, hours: 2 },
      { task: 'Deployer webhook Resend /api/webhooks/resend', agent: true, hours: 2 },
      { task: 'Envoyer Email 3 (cas d\'usage) aux entrepreneurs chauds', agent: true, hours: 0.5 },
    ],
    deliverable: '200+ contacts en sequence + conversion tracking operationnel',
  },
  {
    week: 5,
    title: 'Scale & Investisseurs',
    tasks: [
      { task: 'Collecter batch 2: 200 entrepreneurs supplementaires', agent: true, hours: 2 },
      { task: 'Collecter 20 investisseurs (Crunchbase + AngelList + LinkedIn)', agent: true, hours: 2 },
      { task: 'Lancer sequence investisseurs (20 contacts)', agent: true, hours: 1 },
      { task: 'Relancer influenceurs non-repondants par video HeyGen', agent: false, hours: 1 },
      { task: 'Developper Reporting Agent (weekly report email)', agent: true, hours: 2 },
      { task: 'Poster 5 contenus supplementaires Reddit + Quora', agent: false, hours: 1 },
    ],
    deliverable: '400+ contacts totaux + 20-30 signups + premier MRR',
  },
  {
    week: 6,
    title: 'Contenu & Community',
    tasks: [
      { task: 'Creer 10 posts LinkedIn (donnees FTG) pour thought leadership', agent: true, hours: 2 },
      { task: 'Generer 20 hooks industrie-specifiques avec Gemini', agent: true, hours: 1 },
      { task: 'Lancer Email 4 (scoring personnalise) aux entrepreneurs actifs', agent: true, hours: 1 },
      { task: 'Relancer financeurs: Email 2 avec dossier exemple concret', agent: true, hours: 0.5 },
      { task: 'Creer 3 videos HeyGen par industrie (cacao, textile, cafe)', agent: false, hours: 1 },
      { task: 'Rejoindre 5 LinkedIn groups et poster 1 contenu/groupe/semaine', agent: false, hours: 2 },
    ],
    deliverable: '30+ pieces de contenu + 50+ signups cumules',
  },
  {
    week: 7,
    title: 'Conversion Push & Offres Speciales',
    tasks: [
      { task: 'Email 5 (offre trial 7j Strategy) a tous les entrepreneurs actifs', agent: true, hours: 1 },
      { task: 'Email 4 (bonus 50EUR) a tous les influenceurs engages', agent: true, hours: 1 },
      { task: 'Email 3 (offre pilote 3 mois) aux financeurs engages', agent: true, hours: 0.5 },
      { task: 'Email 4 (programme fondateur) aux investisseurs engages', agent: true, hours: 0.5 },
      { task: 'Collecter batch 3: 300 contacts supplementaires toutes categories', agent: true, hours: 3 },
      { task: 'Analyser full funnel: source -> email -> signup -> paid', agent: true, hours: 1 },
      { task: 'Optimiser sequences basees sur les metriques reelles', agent: true, hours: 2 },
    ],
    deliverable: 'Offres speciales envoyees + premiers clients payants confirmes',
  },
  {
    week: 8,
    title: 'Systematisation & Scale Plan',
    tasks: [
      { task: 'Automatiser collecte hebdomadaire (cron Vercel /api/cron/prospection)', agent: true, hours: 2 },
      { task: 'Mettre en place alertes automatiques (nouveau signup, conversion, churn risk)', agent: true, hours: 2 },
      { task: 'Documenter playbook complet (ce qui marche, ce qui ne marche pas)', agent: true, hours: 1 },
      { task: 'Calculer CAC reel vs targets', agent: true, hours: 0.5 },
      { task: 'Decision: upgrade vers plans payants (Apollo/Hunter/HeyGen) si ROI positif', agent: false, hours: 0.5 },
      { task: 'Planifier mois 3-6: scale a 5000 contacts/mois', agent: true, hours: 1 },
    ],
    deliverable: 'Pipeline 100% automatise + playbook + plan de scale',
  },
]

// ── RENDER ───────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Vue d\'ensemble', icon: '📊' },
  { key: 'entrepreneurs', label: 'Entrepreneurs', icon: '🧭' },
  { key: 'influenceurs', label: 'Influenceurs', icon: '🎤' },
  { key: 'financeurs', label: 'Financeurs', icon: '🏦' },
  { key: 'investisseurs', label: 'Investisseurs', icon: '📈' },
  { key: 'pipeline', label: 'Pipeline AI', icon: '🤖' },
  { key: 'budget', label: 'Budget', icon: '💰' },
  { key: 'kpis', label: 'KPIs', icon: '🎯' },
  { key: 'timeline', label: 'Timeline', icon: '📅' },
]

function Badge({ children, color = '#C9A84C' }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide" style={{ background: `${color}20`, color }}>
      {children}
    </span>
  )
}

function SectionCard({ title, children, accent = '#C9A84C' }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="bg-[#0D1117] border border-white/10 rounded-xl p-5 mb-4">
      <h3 className="text-white font-bold text-base mb-3 flex items-center gap-2">
        <span className="w-1 h-5 rounded-full" style={{ background: accent }} />
        {title}
      </h3>
      {children}
    </div>
  )
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/10">
            {headers.map((h, i) => (
              <th key={i} className="text-left py-2 px-3 text-gray-400 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="py-2 px-3 text-gray-300">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EmailSequenceView({ emails, profile }: { emails: EmailTemplate[]; profile: string }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  return (
    <div className="space-y-2">
      {emails.map((email, i) => (
        <div key={i} className="bg-[#111827] border border-white/5 rounded-lg overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === i ? null : i)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-[#C9A84C]/20 text-[#C9A84C] flex items-center justify-center text-xs font-bold">J{email.day}</span>
              <div>
                <div className="text-sm text-white font-medium">Email {i + 1} — Jour {email.day}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">A: {email.subject_a}</div>
              </div>
            </div>
            <span className="text-gray-500 text-lg">{expanded === i ? '-' : '+'}</span>
          </button>
          {expanded === i && (
            <div className="px-4 pb-4 space-y-3">
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Sujet A (test)</div>
                <div className="text-sm text-[#C9A84C] bg-[#C9A84C]/5 px-3 py-2 rounded font-mono">{email.subject_a}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Sujet B (test)</div>
                <div className="text-sm text-blue-400 bg-blue-400/5 px-3 py-2 rounded font-mono">{email.subject_b}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Corps du message</div>
                <pre className="text-xs text-gray-300 bg-black/30 px-3 py-2 rounded whitespace-pre-wrap font-sans leading-relaxed">{email.body}</pre>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">CTA</div>
                <div className="text-sm text-emerald-400 bg-emerald-400/10 px-3 py-2 rounded font-bold">{email.cta}</div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function LinkedInSequenceView({ messages }: { messages: LinkedInMsg[] }) {
  return (
    <div className="space-y-3">
      {messages.map((msg, i) => (
        <div key={i} className="bg-[#111827] border border-white/5 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
            <span className="text-xs text-blue-400 font-medium">{msg.step}</span>
          </div>
          <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{msg.message}</pre>
        </div>
      ))}
    </div>
  )
}

// ── PROFILE SECTION RENDERER ────────────────────────────────────────────────

function ProfileSection({ profile, sources, emails, linkedinDMs, color }: {
  profile: string
  sources: Source[]
  emails: EmailTemplate[]
  linkedinDMs: LinkedInMsg[]
  color: string
}) {
  return (
    <div className="space-y-4">
      {/* Sources */}
      <SectionCard title={`A. Bases de donnees gratuites (${sources.length} sources)`} accent={color}>
        <DataTable
          headers={['Source', 'Limite gratuite', 'Contacts estimes/mo', 'GDPR']}
          rows={sources.map(s => [s.name, s.free_limit, s.estimated_contacts, s.gdpr_notes])}
        />
        <div className="mt-3 text-xs text-gray-500">
          Total estime: <span className="text-white font-bold">{sources.reduce((acc, s) => {
            const match = s.estimated_contacts.match(/(\d+)/)
            return acc + (match ? parseInt(match[1]) : 0)
          }, 0)}+ contacts/mois</span> (free tier uniquement)
        </div>
      </SectionCard>

      {/* Email Sequence */}
      <SectionCard title={`B. Sequence email (${emails.length} emails, A/B test)`} accent={color}>
        <EmailSequenceView emails={emails} profile={profile} />
      </SectionCard>

      {/* LinkedIn DMs */}
      <SectionCard title={`C. Sequence LinkedIn DM (${linkedinDMs.length} messages)`} accent={color}>
        <LinkedInSequenceView messages={linkedinDMs} />
      </SectionCard>

      {/* Content Hooks */}
      {profile === 'entrepreneurs' && (
        <SectionCard title="D. Hooks par industrie" accent={color}>
          <div className="space-y-2">
            {CONTENT_HOOKS.map((hook, i) => (
              <div key={i} className="flex items-start gap-3 bg-[#111827] border border-white/5 rounded-lg p-3">
                <div className="shrink-0">
                  <div className="text-[10px] text-gray-500 mb-0.5">Score</div>
                  <div className={`text-lg font-bold ${hook.score >= 85 ? 'text-emerald-400' : hook.score >= 75 ? 'text-[#C9A84C]' : 'text-blue-400'}`}>{hook.score}</div>
                </div>
                <div className="flex-1">
                  <div className="text-xs text-white font-medium mb-1">{hook.industry}</div>
                  <div className="text-xs text-gray-400">{hook.hook_fr}</div>
                  <div className="text-[10px] text-gray-600 mt-1 italic">{hook.hook_en}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Video Strategy (entrepreneurs only) */}
      {profile === 'entrepreneurs' && (
        <SectionCard title="E. Strategie video (HeyGen free tier)" accent={color}>
          <div className="space-y-3 mb-4">
            {VIDEO_SCRIPTS.map((v, i) => (
              <div key={i} className="bg-[#111827] border border-white/5 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge>{v.duration}</Badge>
                  <span className="text-xs text-white font-medium">{v.target}</span>
                </div>
                <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed mb-2">{v.script}</pre>
                <div className="text-[10px] text-gray-500">Quand utiliser: {v.when_to_use}</div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Arbre de decision: video vs texte</div>
          <div className="space-y-1">
            {VIDEO_DECISION_TREE.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 shrink-0">SI</span>
                <span className="text-gray-300 flex-1">{d.condition}</span>
                <span className="text-gray-500 shrink-0">ALORS</span>
                <span className="text-[#C9A84C]">{d.action}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}

// ── MAIN PAGE ───────────────────────────────────────────────────────────────

export default function ProspectionPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Plan de Prospection Massif</h1>
            <p className="text-xs text-gray-500 mt-1">4 profils x sequences completes x pipeline AI x budget 0 EUR | Genere le 2026-04-10</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge color="#10B981">95% AI-EXECUTABLE</Badge>
            <Badge color="#C9A84C">BUDGET ~0 EUR</Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/10 px-4 pt-2 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-[#C9A84C]/10 text-[#C9A84C] border border-b-0 border-[#C9A84C]/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="mr-1">{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <SectionCard title="Resume executif">
              <div className="text-sm text-gray-300 space-y-2">
                <p>Ce plan couvre la prospection complete pour Feel The Gap sur 4 profils clients, avec des sequences email et LinkedIn personnalisees, un pipeline d'agents AI automatises, et un budget proche de 0 EUR.</p>
                <p>L'objectif a 6 mois: <span className="text-white font-bold">35 clients payants</span>, <span className="text-white font-bold">5,000 EUR MRR</span>, pipeline de <span className="text-white font-bold">5,000 contacts/mois</span>.</p>
              </div>
            </SectionCard>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Entrepreneurs', count: `${SOURCES_ENTREPRENEURS.length} sources`, color: '#C9A84C', emails: EMAILS_ENTREPRENEURS.length, dms: LINKEDIN_DM_ENTREPRENEURS.length },
                { label: 'Influenceurs', count: `${SOURCES_INFLUENCEURS.length} sources`, color: '#A78BFA', emails: EMAILS_INFLUENCEURS.length, dms: LINKEDIN_DM_INFLUENCEURS.length },
                { label: 'Financeurs', count: `${SOURCES_FINANCEURS.length} sources`, color: '#34D399', emails: EMAILS_FINANCEURS.length, dms: LINKEDIN_DM_FINANCEURS.length },
                { label: 'Investisseurs', count: `${SOURCES_INVESTISSEURS.length} sources`, color: '#60A5FA', emails: EMAILS_INVESTISSEURS.length, dms: LINKEDIN_DM_INVESTISSEURS.length },
              ].map((p, i) => (
                <div key={i} className="bg-[#0D1117] border border-white/10 rounded-xl p-4" style={{ borderColor: `${p.color}30` }}>
                  <div className="text-lg font-bold" style={{ color: p.color }}>{p.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{p.count}</div>
                  <div className="text-xs text-gray-400 mt-2">{p.emails} emails + {p.dms} LinkedIn DMs</div>
                </div>
              ))}
            </div>

            <SectionCard title="LinkedIn Groups cibles">
              <DataTable
                headers={['Groupe', 'Membres', 'Profil cible']}
                rows={LINKEDIN_GROUPS.map(g => [g.name, g.members, g.profile])}
              />
            </SectionCard>

            <SectionCard title="Subreddits cibles">
              <DataTable
                headers={['Subreddit', 'Membres', 'Pertinence']}
                rows={REDDIT_SUBS.map(s => [s.name, s.members, s.relevance])}
              />
            </SectionCard>

            <SectionCard title="Hashtags Instagram/TikTok a surveiller">
              <div className="flex flex-wrap gap-2">
                {SOCIAL_HASHTAGS.map((h, i) => (
                  <span key={i} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300">{h}</span>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── ENTREPRENEURS ── */}
        {activeTab === 'entrepreneurs' && (
          <ProfileSection
            profile="entrepreneurs"
            sources={SOURCES_ENTREPRENEURS}
            emails={EMAILS_ENTREPRENEURS}
            linkedinDMs={LINKEDIN_DM_ENTREPRENEURS}
            color="#C9A84C"
          />
        )}

        {/* ── INFLUENCEURS ── */}
        {activeTab === 'influenceurs' && (
          <ProfileSection
            profile="influenceurs"
            sources={SOURCES_INFLUENCEURS}
            emails={EMAILS_INFLUENCEURS}
            linkedinDMs={LINKEDIN_DM_INFLUENCEURS}
            color="#A78BFA"
          />
        )}

        {/* ── FINANCEURS ── */}
        {activeTab === 'financeurs' && (
          <ProfileSection
            profile="financeurs"
            sources={SOURCES_FINANCEURS}
            emails={EMAILS_FINANCEURS}
            linkedinDMs={LINKEDIN_DM_FINANCEURS}
            color="#34D399"
          />
        )}

        {/* ── INVESTISSEURS ── */}
        {activeTab === 'investisseurs' && (
          <ProfileSection
            profile="investisseurs"
            sources={SOURCES_INVESTISSEURS}
            emails={EMAILS_INVESTISSEURS}
            linkedinDMs={LINKEDIN_DM_INVESTISSEURS}
            color="#60A5FA"
          />
        )}

        {/* ── PIPELINE AI ── */}
        {activeTab === 'pipeline' && (
          <div className="space-y-4">
            <SectionCard title="Architecture du pipeline d'automatisation">
              <div className="text-xs text-gray-400 mb-4">
                8 agents AI interconnectes. Chaque agent est un script TypeScript executable par Claude Code ou en cron Vercel.
                Le pipeline tourne en continu avec une intervention humaine minimale (LinkedIn DMs uniquement).
              </div>
              <div className="flex items-center gap-2 flex-wrap mb-4">
                {PIPELINE_AGENTS.map((a, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-gray-300">{a.name}</span>
                    {i < PIPELINE_AGENTS.length - 1 && <span className="text-gray-600 text-xs">-&gt;</span>}
                  </span>
                ))}
              </div>
            </SectionCard>

            {PIPELINE_AGENTS.map((agent, i) => (
              <SectionCard key={i} title={`${i + 1}. ${agent.name}`} accent={['#C9A84C', '#A78BFA', '#34D399', '#60A5FA', '#F59E0B', '#EC4899', '#10B981', '#6366F1'][i]}>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Frequence</div>
                    <div className="text-xs text-white">{agent.frequency}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Stack</div>
                    <div className="text-xs text-white">{agent.stack}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Input</div>
                    <div className="text-xs text-gray-300">{agent.input}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Output</div>
                    <div className="text-xs text-gray-300">{agent.output}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Limites gratuites</div>
                    <div className="text-xs text-emerald-400">{agent.free_limits}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Volume mensuel</div>
                    <div className="text-xs text-white">{agent.monthly_contacts}</div>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Implementation</div>
                  <pre className="text-[10px] text-gray-400 bg-black/30 rounded p-3 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">{agent.implementation}</pre>
                </div>
              </SectionCard>
            ))}
          </div>
        )}

        {/* ── BUDGET ── */}
        {activeTab === 'budget' && (
          <div className="space-y-4">
            <SectionCard title="Couts par outil et par palier de scale">
              <DataTable
                headers={['Outil', 'Limite gratuite', 'A 1K contacts/mo', 'A 5K contacts/mo', 'A 10K contacts/mo']}
                rows={BUDGET_TABLE.map(b => [b.tool, b.free_limit, b.cost_1k, b.cost_5k, b.cost_10k])}
              />
            </SectionCard>

            <SectionCard title="Quand upgrader">
              <div className="space-y-2 text-xs text-gray-300">
                <div className="flex items-start gap-2">
                  <Badge color="#10B981">PHASE 1</Badge>
                  <span>Mois 1-2: 0 EUR. Tout en free tier. Volume: ~400 contacts/mois.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge color="#C9A84C">PHASE 2</Badge>
                  <span>Mois 3-4: Upgrader Resend (20 EUR) si volume email depasse 3000/mois. Apollo Basic (49 USD) si les 25 credits/mois sont insuffisants. Total: ~70 EUR/mois.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge color="#A78BFA">PHASE 3</Badge>
                  <span>Mois 5-6: Ajouter Hunter Starter (49 EUR) + HeyGen Creator (24 USD) si video prouve son ROI. Total: ~220 EUR/mois. A ce stade, le MRR devrait etre de 5,000 EUR+ (ratio cout/revenu: 4.4%).</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge color="#60A5FA">PHASE 4</Badge>
                  <span>Mois 6+: Supabase Pro (25 USD) + Vercel Pro (20 USD) quand les limites free sont atteintes. Total: ~305 EUR/mois pour 10K contacts. MRR cible: 12,000 EUR (ratio: 2.5%).</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="ROI projete">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#111827] rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-400">0 EUR</div>
                  <div className="text-xs text-gray-500 mt-1">Cout mois 1</div>
                  <div className="text-xs text-gray-400 mt-2">Free tier uniquement</div>
                </div>
                <div className="bg-[#111827] rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-[#C9A84C]">~220 EUR</div>
                  <div className="text-xs text-gray-500 mt-1">Cout mois 6</div>
                  <div className="text-xs text-gray-400 mt-2">MRR: 5,000 EUR | ROI: 22x</div>
                </div>
                <div className="bg-[#111827] rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400">~305 EUR</div>
                  <div className="text-xs text-gray-500 mt-1">Cout mois 12</div>
                  <div className="text-xs text-gray-400 mt-2">MRR: 12,000 EUR | ROI: 39x</div>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── KPIs ── */}
        {activeTab === 'kpis' && (
          <div className="space-y-4">
            <SectionCard title="Objectifs et metriques cles">
              <DataTable
                headers={['Metrique', 'Mois 1', 'Mois 3', 'Mois 6', 'Cible long terme']}
                rows={KPIS.map(k => [k.metric, k.month1, k.month3, k.month6, k.target])}
              />
            </SectionCard>

            <SectionCard title="Funnel de conversion cible">
              <div className="space-y-2">
                {[
                  { stage: 'Contact source', value: '10,000', pct: '100%', color: '#60A5FA' },
                  { stage: 'Email envoye', value: '8,000', pct: '80%', color: '#818CF8' },
                  { stage: 'Email ouvert', value: '2,800', pct: '35%', color: '#A78BFA' },
                  { stage: 'CTA clique', value: '280', pct: '10%', color: '#C084FC' },
                  { stage: 'Inscription demo', value: '168', pct: '60%', color: '#E879F9' },
                  { stage: 'Compte gratuit cree', value: '126', pct: '75%', color: '#F472B6' },
                  { stage: 'Upgrade payant', value: '10', pct: '8%', color: '#C9A84C' },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-40 text-xs text-gray-400">{step.stage}</div>
                    <div className="flex-1 bg-white/5 rounded-full h-6 overflow-hidden relative">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: step.pct, background: step.color }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold">
                        {step.value} ({step.pct})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Repartition par profil (cible mois 6)">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { profile: 'Entrepreneurs', pct: '60%', paying: '21', mrr: '2,900 EUR', color: '#C9A84C' },
                  { profile: 'Influenceurs', pct: '25%', paying: '8', mrr: '800 EUR', color: '#A78BFA' },
                  { profile: 'Financeurs', pct: '10%', paying: '4', mrr: '600 EUR', color: '#34D399' },
                  { profile: 'Investisseurs', pct: '5%', paying: '2', mrr: '700 EUR', color: '#60A5FA' },
                ].map((p, i) => (
                  <div key={i} className="bg-[#111827] rounded-lg p-3 text-center border border-white/5" style={{ borderColor: `${p.color}30` }}>
                    <div className="text-xs font-bold" style={{ color: p.color }}>{p.profile}</div>
                    <div className="text-lg font-bold text-white mt-1">{p.paying}</div>
                    <div className="text-[10px] text-gray-500">payants ({p.pct} du volume)</div>
                    <div className="text-xs text-gray-400 mt-1">{p.mrr}/mois</div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── TIMELINE ── */}
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            {TIMELINE.map((week, wi) => (
              <SectionCard key={wi} title={`Semaine ${week.week}: ${week.title}`} accent={['#C9A84C', '#A78BFA', '#34D399', '#60A5FA', '#F59E0B', '#EC4899', '#10B981', '#6366F1'][wi]}>
                <div className="space-y-1 mb-3">
                  {week.tasks.map((task, ti) => (
                    <div key={ti} className="flex items-center gap-2 text-xs">
                      <Badge color={task.agent ? '#10B981' : '#F59E0B'}>{task.agent ? 'AGENT' : 'HUMAN'}</Badge>
                      <span className="text-gray-300 flex-1">{task.task}</span>
                      <span className="text-gray-500 shrink-0">{task.hours}h</span>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-500 border-t border-white/5 pt-2">
                  Livrable: <span className="text-white">{week.deliverable}</span>
                </div>
                <div className="text-[10px] text-gray-600 mt-1">
                  Total: {week.tasks.reduce((a, t) => a + t.hours, 0)}h ({week.tasks.filter(t => t.agent).reduce((a, t) => a + t.hours, 0)}h agent + {week.tasks.filter(t => !t.agent).reduce((a, t) => a + t.hours, 0)}h humain)
                </div>
              </SectionCard>
            ))}

            <SectionCard title="Resume des 8 semaines">
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-[#111827] rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-[#C9A84C]">{TIMELINE.reduce((a, w) => a + w.tasks.reduce((b, t) => b + t.hours, 0), 0)}h</div>
                  <div className="text-xs text-gray-500">Total heures</div>
                </div>
                <div className="bg-[#111827] rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-emerald-400">{TIMELINE.reduce((a, w) => a + w.tasks.filter(t => t.agent).reduce((b, t) => b + t.hours, 0), 0)}h</div>
                  <div className="text-xs text-gray-500">Heures agent</div>
                </div>
                <div className="bg-[#111827] rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-amber-400">{TIMELINE.reduce((a, w) => a + w.tasks.filter(t => !t.agent).reduce((b, t) => b + t.hours, 0), 0)}h</div>
                  <div className="text-xs text-gray-500">Heures humain</div>
                </div>
                <div className="bg-[#111827] rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-blue-400">{Math.round(TIMELINE.reduce((a, w) => a + w.tasks.filter(t => t.agent).reduce((b, t) => b + t.hours, 0), 0) / TIMELINE.reduce((a, w) => a + w.tasks.reduce((b, t) => b + t.hours, 0), 0) * 100)}%</div>
                  <div className="text-xs text-gray-500">Automatisation</div>
                </div>
              </div>
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  )
}
