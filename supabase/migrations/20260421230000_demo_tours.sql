-- Demo tours — onboarding bubbles guidés par parcours.
--
-- Chaque parcours (entrepreneur/financeur/investisseur/influenceur) a une
-- séquence d'étapes. Chaque étape pointe vers une URL cible + un sélecteur
-- DOM ('data-tour' attribute ou #id). Le renderer côté client affiche une
-- bulle ancrée à l'élément, avec Précédent/Suivant/Passer.

begin;

create table if not exists demo_tours (
  id          uuid primary key default gen_random_uuid(),
  parcours    text not null check (parcours in ('entrepreneur','financeur','investisseur','influenceur')),
  step_order  int not null,
  title_fr    text not null,
  title_en    text not null default '',
  body_fr     text not null default '',
  body_en     text not null default '',
  -- URL de la page qui doit être affichée pour que cette étape soit visible.
  -- Le renderer n'affiche l'étape que si la route courante matche target_url
  -- (match exact, ou préfixe si le target_url se termine par '/*').
  target_url  text not null,
  -- Sélecteur DOM pour ancrer la bulle (ex: '[data-tour="hero"]' ou '#plan-card-premium').
  -- Si null, la bulle est centrée en bas de l'écran.
  target_id   text,
  -- Position de la bulle par rapport à l'ancre: top, right, bottom, left.
  position    text not null default 'bottom' check (position in ('top','right','bottom','left')),
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (parcours, step_order)
);

create index if not exists idx_demo_tours_parcours_order
  on demo_tours(parcours, step_order) where published = true;

drop trigger if exists trg_demo_tours_updated on demo_tours;
create trigger trg_demo_tours_updated before update on demo_tours
  for each row execute function set_updated_at();

-- Public read of published steps.
alter table demo_tours enable row level security;
drop policy if exists "demo_tours_public_read" on demo_tours;
create policy "demo_tours_public_read" on demo_tours for select using (published = true);

-- Admin write via service_role only.
drop policy if exists "demo_tours_admin_write" on demo_tours;
create policy "demo_tours_admin_write" on demo_tours for all using (false) with check (false);

-- ─────────────────────────────────────────────────────────────
-- Seed d'amorçage — l'utilisateur complète via /admin/demo-parcours.
-- Ces premières étapes donnent le ton; le reste se configure via l'UI admin.
-- ─────────────────────────────────────────────────────────────

-- Chaque tour suit l'arc : 1.Problème → 2.Besoin → 3.Opportunité → 4.Solution FTG →
-- 5-6.Bénéfices ciblés → 7.CTA final. L'utilisateur affine/ajoute via /admin/demo-parcours.

insert into demo_tours (parcours, step_order, title_fr, title_en, body_fr, body_en, target_url, target_id, position, published) values

-- ═══════════════════════════════════════════════════════════════════════════
-- 🧭 ENTREPRENEUR
-- ═══════════════════════════════════════════════════════════════════════════
('entrepreneur', 1, 'Le problème',
  'The problem',
  '90 % des idées de business lancées échouent parce qu''elles partent d''une intuition, pas d''un gap documenté. Trouver une vraie opportunité prend des mois de recherche — que la plupart sautent.',
  '90% of business ideas fail because they start from a gut feeling, not a documented gap. Finding a real opportunity takes months of research — which most skip.',
  '/', '[data-tour="home-hero"]', 'bottom', true),

('entrepreneur', 2, 'Ce que vous cherchez vraiment',
  'What you''re really looking for',
  'Vous voulez un marché qui tire déjà (import/export en tension), un produit que vous savez faire ou apprendre, et une géo où vos chances de réussir sont maximisées.',
  'You want a market already pulling (import/export tension), a product you can make or learn, and a geography where your odds are stacked.',
  '/', '[data-tour="home-value-props"]', 'top', true),

('entrepreneur', 3, 'L''opportunité',
  'The opportunity',
  'Feel The Gap cartographie 938 000 opportunités sur 211 pays × 323 produits — chaque bulle est un couple avec un déficit d''offre documenté par les douanes.',
  'Feel The Gap maps 938,000 opportunities across 211 countries × 323 products — each bubble is a pair with a customs-documented supply gap.',
  '/map', '[data-tour="map-hero"]', 'bottom', true),

('entrepreneur', 4, 'La solution FTG',
  'The FTG solution',
  'Une seule plateforme pour : détecter le gap, noter l''opportunité, générer le business plan, trouver les suppliers, identifier les clients, lancer les relances. Sans zapper entre 10 outils.',
  'One platform to: spot the gap, score the opportunity, generate the business plan, find suppliers, identify clients, run outreach. No more juggling 10 tools.',
  '/map', '[data-tour="worldmap"]', 'right', true),

('entrepreneur', 5, 'Bénéfice ⏱️ — gain de temps',
  'Benefit ⏱️ — time saved',
  'Ce qui prend 3 mois de recherche en solo (douanes, stats, concurrence, BP, contacts) se fait en 3 jours sur FTG. L''avantage compétitif du lancement rapide.',
  'What takes 3 months of solo research (customs, stats, competition, BP, contacts) is done in 3 days on FTG. The first-mover edge of launching fast.',
  '/reports/*', '[data-tour="opportunity-score"]', 'left', true),

('entrepreneur', 6, 'Bénéfice 🧭 — accompagnement pas à pas',
  'Benefit 🧭 — step-by-step guidance',
  'Vous êtes guidé du choix du pays à la première vente : détection du gap → BP → suppliers → clients → outreach → site e-commerce. Pas besoin d''être expert.',
  'Guided from picking the country to the first sale: gap detection → BP → suppliers → clients → outreach → e-commerce site. No expertise required.',
  '/reports/*', '[data-tour="business-plan"]', 'top', true),

('entrepreneur', 7, 'Bénéfice 🤖 — IA adaptative',
  'Benefit 🤖 — adaptive AI',
  'L''IA apprend de vos choix (pays, produit, ambition) et personnalise chaque étape : marges locales, coûts de transport réels, clients alignés avec votre région.',
  'The AI learns from your choices (country, product, ambition) and personalises every step: local margins, real shipping costs, clients aligned with your region.',
  '/reports/*', '[data-tour="ai-personalization"]', 'right', true),

('entrepreneur', 8, 'Bénéfice 🧩 — end-to-end',
  'Benefit 🧩 — end-to-end',
  'Tout dans un seul outil : plus de zapping entre Alibaba, Statista, Canva, Mailchimp, Shopify. Un compte, un dashboard, un pipeline.',
  'Everything in one tool: no more juggling Alibaba, Statista, Canva, Mailchimp, Shopify. One account, one dashboard, one pipeline.',
  '/account', '[data-tour="account-overview"]', 'bottom', true),

('entrepreneur', 9, 'Prêt à commencer',
  'Ready to start',
  'Passez en Data (€29/mo) pour débloquer les opportunités + le BP. Ou démarrez gratuitement et explorez la carte.',
  'Upgrade to Data (€29/mo) to unlock opportunities + BP. Or start free and explore the map.',
  '/pricing', '[data-tour="pricing-plans"]', 'bottom', true),

-- ═══════════════════════════════════════════════════════════════════════════
-- 🏦 FINANCEUR
-- ═══════════════════════════════════════════════════════════════════════════
('financeur', 1, 'Le problème du sourcing crédit',
  'The credit sourcing problem',
  'Les dossiers arrivent mal préparés, mal standardisés, et il faut 3 allers-retours avant d''avoir les éléments d''un comité de crédit. Vous perdez des semaines par deal.',
  'Dossiers arrive ill-prepared and non-standard, taking 3 back-and-forths before credit committee material is ready. You lose weeks per deal.',
  '/finance', '[data-tour="finance-hero"]', 'bottom', true),

('financeur', 2, 'Ce qu''il vous faut',
  'What you need',
  'Des dossiers qui respectent déjà la grille d''analyse crédit (KYC, financials, projections, collateral, covenants) et un risk tier standardisé pour filtrer vite.',
  'Dossiers that already match the credit analysis framework (KYC, financials, projections, collateral, covenants) and a standardised risk tier to filter fast.',
  '/finance', '[data-tour="finance-value-props"]', 'top', true),

('financeur', 3, 'L''opportunité du marché',
  'The market opportunity',
  'Sur FTG, des milliers d''entrepreneurs ont une opportunité documentée et cherchent un financement entre 50k€ et 5M€. La plupart des banques n''ont pas ce deal flow.',
  'On FTG, thousands of entrepreneurs have a documented opportunity and seek financing between €50k and €5M. Most banks don''t have this deal flow.',
  '/finance', '[data-tour="marketplace-banner"]', 'bottom', true),

('financeur', 4, 'La solution FTG',
  'The FTG solution',
  'Deal flow anonymisé jusqu''à souscription Finance, dossiers standardisés, double scoring (qualité marché × qualité dossier), pipeline de suivi intégré.',
  'Deal flow anonymised until Finance subscription, standardised dossiers, dual scoring (market × dossier quality), integrated pipeline tracker.',
  '/finance/reports', '[data-tour="dossier-feed"]', 'top', true),

('financeur', 5, 'Bénéfice ⏱️ — 5× moins de temps par deal',
  'Benefit ⏱️ — 5× less time per deal',
  'Un dossier FTG arrive déjà à la grille crédit. Vous passez de 10 h d''analyse amont à 2 h, et vous traitez 3× plus de dossiers/semaine.',
  'An FTG dossier already matches the credit grid. You go from 10 h of upstream analysis to 2 h, processing 3× more dossiers/week.',
  '/finance/reports', '[data-tour="opportunity-score"]', 'left', true),

('financeur', 6, 'Bénéfice 🧭 — pipeline end-to-end',
  'Benefit 🧭 — end-to-end pipeline',
  'Dossier reçu → analyse → offre → acceptation/refus/counter → matching coordonnées → contact direct. Zéro Excel externe, tout tracé.',
  'Received → analysis → offer → accept/reject/counter → identity reveal → direct contact. Zero external spreadsheet, fully traced.',
  '/finance/dashboard', '[data-tour="pipeline-tracker"]', 'top', true),

('financeur', 7, 'Bénéfice 🤖 — scoring IA adaptatif',
  'Benefit 🤖 — adaptive AI scoring',
  'Le scoring apprend de vos refus et affine la ranking pour vous : moins de temps perdu, un pipeline qui ressemble à votre thèse.',
  'Scoring learns from your rejections and tunes ranking for you: less wasted time, a pipeline that mirrors your thesis.',
  '/finance/dashboard', '[data-tour="adaptive-scoring"]', 'right', true),

('financeur', 8, 'Bénéfice 👑 — Founding Pioneer',
  'Benefit 👑 — Founding Pioneer',
  'Les 50 premiers financeurs bénéficient de -30 % à vie sur tous les tiers. Zéro risque : le quota d''acceptations n''est consommé qu''à l''acceptation d''un deal.',
  'The first 50 financiers get -30% for life on every tier. Zero risk: the acceptance quota is consumed only when a deal is accepted.',
  '/pricing/funding', '[data-tour="founding-pioneer"]', 'top', true),

('financeur', 9, 'Activez votre accès',
  'Activate your access',
  'Explorer / Active / Pro. Commitment 1 / 12 / 24 / 36 mois (dégressif -10 / -20 / -30 %). Résiliable à tout moment en monthly.',
  'Explorer / Active / Pro. 1/12/24/36-month commitment (discount -10/-20/-30%). Cancel anytime on monthly.',
  '/pricing/funding', '[data-tour="pricing-tiers"]', 'bottom', true),

-- ═══════════════════════════════════════════════════════════════════════════
-- 📈 INVESTISSEUR
-- ═══════════════════════════════════════════════════════════════════════════
('investisseur', 1, 'Le problème du deal flow',
  'The deal flow problem',
  'Votre thèse est pointue — les deals entrants sont généralistes. Vous passez des heures à écarter 95 % du flux pour identifier les 5 % alignés.',
  'Your thesis is sharp — incoming deals are generalist. You spend hours filtering out 95% of the flow to find the 5% aligned.',
  '/invest', '[data-tour="invest-hero"]', 'bottom', true),

('investisseur', 2, 'Ce que vous cherchez',
  'What you''re looking for',
  'Des dossiers avec marché quantifié, traction prouvée, équipe solide et use of funds clair. Entrer early sans payer late-stage.',
  'Dossiers with a quantified market, proven traction, solid team and clear use of funds. Enter early without paying late-stage.',
  '/invest', '[data-tour="invest-value-props"]', 'top', true),

('investisseur', 3, 'L''opportunité',
  'The opportunity',
  'Sur FTG, des milliers d''entrepreneurs ont identifié un gap rentable dans leur pays et cherchent entre 100k€ et 5M€ en equity. Marchés émergents + diaspora couverts.',
  'On FTG, thousands of entrepreneurs have spotted a profitable gap in their country and seek €100k–€5M in equity. Emerging markets + diaspora covered.',
  '/invest', '[data-tour="marketplace-banner"]', 'bottom', true),

('investisseur', 4, 'La solution FTG',
  'The FTG solution',
  '17 sections standardisées de due diligence par dossier (équipe, marché, produit, traction, financials, cap table, use of funds, exit). Anonymisation jusqu''à matching.',
  '17 standardised due diligence sections per dossier (team, market, product, traction, financials, cap table, use of funds, exit). Anonymised until matching.',
  '/invest/reports', '[data-tour="dossier-feed"]', 'top', true),

('investisseur', 5, 'Bénéfice ⏱️ — DD prête',
  'Benefit ⏱️ — ready-made DD',
  '17 sections already structured. Vous sautez la phase "demander les docs" : due diligence raccourcie de 3-4 semaines à 1 semaine.',
  '17 sections already structured. Skip the "ask for docs" phase: due diligence cut from 3-4 weeks to 1 week.',
  '/invest/reports/*', '[data-tour="dd-sections"]', 'top', true),

('investisseur', 6, 'Bénéfice 🧭 — pipeline end-to-end',
  'Benefit 🧭 — end-to-end pipeline',
  'Offre → contre-proposition → accord → matching coordonnées → closing hors plateforme. Tout tracé dans un seul tableau de bord.',
  'Offer → counter-proposal → agreement → identity match → off-platform closing. All tracked in a single dashboard.',
  '/invest/dashboard', '[data-tour="pipeline-tracker"]', 'top', true),

('investisseur', 7, 'Bénéfice 🤖 — IA adaptative',
  'Benefit 🤖 — adaptive AI',
  'Alertes deal flow alignées avec votre thèse : secteur, ticket, stade, géo. L''IA apprend de vos passes et filtre les suivants en amont.',
  'Deal flow alerts aligned with your thesis: sector, ticket, stage, geo. The AI learns from your passes and filters incoming deals upstream.',
  '/invest/dashboard', '[data-tour="adaptive-alerts"]', 'right', true),

('investisseur', 8, 'Bénéfice 🔒 — contrôle founder protégé',
  'Benefit 🔒 — founder control protected',
  'Entrée minoritaire uniquement (max 33 %). Les founders gardent la barre → moins de conflits, meilleur alignement, churn post-closing quasi nul.',
  'Minority entry only (max 33%). Founders keep the wheel → less conflict, better alignment, near-zero post-closing churn.',
  '/invest', '[data-tour="valuation-principles"]', 'top', true),

('investisseur', 9, 'Activez votre accès',
  'Activate your access',
  'Explorer / Active / Pro avec Founding Pioneer -30 % à vie pour les 50 premiers. Quota = nombre d''acceptations/mois (pas d''offres envoyées).',
  'Explorer / Active / Pro with Founding Pioneer -30% for life for the first 50. Quota = number of acceptances/month (not offers sent).',
  '/pricing/funding', '[data-tour="pricing-tiers"]', 'bottom', true),

-- ═══════════════════════════════════════════════════════════════════════════
-- 🎤 INFLUENCEUR
-- ═══════════════════════════════════════════════════════════════════════════
('influenceur', 1, 'Le problème B2B',
  'The B2B problem',
  'Vous avez une audience B2B qualifiée (entrepreneurs, dirigeants, investisseurs) mais les programmes d''affiliation classiques paient mal et sur du one-shot.',
  'You have a qualified B2B audience (founders, execs, investors) but classic affiliate programs pay poorly and one-shot only.',
  '/influencer/welcome', '[data-tour="influencer-hero"]', 'bottom', true),

('influenceur', 2, 'Ce que votre audience attend',
  'What your audience wants',
  'Des outils qui résolvent un vrai problème (trouver un business, financer, investir) — pas un énième SaaS gadget.',
  'Tools that solve a real problem (finding a business, financing, investing) — not yet another gimmick SaaS.',
  '/influencer/welcome', '[data-tour="influencer-proof"]', 'top', true),

('influenceur', 3, 'L''opportunité',
  'The opportunity',
  'FTG sert 200+ pays, 4 parcours (entrepreneur / financeur / investisseur / influenceur). Chaque souscription paie une commission mensuelle récurrente.',
  'FTG serves 200+ countries, 4 parcours (entrepreneur / financier / investor / influencer). Every subscription pays a recurring monthly commission.',
  '/influencer/welcome', '[data-tour="influencer-markets"]', 'bottom', true),

('influenceur', 4, 'La solution FTG',
  'The FTG solution',
  'Programme affilié avec catalogue curé, liens trackés, pixel unique, dashboard revenus, paiement automatique via Stripe Connect. Zéro Excel.',
  'Affiliate program with curated catalogue, tracked links, unique pixel, revenue dashboard, auto-payout via Stripe Connect. Zero spreadsheets.',
  '/influencer', '[data-tour="influencer-dashboard"]', 'top', true),

('influenceur', 5, 'Bénéfice ⏱️ — 0 friction',
  'Benefit ⏱️ — 0 friction',
  'Création liens en 30 secondes, pas de tracking à coder, pas de reconciliation manuelle. Vous publiez, le système fait le reste.',
  'Link creation in 30 seconds, no tracking to code, no manual reconciliation. You publish, the system does the rest.',
  '/influencer', '[data-tour="link-builder"]', 'top', true),

('influenceur', 6, 'Bénéfice 💰 — commissions récurrentes',
  'Benefit 💰 — recurring commissions',
  'Pas une commission one-shot : tant que votre referral reste abonné, vous touchez chaque mois. ARR partagé, pas un CAC payé une fois.',
  'Not a one-shot commission: as long as your referral stays subscribed, you get paid monthly. Shared ARR, not a one-time CAC.',
  '/influencer', '[data-tour="influencer-commissions"]', 'left', true),

('influenceur', 7, 'Bénéfice 🤖 — IA adaptative',
  'Benefit 🤖 — adaptive AI',
  'L''IA analyse vos contenus postés et vous suggère les offres FTG qui convertissent le mieux pour votre niche — plus personnalisé que n''importe quel programme classique.',
  'The AI analyses your posted content and suggests the FTG offers that convert best for your niche — more personalised than any classic program.',
  '/influencer', '[data-tour="ai-suggestions"]', 'right', true),

('influenceur', 8, 'Bénéfice 🎨 — catalogue prêt à poster',
  'Benefit 🎨 — catalogue ready to post',
  'Posts, visuels et scripts vidéo prêts à l''emploi pour chaque offre. Vous publiez, vous encaissez.',
  'Posts, visuals and video scripts ready-to-use for every offer. You publish, you get paid.',
  '/influencer/catalog', '[data-tour="influencer-catalog"]', 'right', true),

('influenceur', 9, 'Activez votre compte',
  'Activate your account',
  'Créez votre profil influenceur, connectez Stripe, générez vos liens — 2 minutes, zéro code.',
  'Create your influencer profile, connect Stripe, generate your links — 2 minutes, zero code.',
  '/influencer/welcome', '[data-tour="activate-cta"]', 'bottom', true)

on conflict (parcours, step_order) do nothing;

commit;
