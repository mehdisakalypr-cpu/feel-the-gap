# Social APIs Setup Guide — Feel The Gap

Ce document liste pas-à-pas ce que tu dois faire pour obtenir les credentials et permissions nécessaires à nos parcours S-1 (scheduler multi-plateforme) et S-2 (chatbot followers).

**Principe général** : plus tu lances les procédures tôt, mieux c'est — certaines approbations prennent 2-4 semaines. Tu peux développer et tester en mode dev avant l'approbation.

---

## 1. Meta (Instagram + Facebook) 🔴 PRIORITÉ 1

Nécessaire pour : **publier sur Instagram/Facebook + chatbot DM Insta/Messenger**.

### Étape 1 — Business Manager
1. Va sur https://business.facebook.com
2. Crée un compte Business (ou utilise celui existant)
3. Ajoute ta **Facebook Page** (obligatoire pour l'API Instagram)
4. **Convertis ton compte Instagram en Business Account** et connecte-le à la FB Page via la Business Suite

### Étape 2 — Developer App
1. Va sur https://developers.facebook.com/apps
2. Clique **Create App** → type **Business**
3. Nom : `Feel The Gap Social`
4. Email de contact : ton email admin

### Étape 3 — Activer les produits dans l'app
Dans l'onglet **Add Products**, ajoute :
- **Facebook Login** (OAuth)
- **Instagram Graph API**
- **Messenger Platform**
- **Instagram Messaging**

### Étape 4 — URL Callback OAuth
Dans **Facebook Login → Settings** :
- Valid OAuth Redirect URIs : `https://feel-the-gap.duckdns.org/api/auth/meta/callback`

### Étape 5 — Privacy Policy + Terms (OBLIGATOIRE)
Avant App Review, Meta exige deux URLs publiques sur ton domaine :
- `https://feel-the-gap.duckdns.org/legal/privacy` (à créer)
- `https://feel-the-gap.duckdns.org/legal/terms` (à créer)

### Étape 6 — Permissions à demander (App Review)
Dans **App Review → Permissions and Features**, demande :

**Pour publier (S-1)** :
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`
- `pages_manage_metadata`
- `instagram_basic`
- `instagram_content_publish`

**Pour le chatbot (S-2)** :
- `pages_messaging`
- `instagram_manage_messages`

Pour chaque permission, tu dois fournir :
- Un **screencast** qui montre ton app en action avec cette permission
- Une description du use case
- L'URL de ta privacy policy

### Étape 7 — Credentials à me transmettre
Une fois l'app créée (même avant review), envoie-moi :
- `META_APP_ID` (visible dans l'onglet Settings → Basic)
- `META_APP_SECRET` (même endroit)
- `META_VERIFY_TOKEN` (tu en choisis un, ex: `ftg_meta_webhook_2026_random`)

J'ajouterai ces variables au `.env.local` + Vercel.

### Mode dev avant approbation
Tant que l'app n'est pas approuvée :
- Tu peux publier uniquement sur **tes propres pages/comptes** (ceux qui sont admins de l'app)
- Tu peux tester le chatbot avec des comptes "Test Users" créés dans l'onglet Roles → Test Users
- **Parfait pour les démos** — tu montres l'intégration sans avoir besoin de l'approbation

**Délai approbation** : 1-2 semaines en moyenne, parfois 1-2 mois si rejet initial.

---

## 2. YouTube 🟢 PRIORITÉ 2 — le plus rapide

Nécessaire pour : **publier sur YouTube classique + YouTube Shorts**.

### Étape 1 — Google Cloud Project
1. Va sur https://console.cloud.google.com
2. Crée un projet `Feel The Gap`
3. Active l'API : **APIs & Services → Library → YouTube Data API v3 → Enable**

### Étape 2 — OAuth Consent Screen
1. **APIs & Services → OAuth consent screen**
2. Type : **External**
3. Nom : `Feel The Gap`
4. Support email : ton email
5. **Scopes** (ajoute) :
   - `.../auth/youtube.upload`
   - `.../auth/youtube`
   - `.../auth/youtube.readonly`
6. Test users : ajoute ton email + celui du compte démo

### Étape 3 — Credentials OAuth
1. **Credentials → Create Credentials → OAuth client ID**
2. Type : **Web application**
3. Authorized redirect URIs : `https://feel-the-gap.duckdns.org/api/auth/youtube/callback`

### Étape 4 — Verification (si scope sensible)
Le scope `youtube.upload` est "sensitive" → Google demande une verification :
- Ton domaine doit être prouvé (via Google Search Console)
- Fournir un screencast de l'app
- Délai : 2-6 semaines

**En mode dev (Testing mode)** : tu peux tester avec tes 100 premiers test users sans verification. Parfait pour dev + démo.

### Credentials à me transmettre
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`

---

## 3. TikTok 🟡 PRIORITÉ 3 — démarre tôt, approbation lente

Nécessaire pour : **publier sur TikTok**.

### Étape 1 — Developer Account
1. https://developers.tiktok.com
2. Register → fournis infos business + URL du site

### Étape 2 — Create App
1. Nom : `Feel The Gap Social`
2. Platforms : **Web**
3. Callback URL : `https://feel-the-gap.duckdns.org/api/auth/tiktok/callback`
4. Terms of Service URL : `https://feel-the-gap.duckdns.org/legal/terms`
5. Privacy Policy URL : `https://feel-the-gap.duckdns.org/legal/privacy`

### Étape 3 — Activer les produits
- **Content Posting API** (ex-Direct Post API)
- **Login Kit**

### Étape 4 — Scopes à demander
- `user.info.basic`
- `video.upload`
- `video.publish`

### Étape 5 — Soumettre pour review
- TikTok est **strict** : ils demandent un vrai screencast + description détaillée du use case
- Pas de watermark FTG exigé dans le post lui-même, mais les conditions évoluent

**Délai approbation** : 2-4 semaines, parfois refus à retravailler.

### Credentials à me transmettre
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`

---

## 4. LinkedIn 🟠 PRIORITÉ 4

Nécessaire pour : **publier sur LinkedIn (profil + pages entreprise)**.

### Étape 1 — LinkedIn Developer
1. https://www.linkedin.com/developers/apps
2. Create app → associe à une **LinkedIn Page** (tu dois en créer une si tu n'en as pas)
3. Nom : `Feel The Gap`

### Étape 2 — Products
Request access to :
- **Share on LinkedIn**
- **Sign In with LinkedIn using OpenID Connect**
- **Marketing Developer Platform** (pour publier au nom d'une Company Page)

### Étape 3 — Auth
- Redirect URL : `https://feel-the-gap.duckdns.org/api/auth/linkedin/callback`

### Étape 4 — Scopes
- `w_member_social` (post)
- `r_liteprofile`, `r_emailaddress`
- `w_organization_social` (post sur page entreprise)

**Délai** : 1-2 semaines pour Marketing Developer Platform.

### Credentials
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`

---

## 5. Variables d'environnement à prévoir

Quand tu auras tous les credentials, ajoute-les à `.env.local` local et à **Vercel → Project → Environment Variables** :

```bash
# Meta
META_APP_ID=...
META_APP_SECRET=...
META_VERIFY_TOKEN=...
META_OAUTH_REDIRECT_URL=https://feel-the-gap.duckdns.org/api/auth/meta/callback

# YouTube
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_OAUTH_REDIRECT_URL=https://feel-the-gap.duckdns.org/api/auth/youtube/callback

# TikTok
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
TIKTOK_OAUTH_REDIRECT_URL=https://feel-the-gap.duckdns.org/api/auth/tiktok/callback

# LinkedIn (plus tard)
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_OAUTH_REDIRECT_URL=https://feel-the-gap.duckdns.org/api/auth/linkedin/callback
```

---

## 6. Ordre d'exécution recommandé

| Semaine | Action |
|---|---|
| **Semaine 1** | Créer Meta Business Manager + App dev + Privacy/Terms publiées ; créer Google Cloud projet + YT API ; créer TikTok dev account |
| **Semaine 1** | Me transmettre les credentials (même en mode dev) — je configure l'intégration |
| **Semaine 2-3** | Soumettre Meta App Review + TikTok Review + YouTube verification. Pendant ce temps, test avec comptes dev/test users |
| **Semaine 3-5** | Approbations arrivent progressivement. Bascule en mode production au fur et à mesure |

---

## 7. Ce que tu n'as PAS à faire

- ❌ **X / Twitter** : API payante $100+/mois, on laisse tomber
- ❌ **Meta Marketing API (pubs payantes)** : Phase ultérieure, plus complexe et plus strict en app review
- ❌ **Pinterest, Reddit, Mastodon, Bluesky, Threads** : possible via Mixpost Lite self-host en Phase S-3, non prioritaire

---

## 8. Checklist récapitulative

- [ ] Business Manager Meta créé
- [ ] Facebook Page créée + Instagram Business connecté
- [ ] Dev App Meta créée
- [ ] Privacy Policy publiée sur /legal/privacy
- [ ] Terms of Service publiés sur /legal/terms
- [ ] Screencasts enregistrés pour App Review
- [ ] App Review Meta soumise
- [ ] Google Cloud projet créé + YouTube Data API v3 activée
- [ ] OAuth consent screen YouTube configuré
- [ ] Credentials YouTube récupérés
- [ ] TikTok dev account créé
- [ ] App TikTok créée + review soumise
- [ ] LinkedIn app créée (plus tard)
- [ ] Tous les credentials envoyés à Claude pour config .env
