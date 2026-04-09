# Feel The Gap — Business Models

> Document de référence. Mis à jour : 2026-04-06.

---

## 1. Plans d'abonnement SaaS

### Explorer — Gratuit
**Cible :** Curieux, étudiants, première découverte.

**Accès :**
- Carte mondiale interactive avec filtres par catégorie de produit
- Vue d'ensemble des balances commerciales par pays
- Top catégorie d'import / export par pays
- Score d'opportunité indicatif (niveau)
- 1 fiche pays gratuite par mois

**Monétisation :** Aucune directe. Funnel d'acquisition.

---

### Data — 29 €/mois
**Cible :** Analystes marché, importateurs/exportateurs, chercheurs.

**Accès :**
- Tout Explorer
- Sauvegarde illimitée de recherches avec filtres actifs
- Opportunités matérialisées sur la carte (pays par pays)
- Fiche opportunité par pays avec volume d'affaires potentiel estimé
- Historique complet des recherches
- Export données CSV
- Alertes email sur nouvelles opportunités dans les catégories suivies

**Accès coupé si abonnement inactif :**
- Historique masqué (données conservées, réactivées au paiement)
- Opportunités disparaissent de la carte
- Fiches opportunités inaccessibles

---

### Strategy — 99 €/mois
**Cible :** Entrepreneurs, PME, équipes commerciales.

**Accès :**
- Tout Data
- Génération de business plans IA (dépenses, actions, ROI, Capex/Opex)
- AI Advisor : cahiers des charges + rapports d'actions concrètes
- Opportunity Farming : scanner de produit avec identification de typologies clientes et géographies
- Création d'offres d'affiliation pour les vendeurs en ligne (lien affilié plateforme)
- Crédits IA à la consommation (l'AI Advisor consomme des tokens facturés 4× le coût infrastructure)

**Crédits AI Advisor :**
- Compteur visible en temps réel dans l'interface
- Seuil d'alerte : 1 € restant → invitation à recharger
- Recharges : 10 / 20 / 50 / 75 / 100 €
- Traitement Stripe (paiement one-shot, non-abonnement)
- Crédits stockés en cents dans `profiles.ai_credits`

**Accès coupé si abonnement inactif :**
- Tout Data coupé +
- Plans d'action inaccessibles
- Offres d'affiliation désactivées

---

### Premium — 149 €/mois
**Cible :** Marques, distributeurs cherchant des audiences qualifiées.

**Accès :**
- Tout Strategy
- Accès au réseau d'influenceurs : audiences localisées, niches, reach par réseau social
- Matching influenceur ↔ produit basé sur la géographie de l'audience et la catégorie
- AI Advisor prospection active : l'IA identifie et contacte les influenceurs pertinents pour le produit du client
- Dashboard performance affiliation : clics, conversions, CA généré par influenceur

**Accès coupé si abonnement inactif :**
- Tout Strategy coupé +
- Réseau influenceurs masqué
- Campagnes d'influence en pause

---

### Enterprise — Sur mesure
**Cible :** Groupes, institutions, ONG, gouvernements.

**Accès :**
- Tout Premium
- Recherche pays / secteur personnalisée
- Rapports white-label
- Accès API REST
- Analyste dédié
- SLA & contrats sur mesure

---

## 2. Réseau d'influence & affiliation

### Principe général

Les distributeurs (plan Strategy+) qui vendent en ligne peuvent créer des **offres d'affiliation** sur la plateforme. Les influenceurs (accès gratuit) choisissent les offres correspondant à leur audience et obtiennent un **lien unique tracké** à partager.

La plateforme **collecte la commission** du distributeur et **reverse la part influenceur** automatiquement via Stripe Connect.

---

### Acteurs

| Acteur | Plan requis | Rôle |
|--------|------------|------|
| Distributeur / Vendeur | Strategy+ | Crée des offres, fournit lien affilié + commission |
| Influenceur | Gratuit | Choisit des offres, partage son lien unique |
| Premium client | Premium | Accède aux audiences, IA prospecte les influenceurs |

---

### Lien tracké

**Format :** `https://feel-the-gap.com/go/{unique_code}`

- `unique_code` = code alphanumérique court (8 chars) unique en base
- Associé à `(offer_id, influencer_id)` dans la table `affiliate_links`
- Le serveur enregistre le clic, puis redirige vers l'URL affiliée du distributeur
- Paramètres tracking du distributeur sont préservés dans le redirect

---

### Flow de conversion

```
1. Influenceur partage son lien feel-the-gap.com/go/ABC123
2. Follower clique → log clic en DB → redirect vers URL distributeur
3. Follower achète sur le site du distributeur
4. Distributeur confirme la conversion (webhook postback ou déclaration manuelle)
5. Stripe débite la commission au distributeur
6. Plateforme garde 30% de la commission brute
7. 70% transférés à l'influenceur via Stripe Connect Transfer
```

---

### Split de commission

```
Commission brute (ex : 15 % × panier de 100 € = 15 €)
├── Platform : 30 % = 4,50 €
└── Influenceur : 70 % = 10,50 €
```

Le taux de split est configurable par offre dans les limites de la plateforme.

---

### Stripe Connect (payouts influenceurs)

- À l'inscription, l'influenceur crée un compte **Stripe Connect Express** (KYC simplifié, IBAN ou carte)
- Les conversions sont créditées en attente (`pending`) sur leur solde interne
- Virements déclenchés automatiquement J+7 après confirmation de conversion
- Seuil minimum de virement : 20 € (évite les micro-transactions)
- Dashboard influenceur : solde en attente, solde disponible, historique virements

---

### Tables base de données

```sql
-- Profil influenceur
influencer_profiles (
  id uuid PK → profiles.id,
  platform_handle text,           -- @handle unique plateforme
  social_networks jsonb,          -- [{platform, url, followers, engagement_rate}]
  audience_data jsonb,            -- {geos: [{country, pct}], niches: [...], age_range: ...}
  stripe_account_id text,         -- Stripe Connect Express account ID
  payout_threshold_cents int default 2000,
  total_earned_cents int default 0,
  created_at timestamptz
)

-- Offres d'affiliation créées par les vendeurs
affiliate_offers (
  id uuid PK,
  seller_id uuid → profiles.id,
  product_name text,
  product_description text,
  product_url text,
  affiliate_base_url text,        -- URL de base avec les params du vendeur
  commission_pct numeric(5,2),    -- % du panier reversé à la plateforme
  platform_split_pct numeric(5,2) default 30, -- % que la plateforme garde
  category text,                  -- catégorie produit (align avec CategoryFilter)
  target_geos text[],             -- pays cibles
  status text default 'active',   -- active | paused | ended
  created_at timestamptz
)

-- Lien unique par (offer, influencer)
affiliate_links (
  id uuid PK,
  unique_code text UNIQUE,        -- code court 8 chars
  offer_id uuid → affiliate_offers.id,
  influencer_id uuid → influencer_profiles.id,
  clicks int default 0,
  conversions int default 0,
  total_earned_cents int default 0,
  created_at timestamptz
)

-- Conversions déclarées / confirmées
affiliate_conversions (
  id uuid PK,
  link_id uuid → affiliate_links.id,
  sale_amount_cents int,
  commission_gross_cents int,     -- commission brute (sale × commission_pct)
  platform_cut_cents int,         -- 30 % de commission_gross
  influencer_payout_cents int,    -- 70 % de commission_gross
  status text default 'pending',  -- pending | confirmed | paid | disputed
  stripe_charge_id text,          -- charge Stripe sur le compte vendeur
  stripe_transfer_id text,        -- transfer Stripe vers influenceur
  created_at timestamptz,
  confirmed_at timestamptz,
  paid_at timestamptz
)

-- Virements influenceurs
influencer_payouts (
  id uuid PK,
  influencer_id uuid → influencer_profiles.id,
  amount_cents int,
  stripe_transfer_id text,
  status text,                    -- initiated | succeeded | failed
  created_at timestamptz
)
```

---

### Dashboard influenceur

Accessible depuis `/influencer` (lien dans la sidebar) :
- Offres disponibles (filtrées par niche / géo de l'audience)
- Mes liens actifs + stats (clics, conversions, CA)
- Solde en attente + solde disponible
- Historique virements
- Mon profil : réseaux sociaux + données audience

---

### Dashboard vendeur (Premium+)

Accessible depuis `/account` → onglet Affiliation :
- Mes offres actives
- Performance par influenceur (clics, conversions, CA)
- Carte des ventes par géographie (via les données d'audience influenceur)
- Recherche IA d'influenceurs (Premium uniquement)

---

## 3. Crédits AI Advisor

**Principe :** Chaque appel à l'AI Advisor consomme des tokens. Le coût est facturé à l'utilisateur à 4× le coût infrastructure (marge 75 %). Les crédits sont prépayés.

**Stockage :** `profiles.ai_credits` en **cents** (1000 = 10,00 €)

**Recharges disponibles :** 10 / 20 / 50 / 75 / 100 €

**Alerte automatique :** quand le solde atteint 1 €, une invitation à recharger s'affiche dans l'interface.

**Imputation :** avant chaque appel AI, on vérifie le solde via `deduct_ai_credits()`. Si insuffisant → message d'erreur + invite recharge.

---

## 4. Modèle économique synthétique

| Source | Mécanisme | Revenue |
|--------|-----------|---------|
| Abonnements SaaS | Stripe Subscriptions récurrentes | 29 / 99 / 149 € × nb abonnés |
| Crédits AI | Stripe one-shot, marge 75 % sur coût tokens | Variable |
| Commission affiliation | 30 % de la commission brute vendeur | Variable |
| Enterprise | Contrats custom | Négocié |

---

## 5. Règles d'accès (résumé)

| Fonctionnalité | Free | Data | Strategy | Premium |
|----------------|------|------|----------|---------|
| Carte mondiale | ✓ | ✓ | ✓ | ✓ |
| Fiches opportunités | — | ✓ | ✓ | ✓ |
| Sauvegardes recherches | — | ✓ | ✓ | ✓ |
| Business plans IA | — | — | ✓ | ✓ |
| AI Advisor (crédits) | — | — | ✓ | ✓ |
| Opportunity Farming | — | — | ✓ | ✓ |
| Créer offre affiliation | — | — | ✓ | ✓ |
| Réseau influenceurs | — | — | — | ✓ |
| IA prospecte influenceurs | — | — | — | ✓ |

**Si abonnement inactif :** tout ce qui était accessible devient masqué (données conservées) et se réactive immédiatement au paiement.
