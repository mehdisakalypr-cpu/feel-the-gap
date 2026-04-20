# FTG Store Platform — Spec V2 (Additions)
*Date : 2026-04-19 — version 2.0 — audit SOTA + spec compléments e-commerce + marketplace B2B*

> **Périmètre** : ce document complète `STORE_PLATFORM_SPEC.md` (V1 — MVP boutique).
> Il liste les manques critiques vs SOTA 2026 (Shopify, Faire, Alibaba, Lemon Squeezy, Stripe Tax, Shippo) et fournit la spec actionnable pour combler les gaps **sans dépendance lourde** (Next.js 16 + Supabase + Stripe + Resend uniquement).
>
> Hiérarchisation : **P0** = bloquant launch ; **P1** = critique mois 1 ; **P2** = nice-to-have / post-launch.

---

## 1. Audit gap synthétique

### 1.1 Marketplace B2B (vs Faire / Alibaba / Tradeshift / ThomasNet / Joor)

| Domaine | État FTG | Référence SOTA | Gap | Prio |
|---|---|---|---|---|
| Search / discovery | Liste basique 50 items, pas de filtres | Faire algorithme reco produit + Alibaba 200M produits filtrés | Filtres avancés (cert, prix, MOQ, lead time, geo), full-text PG, vector search produits | P0 |
| RFQ workflow | `seller_quote_requests` existe (1-to-1) | Alibaba RFQ broadcast → 15 quotes en 6h depuis 200k suppliers | RFQ multi-supplier broadcast, table `marketplace_rfq` + `marketplace_rfq_responses` | P0 |
| Negotiation chat | Email seul (`new_match`, `match_confirmed`) | Faire/Alibaba inbox in-app temps réel, contre-offres | Table `marketplace_messages` + Supabase Realtime + counter-offers structurées | P1 |
| Trust & safety | Aucune vérification supplier | Alibaba "Verified Supplier" + audits BV/SGS | Badges supplier (KYB, IBAN check, 1er contrat livré, années d'activité, vidéo factory tour) | P0 |
| Logistics | `lib/transport/quotes.ts` Freightos+estimator OK | Flexport API, Freightos eBooking | Pré-booking transport intégré post-match (1-click), tracking ETA via Project44 free tier | P1 |
| Payment B2B | Stripe Connect escrow OK | Faire Net 60 + factoring | NET 30/60 (table `marketplace_credit_terms`), factoring partner Stenn/Marco (ext) | P1 |
| Trade finance | Aucun | Alibaba Trade Assurance escrow + LC partners | LC/BG = pas en MVP (trop lourd), escrow déjà couvre 80% du besoin | P2 |
| Multi-currency / FX | EUR-only `proposed_total_eur` | Stripe Connect multi-currency + Wise hedging | Colonne `currency` + table `fx_rates` (cron daily) + display préf user | P1 |
| Compliance | Aucun screening | Alibaba sanctions check + dual-use export controls | Sanctions screening via OFAC/EU/UN consolidated lists (gratuit, JSON dl daily) | P0 |
| Analytics seller | Page seller basique | Joor analytics (impressions, RFQs, conversion par produit, geo demand) | View matview `seller_metrics_30d` + page `/seller/analytics` | P1 |

### 1.2 E-commerce platform (vs Shopify / Lemon Squeezy / WooCommerce / Webflow)

| Domaine | État FTG (12 tables V1) | Référence SOTA | Gap | Prio |
|---|---|---|---|---|
| Variantes produit | Absent (1 produit = 1 SKU) | Shopify : variants size/color/material × 100 combos | Tables `store_product_variants` + `store_product_options` | P0 |
| Cart abandonment | Absent | Shopify Email + Klaviyo flows | Table `store_carts` (persistante) + cron recovery emails Resend (1h, 24h, 72h) | P0 |
| Shipping zones | Absent | Shopify shipping zones par pays + tarifs | Tables `store_shipping_zones`, `store_shipping_rates` + intégration Shippo | P0 |
| Carrier integration | Absent | Shippo 50+ carriers (Colissimo, Mondial Relay, Chronopost…) | Wrapper `lib/shipping/shippo.ts` (label gen + tracking) | P1 |
| Gift cards / store credit | Absent | Shopify natif | Table `store_gift_cards` + redemption code | P2 |
| Subscriptions | Absent | Shopify Subscriptions, Lemon Squeezy abos | Stripe Subscriptions wrapper + `store_subscription_plans` | P2 |
| Reviews & ratings | Absent | Shopify Reviews app, Trustpilot | Tables `store_product_reviews` + `store_review_media` + modération | P1 |
| Wishlist | Absent | Shopify natif via apps | Table `store_wishlists` (user_id × product_id) | P2 |
| Cross-sell / upsell | Absent | Shopify "Frequently bought together" | Champ `store_products.related_ids` + section composant | P1 |
| AI recommendations | Absent | Shopify Magic + Personalized for You | Embeddings produits via OpenAI ada-002 + vecteurs Supabase pgvector | P2 |
| Multi-store inventory | Absent | Shopify POS + warehouses | Table `store_warehouses` + `store_inventory_per_warehouse` | P2 |
| POS integration | Absent | Shopify POS hardware | Hors scope MVP (B2B-first) | P2 |
| Tax automation | `vat_rate_pct` champ statique | Stripe Tax 100+ pays, OSS UE auto | **Stripe Tax intégré natif** (déjà dans Stripe), config `automatic_tax: true` | P0 |
| Apps marketplace | Absent | Shopify App Store | Hors scope (FTG pas plateforme) | P2 |
| Webhooks API | Absent côté store | Shopify Webhooks 50+ topics | Réutiliser `api_webhooks` table existante (migration 20260418200000) | P1 |
| GDPR cookie banner | Page `/cookies` mais pas de banner | Shopify Cookie Consent banner | Composant `<CookieBanner>` GDPR-compliant + log consentement | P0 |
| A/B testing | Absent | Shopify Editions + Optimizely | Hors scope MVP | P2 |
| Email marketing | `lib/email/marketplace.ts` partiel | Klaviyo flows | Resend natif suffit pour transactionnels ; flows marketing = post-launch | P1 |
| SMS marketing | Absent | Shopify SMS + Klaviyo SMS | Hors scope MVP (Twilio coût) | P2 |
| SEO product schema | Absent | Shopify JSON-LD auto | `<script type="application/ld+json">` Product/Offer/Review dans `/store/[slug]/products/[id]` | P0 |
| Fraud detection | Absent côté store | Stripe Radar (gratuit avec Stripe) | **Activer Stripe Radar rules** (déjà inclus payment Stripe) | P0 |
| Dropshipping / fulfillment | Absent | Printful/Oberlo intégrés Shopify | Hors scope MVP (B2B-first FTG) | P2 |
| Marketplace mode (multi-vendor) | Stripe Connect existe (marketplace B2B) | Shopify marketplace via apps | Réutiliser le pattern Connect du marketplace B2B → option "fulfillment by FTG" | P2 |
| Login social acheteur | Auth-v2 admin only | Shopify Shop Pay + Google/Apple | Activer `signInWithOAuth` Google/Apple sur `/store/[slug]/account/login` | P1 |
| 2FA acheteur | 2FA admin uniquement | Shopify accounts 2FA | Étendre `auth-v2` aux comptes acheteurs (toggle profil) | P2 |
| Address book buyer | Absent | Shopify Customer Addresses | Table `store_buyer_addresses` (multi-adresses, livraison/facturation) | P0 |

---

## 2. Tables Supabase manquantes (DDL résumé)

### 2.1 P0 — Bloquant launch

```sql
-- Variantes produit (taille / couleur / matière)
create table store_product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references store_products(id) on delete cascade,
  name text not null,                        -- "Taille", "Couleur"
  position int not null default 0,
  values text[] not null default '{}'        -- ["S","M","L"]
);

create table store_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references store_products(id) on delete cascade,
  sku text,
  ean text,
  option_values jsonb not null,              -- {"Taille":"M","Couleur":"Rouge"}
  price_b2c_ttc_cents int,
  price_b2b_ht_cents int,
  stock_qty numeric(14,3) not null default 0,
  weight_g int,
  position int not null default 0,
  active boolean not null default true,
  unique (product_id, option_values)
);

-- Paniers persistants (B2C abandonné = revente possible)
create table store_carts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  buyer_user_id uuid references auth.users(id) on delete set null,
  buyer_email text,                          -- pour récupération sans compte
  items jsonb not null default '[]',         -- [{product_id, variant_id, qty}]
  subtotal_cents int not null default 0,
  currency text not null default 'EUR',
  status text not null default 'active' check (status in ('active','abandoned','converted','expired')),
  recovery_email_1_sent_at timestamptz,      -- 1h
  recovery_email_2_sent_at timestamptz,      -- 24h
  recovery_email_3_sent_at timestamptz,      -- 72h
  recovered_order_id uuid references store_orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index idx_carts_status on store_carts(status, updated_at desc);

-- Adresses acheteur (réutilisables checkout après checkout)
create table store_buyer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,                                -- "Maison", "Bureau"
  type text not null default 'both' check (type in ('shipping','billing','both')),
  full_name text not null,
  company text,
  line1 text not null, line2 text,
  postal_code text not null, city text not null,
  state text, country_iso2 text not null,
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Shipping zones + tarifs (par pays/poids/prix)
create table store_shipping_zones (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,                        -- "France métro", "UE", "Monde"
  country_codes text[] not null,             -- ['FR'], ['DE','BE','NL'], ['*']
  position int not null default 0
);

create table store_shipping_rates (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references store_shipping_zones(id) on delete cascade,
  name text not null,                        -- "Colissimo Standard 48h"
  carrier text,                              -- 'colissimo','mondial_relay','chronopost','dhl','ups'
  service_code text,                         -- code carrier API
  price_cents int not null,                  -- forfait
  free_above_cents int,                      -- gratuit si panier >= X
  weight_max_g int,
  delivery_days_min int, delivery_days_max int,
  active boolean not null default true
);

-- GDPR : log consentements cookie
create table store_cookie_consents (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  visitor_uuid text not null,                -- cookie anonyme
  consent_data jsonb not null,               -- {analytics:true, marketing:false}
  ip_hash text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index idx_cookie_consents_store on store_cookie_consents(store_id, created_at desc);
```

### 2.2 P1 — Critique mois 1

```sql
-- Reviews produits (modération avant publication)
create table store_product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references store_products(id) on delete cascade,
  order_id uuid references store_orders(id) on delete set null,  -- "verified purchase"
  buyer_user_id uuid references auth.users(id) on delete set null,
  buyer_name text,
  rating int not null check (rating between 1 and 5),
  title text,
  body text,
  status text not null default 'pending' check (status in ('pending','published','rejected','spam')),
  helpful_count int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_reviews_product on store_product_reviews(product_id, status);

-- Tracking expéditions (lié à store_orders)
create table store_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references store_orders(id) on delete cascade,
  carrier text not null,
  tracking_number text not null,
  tracking_url text,
  service_code text,
  label_url text,
  cost_cents int,
  status text not null default 'created' check (status in ('created','in_transit','out_for_delivery','delivered','exception','returned')),
  shipped_at timestamptz, delivered_at timestamptz,
  shippo_transaction_id text,
  created_at timestamptz not null default now()
);

-- FX rates (multi-currency marketplace)
create table fx_rates (
  base text not null default 'EUR',
  quote text not null,
  rate numeric(18,8) not null,
  fetched_at timestamptz not null default now(),
  primary key (base, quote, fetched_at)
);

-- Marketplace B2B : RFQ broadcast
create table marketplace_rfq (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  product_slug text not null,
  quantity_kg numeric not null,
  target_price_eur_per_kg numeric,
  required_certifications text[] default '{}',
  delivery_country_iso text,
  deadline date,
  status text not null default 'open' check (status in ('open','closed','awarded')),
  created_at timestamptz not null default now()
);

create table marketplace_rfq_responses (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references marketplace_rfq(id) on delete cascade,
  supplier_id uuid not null references auth.users(id) on delete cascade,
  price_eur_per_kg numeric not null,
  available_qty_kg numeric not null,
  lead_time_days int,
  validity_days int default 7,
  notes text,
  status text not null default 'submitted' check (status in ('submitted','accepted','rejected','withdrawn')),
  created_at timestamptz not null default now(),
  unique (rfq_id, supplier_id)
);

-- Messages in-app (Realtime)
create table marketplace_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,                   -- match_id ou rfq_id
  thread_type text not null check (thread_type in ('match','rfq','order')),
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  attachments jsonb default '[]',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_msgs_thread on marketplace_messages(thread_id, created_at desc);

-- Trust badges supplier
create table marketplace_supplier_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge text not null check (badge in ('kyb_verified','iban_verified','first_deal_done','5_deals_done','factory_video','iso_9001','organic_cert','years_3plus')),
  granted_at timestamptz not null default now(),
  evidence_url text,
  primary key (user_id, badge)
);

-- Sanctions screening cache
create table sanctions_screening (
  entity_hash text primary key,              -- sha256(name+country)
  entity_name text not null,
  country_iso2 text,
  hit boolean not null,
  lists_matched text[],                      -- ['ofac_sdn','eu_consolidated','un_1267']
  checked_at timestamptz not null default now()
);
```

### 2.3 P2 — Post-launch

Wishlists, gift cards, subscriptions, warehouses : DDL similaire — non détaillé ici par souci de brièveté (cf Shopify object reference).

---

## 3. Emails transactionnels (Resend)

| Trigger | Template | Variables clés | Délai |
|---|---|---|---|
| Cart abandonné | `cart_recovery_1` | `{first_name, store_name, items, recovery_url, total}` | T+1h |
| Cart abandonné | `cart_recovery_2` | idem + `discount_code` 5% | T+24h |
| Cart abandonné | `cart_recovery_3` | idem + `discount_code` 10% + scarcity | T+72h |
| Order paid | `order_confirmation` | `{order_id, items, total, invoice_url, tracking_signup_url}` | Immédiat (Stripe webhook) |
| Order shipped | `order_shipped` | `{tracking_number, carrier, tracking_url, eta}` | Webhook Shippo `transaction.updated` |
| Order delivered | `order_delivered` | `{order_id, review_url, support_email}` | Webhook Shippo `tracking.updated` status=DELIVERED |
| Refund issued | `refund_confirmation` | `{order_id, refund_amount, reason, eta_days}` | API `/store/refund` |
| Account created (buyer) | `welcome_buyer` | `{store_name, account_url, first_login_link}` | Signup |
| Password reset | `password_reset_otp` | déjà existant `auth-v2` | À la demande |
| Review request | `review_request` | `{order_id, product_name, review_url}` | T+7j post-delivery |
| Low stock alert | `low_stock_admin` | `{product_name, current_qty, threshold}` | Trigger DB stock < seuil |
| New order (admin) | `new_order_admin` | `{order_id, total, items, dashboard_url}` | Stripe webhook |
| Daily digest (admin) | `daily_sales_digest` | `{revenue_today, orders_count, top_products}` | Cron 8h UTC |
| RFQ received (B2B) | `rfq_new` | `{buyer_company, product, qty, response_url}` | Création RFQ |
| RFQ awarded (B2B) | `rfq_awarded` | `{buyer_company, contract_url}` | Acceptation supplier |

**Règle** : tous templates héritent de `lib/email/marketplace.ts::emailBase()` pour cohérence brand. Footer obligatoire avec `{unsubscribe_url}` (anti-spam UE) + adresse postale FTG.

---

## 4. Parcours acheteur E2E (B2C particulier)

| Étape | Page / Composant | API | Side-effect | Email |
|---|---|---|---|---|
| 1. Browse | `/store/[slug]` (existante) + `<ProductGrid>` filtré | `GET /api/store/[slug]/products` | Track view (PostHog opt-in cookie) | — |
| 2. Détail | `/store/[slug]/products/[id]` + `<VariantSelector>` (à créer) + JSON-LD Product/Offer/Review | `GET /api/store/[slug]/products/[id]` | — | — |
| 3. Add to cart | `<AddToCartButton>` | `POST /api/store/cart` (upsert sur `store_carts`) | Cookie cart_id si anon | — |
| 4. View cart | `/store/[slug]/cart` (existante) | `GET /api/store/cart/[id]` | — | — |
| 5. Checkout step 1 (identité) | `/store/[slug]/checkout` + `<CheckoutStepperEmail>` (à créer) | `POST /api/store/checkout/identify` | Lookup user existant ou guest | — |
| 6. Checkout step 2 (adresses) | `<AddressForm>` + select dans `store_buyer_addresses` si loggué | `GET/POST /api/store/buyer/addresses` | Validation postale (api.zippopotam.us free) | — |
| 7. Checkout step 3 (shipping) | `<ShippingMethodPicker>` (à créer) | `POST /api/store/shipping/quote` (lookup `store_shipping_rates` × zone) | — | — |
| 8. Checkout step 4 (paiement) | `<StripePaymentElement>` Apple Pay / Google Pay / Card | `POST /api/store/checkout/create-payment-intent` (avec `automatic_tax:true` Stripe Tax + `automatic_payment_methods:true`) | Stripe Radar fraud check | — |
| 9. Confirmation | `/store/[slug]/order/[id]/thank-you` (à créer) | Webhook `payment_intent.succeeded` → insert `store_orders` + `store_order_items` (trigger décrément stock) + génération invoice PDF | — | `order_confirmation` |
| 10. Suivi expé | `/store/[slug]/account/orders/[id]` (à créer) | `GET /api/store/orders/[id]` (RLS buyer) | — | `order_shipped` (webhook Shippo) |
| 11. Livré | idem | Webhook Shippo status=DELIVERED | Marque `fulfilled_at` | `order_delivered` |
| 12. Review | `/store/[slug]/products/[id]/review?token=…` | `POST /api/store/reviews` (validate token) | Insert `store_product_reviews` status=pending | — |

**États d'erreur** :
- Panier vide → redirect `/store/[slug]`
- Stock épuisé pendant checkout → `409 Conflict` + suggestion variante
- Paiement KO Stripe → step paiement reste actif + message
- Refund → webhook `charge.refunded` → update `store_orders.status='refunded'` + email

---

## 5. Espace client acheteur (final)

Routes sous `/store/[slug]/account/*` — auth Supabase scoped store via cookie.

| Route | Composant | Description | Prio |
|---|---|---|---|
| `/account` | `<BuyerDashboard>` | Stats : total dépensé, nb commandes, dernière | P0 |
| `/account/orders` | `<OrderList>` | Toutes commandes paginées, filtres statut | P0 |
| `/account/orders/[id]` | `<OrderDetail>` | Lignes, total, suivi, télécharger facture, demander remboursement | P0 |
| `/account/addresses` | `<AddressBook>` | CRUD `store_buyer_addresses`, défaut shipping/billing | P0 |
| `/account/profile` | `<ProfileForm>` | Nom, email, mdp, langue, devise préf | P0 |
| `/account/security` | `<SecurityPanel>` | 2FA toggle (réutilise `auth-v2`), sessions actives, devices | P1 |
| `/account/wishlist` | `<Wishlist>` | Produits sauvegardés | P2 |
| `/account/reviews` | `<MyReviews>` | Reviews postées + à poster (orders fulfilled sans review) | P1 |
| `/account/notifications` | `<NotificationPrefs>` | Email opt-in/out par catégorie (RGPD) | P0 |
| `/account/data-export` | bouton "Télécharger mes données" | Export JSON RGPD article 20 (1 click) | P0 |
| `/account/delete` | `<DeleteAccountFlow>` | Soft-delete RGPD + 30j anonymisation | P0 |

---

## 6. Intégrations tierces — coût estimé

| Service | Usage | Coût base | Variable | Alternative free |
|---|---|---|---|---|
| Stripe | Paiements + Connect + Radar | 1.5%+0.25€ EU / 2.9%+0.30€ US | — | Aucune (oblig.) |
| Stripe Tax | TVA UE OSS + US sales tax + UK VAT auto | 0.5% per transaction (max $0.40) | par transaction | Manuel via `vat_rate_pct` (P2 fallback) |
| Resend | Transactionnels + recovery | $0 jusqu'à 3k emails/mo, $20/mo 50k | — | Brevo $9/mo 5k emails |
| Shippo | Multi-carrier labels + tracking | Pay-as-you-go $0.05/label | — | EasyPost $0.08/label, 3k/mo gratuit |
| Supabase | DB + Auth + Realtime + Storage | $25/mo Pro (déjà payé) | $0.125/Gb storage | — |
| Vercel | Hosting | $20/mo Pro (déjà payé) | bandwidth | — |
| OpenAI ada-002 (P2) | Embeddings produits reco AI | $0.0001/1k tokens | usage | gtea, voyage-2-lite gratuit limité |
| api.zippopotam.us | Validation code postal | Gratuit | — | — |
| OFAC consolidated list | Sanctions screening | Gratuit (JSON dl daily) | — | — |
| ECB FX rates | Taux change daily | Gratuit | — | — |

**Coût marginal mensuel estimé** (1k commandes/mo, panier moyen 80€) : Stripe ~1100€ + Stripe Tax ~400€ + Resend $20 + Shippo ~50€ = **~1600€/mo**, à refacturer au client (Shopify model).

---

## 7. Checklist DPA / RGPD

- [ ] **DPA Stripe** signé (Article 28 GDPR — sub-processor)
- [ ] **DPA Resend** signé
- [ ] **DPA Supabase** signé (déjà actif via Pro plan)
- [ ] **DPA Shippo** signé
- [ ] **Cookie banner** GDPR-compliant (refus = aussi facile que accept) — composant `<CookieBanner>` + log `store_cookie_consents`
- [ ] **Privacy Policy** par store : auto-générée, déclare sub-processors, droits art. 15-22
- [ ] **Politique cookies** distincte de la Privacy Policy
- [ ] **Mentions légales** : raison sociale boutique (du client), SIRET, TVA, hébergeur (FTG/Vercel)
- [ ] **CGV boutique** : déjà géré V1 via `store_legal_docs` (template ou custom)
- [ ] **Right to access** (art. 15) : route `/account/data-export` (P0)
- [ ] **Right to erasure** (art. 17) : route `/account/delete` + soft-delete 30j puis purge cron (P0)
- [ ] **Right to portability** (art. 20) : export JSON structuré
- [ ] **Consent log** (art. 7) : table `store_cookie_consents` immuable
- [ ] **Breach notification** : process 72h CNIL (procédure interne FTG)
- [ ] **Register of processing activities** (art. 30) : doc interne FTG
- [ ] **DPO** : nommer un délégué (peut être externe €200/mo)
- [ ] **Data retention policy** : commandes 10 ans (oblig. fiscale FR), logs 1 an, carts 30j

---

## 8. Backlog priorisé global

### P0 (bloquant launch — ~3 semaines dev)
1. Tables `store_product_options/variants` + UI variant selector
2. Tables `store_carts` + cron recovery emails Resend
3. Tables `store_shipping_zones/rates` + checkout shipping picker
4. Tables `store_buyer_addresses` + UI address book checkout
5. Stripe Tax activation (`automatic_tax:true`)
6. Stripe Radar rules (fraud)
7. JSON-LD Product/Offer/Review sur fiche produit (SEO)
8. Cookie consent banner + table `store_cookie_consents`
9. Espace client : dashboard, orders list/detail, addresses, profile, data-export, delete
10. Sanctions screening (marketplace B2B) + table `sanctions_screening`
11. Trust badges supplier (KYB minimum)
12. Filtres marketplace + RFQ broadcast (`marketplace_rfq` + responses)

### P1 (mois 1 — ~2-3 semaines)
13. Reviews produits + flow request review
14. Shippo wrapper + tracking auto + emails shipped/delivered
15. Multi-currency + table `fx_rates`
16. Cross-sell "Frequently bought together"
17. Webhooks store (réutiliser `api_webhooks`)
18. Login social Google/Apple acheteurs
19. Marketplace messages in-app (Realtime)
20. NET 30/60 B2B + analytics seller

### P2 (post-launch)
21. Wishlists, gift cards, subscriptions
22. AI recommendations (embeddings pgvector)
23. Multi-store inventory / warehouses
24. POS integration
25. A/B testing
26. SMS marketing (Twilio)
27. LC/BG trade finance

---

## 9. Références SOTA citées
- **Shopify** : [Shopify Help Center — Abandoned Checkouts](https://help.shopify.com/en/manual/marketing/automations/abandoned-checkout) · [Agentic Commerce 2026](https://www.shopify.com/blog/agentic-commerce)
- **Faire** : [Catalist comparison 2026](https://catalistgroup.co/blog/b2b-wholesale-marketplace-comparison-2026/) — Net 60 + RFQ natif + free returns
- **Alibaba** : [Trade Assurance complete guide 2026](https://seller.alibaba.com/blogs/2026/southeast-asia/b2b-trade/trade-assurance-complete-guide-alibaba-secure-payment) — escrow + RFQ broadcast 6h
- **Stripe Tax** : [Numeral comparison Avalara vs Stripe Tax 2026](https://www.numeral.com/blog/avalara-vs-stripe-tax) — 100+ pays, OSS UE auto
- **Shippo** : [Pricing 2026](https://goshippo.com/pricing) — $0.05/label, 50+ carriers (Colissimo/Mondial Relay inclus)
- **Resend** : free tier 3k emails/mo (vs Klaviyo $45/mo 1.5k contacts)

---

## 10. Conclusion

Le V1 (12 tables) couvre **35 % du périmètre Shopify-light**. Pour atteindre la parité MVP commercialement crédible, il faut **12 tables P0 supplémentaires** + activation Stripe Tax/Radar + 11 routes espace client + cookie banner GDPR. Côté marketplace B2B, le pivot RFQ broadcast + trust badges + sanctions screening conditionne la crédibilité face à Faire/Alibaba.

Stack actuelle (Next.js 16 + Supabase + Stripe + Resend) suffit pour 100 % du P0/P1 sans dépendance lourde. Seul Shippo s'ajoute en P1 ($50/mo budget). Coût d'opération à 1k cmd/mo = ~1600€ refacturable client.
