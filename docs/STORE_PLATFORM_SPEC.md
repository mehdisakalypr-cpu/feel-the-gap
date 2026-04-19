# FTG E-Commerce Platform — Spec complète
*Date : 2026-04-19 — version 1.0 — basé sur brief utilisateur*

---

## 1. Positionnement
- FTG fournit un **espace boutique e-commerce** clé-en-main aux clients abonnés (équivalent Shopify-light).
- **Responsabilité produits = client final** (FTG = hébergeur technique uniquement).
- Activable depuis l'étape "store" du parcours pays, ou depuis `/account/store` indépendamment.

## 2. Modèles de vente
Le client choisit (cases à cocher) un ou plusieurs modes :
- ☑ B2B (entreprises clientes, prix HT, quantités unitaires/grosses)
- ☑ B2C (particuliers, prix TTC, paniers individuels)
- ☑ Les deux (sections séparées dans la boutique : "Pour pros" / "Pour particuliers")

## 3. CMS produits
Pour chaque produit :
- **Conditionnement** :
  - Unités entières (ex: 1 pièce, 1 sachet)
  - Quantité au poids : grammes / kilos / tonnes
  - Litres / m³ pour liquides ou volumineux
- **Description** (rich text markdown)
- **Photos** (jusqu'à 10, ordre drag&drop, première = couverture)
- **Vidéos** (URL YouTube/Vimeo ou upload max 100 Mo)
- **Prix** (HT B2B + TTC B2C séparés si bi-mode)
- **Stock initial** (incrémenté/décrémenté à chaque vente, alert seuil bas)
- **Références** (SKU, EAN, GTIN)
- **Fiche produit légale** : normes, labels (bio, équitable, AOP…), documents obligatoires (déclarations, certifications)
- **Catégorie** (hiérarchique)
- **Visibilité** : actif / brouillon / archivé

## 4. Discount system
### 4.1 Codes promo
- Création : code (ex `SUMMER25`), montant ou pourcentage, max usages, date début/fin
- Application : panier checkout ou produit spécifique
- Empilement : oui/non configurable

### 4.2 Discount % en lot
- Bouton "Appliquer un discount"
- Sélecteur produits (cases à cocher)
- % de réduction
- Date début + date fin
- À l'expiration : prix reviennent automatiquement aux prix normaux (cron)

## 5. Dashboard de pilotage des ventes
Accès : `/account/store/dashboard` après auth + 2FA optionnel
- **Tableau récap clients** : nom, email, ID, total dépensé, nb commandes, dernière commande
- **Liste commandes** : date, ID, client, produits, quantités, montant, statut (pending/paid/refunded)
- **Téléchargement factures PDF** par commande
- **Re-éditer une facture** (corrections autorisées avec versioning)
- **Déclencher remboursement** : partiel (montant exact) ou total
- **Modifier le facturant** :
  - Si client a un compte FTG avec email pro → option "facturer avec ma société"
  - Société du client = émetteur de la facture (ses infos légales)
- **Métriques** : CA jour/sem/mois, panier moyen, taux conversion, top produits

## 6. Stocks
- Saisie initiale par produit
- Décrément automatique à chaque vente (transaction atomique)
- Re-stock manuel ou via API
- Alertes seuil bas (configurable par produit)
- Historique mouvements (in/out/adjust) avec timestamp + cause

## 7. 2FA
- Optionnel (recommandé fortement pour boutiques avec CA > €500/mois)
- Méthodes : TOTP (Google Authenticator) + WebAuthn (biométrie)
- Réutilise l'infra `auth-v2` déjà en place

## 8. Conformité légale (CGU/CGV boutique)
### 8.1 Du client (sa propre boutique)
- **OBLIGATOIRE pour activer** la boutique
- 2 options :
  - Utiliser **template FTG** (généré, multi-pays) — couvre RGPD UE + droits consommateur
  - Importer **ses propres CGU/CGV** (upload PDF + copy-paste markdown)
- Pages publiques de la boutique : `/store/<slug>/cgu`, `/store/<slug>/cgv`, `/store/<slug>/mentions-legales`, `/store/<slug>/cookies`

### 8.2 De FTG (envers le client boutique)
- Document à signer lors de la création de la boutique : **CGV FTG E-Commerce Service**
- Inspiré de Shopify ToS / Lemon Squeezy / Webflow
- Points clés :
  - FTG fournit infrastructure + outils, pas de produit
  - Responsabilité légale produits = 100% client (vendeur)
  - FTG n'intervient pas dans les transactions (pas marchand de référence sauf option Stripe Connect Marketplace)
  - Données client = propriété client (RGPD)
  - Limite responsabilité FTG : montant abonnement 12 derniers mois
  - Suspension/résiliation pour violation
  - Juridiction : France (tribunal Paris)

→ Document généré : `/root/legal/STORE_FTG_CGV_TEMPLATE.md`

## 9. Tier gating
| Feature | Tier requis |
|---|---|
| Activer 1 boutique | premium ou ultimate |
| Activer 2-5 boutiques | ultimate |
| Boutiques illimitées | custom (enterprise) |
| Discount system | premium |
| 2FA | tous tiers |
| Multi-langue boutique | strategy+ |
| Domaine custom | premium+ |

## 10. Pricing FTG sur les ventes boutique
- 0% commission pendant les 6 premiers mois (acquisition)
- Puis 0.5% commission GMV (Shopify : 0%, mais via Stripe : 2.9%+0.30€)
- Stripe fees répercutés au client (pas absorbés)
- Option Plus : 0% commission + frais mensuels +€49/mo

## 11. Architecture technique
### 11.1 Tables Supabase (cf migration `20260419230000_ecommerce_platform.sql`)
- `stores` (boutique = 1 par compte par défaut)
- `store_settings` (B2B/B2C flags, billing entity, custom domain)
- `store_products`
- `store_product_media` (photos/vidéos)
- `store_product_categories`
- `store_orders`
- `store_order_items`
- `store_invoices` (versioning)
- `store_refunds`
- `store_stock_movements`
- `store_discount_codes`
- `store_discount_campaigns` (% sur lot, time-bounded)
- `store_legal_docs` (CGU, CGV, mentions, cookies — versioned per store)

### 11.2 API routes
- `/api/store/products` (CRUD)
- `/api/store/orders` (lecture admin client)
- `/api/store/checkout` (checkout Stripe)
- `/api/store/invoices/[id]` (PDF generation)
- `/api/store/refund` (Stripe refund + log)
- `/api/store/discount-codes` (CRUD)
- `/api/store/stock` (lecture + ajustement)
- `/api/store/legal/upload` (upload CGV/CGU custom)
- `/api/store/activate` (gate 2FA + signature CGV FTG)

### 11.3 Pages publiques boutique
- `/store/[slug]` (vitrine)
- `/store/[slug]/products/[id]`
- `/store/[slug]/cart`
- `/store/[slug]/checkout`
- `/store/[slug]/cgv`, `/cgu`, `/mentions-legales`, `/cookies`
- `/store/[slug]/account` (espace client final)

### 11.4 Pages admin client (boutique owner)
- `/account/store` (onboarding + activation)
- `/account/store/products` (CMS)
- `/account/store/orders`
- `/account/store/dashboard` (analytics)
- `/account/store/discounts` (codes + campagnes)
- `/account/store/stocks`
- `/account/store/legal` (CGV/CGU/mentions)
- `/account/store/settings` (B2B/B2C, billing, domain, 2FA)

## 12. Roadmap d'implémentation (4 phases)
| Phase | Scope | ETA |
|---|---|---|
| **P1 - MVP** | Schema DB + activation + 1 boutique, products CRUD, checkout simple, CGV FTG signée | 2 semaines |
| **P2 - Sales** | Dashboard client, factures PDF, stocks, discount codes | 1-2 semaines |
| **P3 - Polish** | Discount campaigns %, 2FA dédié, refunds, billing entity custom | 1 semaine |
| **P4 - Scale** | B2B/B2C dual mode, multi-langue boutique, custom domain, marketplace mode | 2-3 semaines |

**Total estimé : 6-8 semaines** pour version 1.0 commerciale stable.

## 13. Inspirations
- **Shopify** : modèle Service-as-Provider, ToS, billing entity
- **Lemon Squeezy** : merchant of record (option future)
- **Stripe Connect** : split paiement multi-vendor (mode marketplace)
- **WooCommerce** : richesse fonctionnelle CMS produits
- **Snipcart** : intégration JS lightweight (modèle léger)
