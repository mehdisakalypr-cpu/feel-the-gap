# FTG — Runbook incidents prod

Quand quelque chose tombe en prod, suivre les procédures ci-dessous **dans l'ordre** sans improviser.

## 🚨 Contacts d'urgence

- **Prod URL** : https://www.gapup.io
- **Admin dashboard** : https://www.gapup.io/admin
- **Supabase** : https://supabase.com/dashboard/project/jebuagyeapkltyjitosm
- **Vercel** : https://vercel.com/mehdisakalypr-3843s-projects/feel-the-gap
- **Cloudflare** : https://dash.cloudflare.com/?zone=gapup.io

## 1. Site inaccessible (5xx global)

**Détection** : uptime monitor alert · `curl -I https://www.gapup.io/` renvoie 5xx ou timeout.

1. Check Vercel status : https://www.vercel-status.com/
2. Check origin direct (bypass CF) : `curl -I -H "Host: www.gapup.io" https://feel-the-gap.vercel.app/`
   - Si origin OK mais CF KO → bascule CF proxy en `DNS only` (grey cloud) temporairement
3. Check health endpoint : `curl https://www.gapup.io/api/health`
4. Check logs Vercel : `vercel logs feel-the-gap --since 10m` dans `/var/www/feel-the-gap`
5. Si bug déploiement récent → rollback : dashboard Vercel → Deployments → previous → "Promote to Production"

## 2. DB down / Supabase saturée

**Détection** : `/api/health` renvoie 503 avec `checks.db.ok=false`.

1. Check Supabase dashboard : Database → Status
2. Check connection pool : https://supabase.com/dashboard/project/jebuagyeapkltyjitosm/database/pooler
   - Si saturation pool : réduire temporairement le MAX_CONNECTIONS des workers PM2
3. Check slow queries : `pg_stat_statements` via Supabase SQL editor
4. Si DB down sans cause claire → incident Supabase : https://status.supabase.com/
5. Activer maintenance mode : set env Vercel `MAINTENANCE_MODE=true` → redeploy 1-clic

## 3. Stripe webhook failures / paiements non confirmés

**Détection** : users signalent paiement validé mais pas d'accès · dashboard Stripe webhook errors > 5%.

1. Stripe Dashboard → Developers → Webhooks → endpoint prod → voir last failures
2. Re-dispatch webhooks échoués (dashboard Stripe → 1 clic)
3. Si signature invalide → vérifier `STRIPE_WEBHOOK_SECRET` dans Vercel env matche celui du dashboard Stripe
4. Si endpoint retourne 5xx → suivre section 1

## 4. LLM quota exhausted

**Détection** : content agents stop producing, logs `quota_exceeded`.

1. Check `/admin/agent-quota` (si existe) ou `agent_quota_usage` via Supabase
2. Free tier reset auto à minuit UTC — patienter si on est proche
3. Si urgent : rotation keys → `GROQ_API_KEY_2/3/4/5` prennent le relais automatiquement via cascade
4. Dernier recours : `OPENAI_API_KEY` fallback paid (cap journalier à vérifier : $50 max)

## 5. DDoS / trafic anormal

**Détection** : Vercel usage alert 80% · CF analytics montre spike × 10 en < 5 min.

1. Cloudflare Dashboard → Security → Events → identifier l'IP/UA pattern
2. Activer **"Under Attack Mode"** : CF → Security → Settings → Security Level = "Under Attack"
3. Firewall rule custom : block countries/UAs/ASNs attaquants
4. Si pattern login brute-force → block /api/auth/login côté CF rate limit (5/min/IP)
5. Si pattern scraping lourd → block via robots.txt + CF bot score < 30

## 6. Payment dispute wave

**Détection** : `/admin/fraud-events` affiche > 5 disputes/24h · Stripe Radar alert.

1. Dashboard Stripe → Payments → disputed → identifier le pattern (produit, IP range, timing)
2. Si fraude confirmée :
   - Bloquer le pattern dans Stripe Radar rules
   - Envoyer evidence Stripe (auto via cron `/api/cron/disputes-evidence` tourné à 06h UTC)
   - Refund préventif sur les paiements identiques non disputés encore
3. Si pattern bot : renforcer 3DS dynamic dans Radar

## 7. Rotation credentials d'urgence (hack Vercel 2026-04-20 pattern)

**Détection** : clé API fuit (commit accidentel, email d'alerte provider, compte compromis).

1. **Supabase** : dashboard → Settings → API → Regenerate
2. **Stripe** : dashboard → Developers → API keys → Roll
3. **Resend** : dashboard → API Keys → Revoke + new
4. **OpenAI/Groq/Gemini** : dashboards respectifs → new key + revoke old
5. **Vercel deploy hooks** : Settings → Git → regenerate
6. **CRON_SECRET** + **JWT_SECRET** : nouvelle valeur hex 32 bytes
7. Push nouvelle valeur dans Vercel env (prod+preview+dev) via API
8. Force redeploy all projects
9. Check historique clé ancienne pour activité suspecte

## Post-incident

Après résolution :
1. Noter l'incident dans `docs/INCIDENTS.md` avec timeline + root cause + prevention
2. Update ce RUNBOOK si procédure améliorée
3. Check si alerte aurait pu détecter plus tôt → ajouter monitoring
