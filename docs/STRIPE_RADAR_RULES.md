# Stripe Radar — règles à configurer pour FTG Store

Les règles ci-dessous sont à créer dans **Stripe Dashboard → Radar → Rules**.
Le code (`app/api/store/[slug]/checkout/intent/route.ts`) fournit déjà au Radar :
- `shipping` (nom + adresse complète)
- `radar_options.session` (si frontend passe `radar_session`, sinon Elements capture auto)
- Metadata IP client + User-Agent + pays shipping/billing + segment B2B/B2C
- Webhook listener `review.opened` / `review.closed` / `radar.early_fraud_warning.created` / `charge.dispute.*`
  → table `store_fraud_events` + colonne `store_orders.fraud_status`

## 1. Règles BLOCK

```text
Block if :risk_score: > 75
Block if :card_funding: = 'prepaid' and :amount_in_usd: > 500
Block if :billing_country: in (KP, IR, SY, CU, RU) and not :merchant_country: = 'US'
Block if :ip_country: != :card_country: and :amount_in_usd: > 2000
Block if :seconds_since_account_created: < 60 and :amount_in_usd: > 200
Block if count: .ip_address: in last 1 hour: > 10
```

## 2. Règles REVIEW

```text
Review if :risk_score: > 50 and :risk_score: <= 75
Review if :amount_in_usd: > 5000
Review if :billing_country: != :ip_country:
Review if :email_domain: in ('mailinator.com','tempmail.com','guerrillamail.com','10minutemail.com','yopmail.com')
Review if :card_bin_country: != :shipping_country: and :amount_in_usd: > 1000
Review if :is_shipping_address_missing_postal_code:
```

## 3. Règles ALLOW

```text
Allow if :email: = 'mehdi.sakalypr@gmail.com' (test account)
Allow if :risk_score: <= 10 and :previous_successful_charges: >= 3
Allow if :customer_id: in group 'ftg_vip_trusted'
```

## 4. 3D Secure dynamic

```text
Request 3DS if :risk_score: > 25 and :amount_in_usd: > 100
Request 3DS if :billing_country: in (FR, DE, ES, IT, NL, BE, AT, PT, IE, GR, FI)
```

## 5. Lists à entretenir

- `trusted_emails` — clients récurrents sans fraude sur 12+ mois
- `suspicious_bins` — BINs repérés via EFW
- `known_fraudsters_ip` — IPs déjà en dispute (auto-feed via cron `/api/cron/fraud-refresh`)

## 6. Monitoring post-launch

- `/admin/fraud-events` (à créer) : graphe 7j disputes/reviews/EFW
- Alert Slack #ops-stripe si `fraud_events` > 5/jour
- Weekly review : ajuster seuils `risk_score` selon faux positifs

## Notes d'implémentation

1. Radar Team est **payant** (€0.05/tx sur Stripe standard, €0.10 sur Stripe Connect) mais indispensable
   pour custom rules + EFW. Activer dans Dashboard → Settings → Radar.
2. Pour Stripe Connect (marketplace B2B FTG), les règles peuvent être appliquées par plateforme
   avec `application_fee_amount` et `on_behalf_of`. Les webhooks arrivent sur le compte plateforme.
3. Les disputes `chargeback` réelles (vs inquiry) ouvrent automatiquement une enveloppe de preuve dans
   le Dashboard. Le cron `/api/cron/disputes-evidence` (à créer en phase 2) peut pré-remplir via Stripe
   API avec order + shipping + tracking + CGV acceptance.
