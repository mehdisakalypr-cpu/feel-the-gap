# FTG — Tier gating matrix (source de vérité)

Document de référence à mettre à jour à chaque ajout/modification de gate tier sur le site.
Dernière revue : 2026-04-20.

## Règle d'or

Un utilisateur qui a payé **pour un tier donné** ne doit JAMAIS voir un gate lui demandant
de "passer au tier qu'il a déjà". Le gate tier s'affiche **uniquement** aux users **strictement
en dessous** du tier requis.

## Matrice feature × tier (canonique — `lib/credits/tiers.ts`)

| Feature | free | solo_producer | starter | strategy | premium | ultimate | custom |
|---------|------|---------------|---------|----------|---------|----------|--------|
| map_view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| country_list | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| demo_bp | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| opportunity_detail | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| bp_generate | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| training_youtube | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ecommerce_site_propose | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| client_list | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| client_contact_reveal | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| site_creation | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| fill_the_gap_bulk_bp (quota) | 0 | 0 | 0 | 0 | 150/mo | 250/mo | 0 |
| buyer_reveal (quota) | 0 | 0 | 0 | 10 | 50 | ∞ | ∞ |

## Pages gatées et tier minimum requis

| Page | Feature bloquée | Tier min | CTA si bloqué |
|------|-----------------|----------|---------------|
| `/reports/[iso]` — bouton bulk BP | `fill_the_gap_bulk_bp` | premium | 🔒 Passer Premium pour générer les N BP |
| `/reports/[iso]/business-plan` — clients B2B | `client_list` + full BP | premium | Passer Premium |
| `/country/[iso]/plan` — buyers/distributeurs | `client_contact_reveal` | premium | Passer en Premium |
| `/country/[iso]/success/debouches/buyers-list` | `client_contact_reveal` | strategy | tier_locked modal (strategy) |
| `/country/[iso]/enriched-plan` | BP enrichi 3 scénarios | strategy | (inféré) |
| `/country/[iso]/methods` | comparateur méthodes (1 gratuite, reste gatée) | premium | 🔒 N méthode(s) verrouillée(s) |
| `/country/[iso]/clients` | `client_list` | strategy | (inféré) |
| `/country/[iso]/recap` — sections | variable par section (free→premium) | par section | 🔒 {tier}+ requis |
| `/seller` (création annonce) | `site_creation` | strategy | 🔒 Plan Strategy requis |
| `/shop/create` (e-commerce) | `site_creation` | premium | 🔒 Pré-requis |
| `/formation/[slug]` | déblocage parcours tutoriel | free | 🔒 Complète le tutoriel |

## Pattern technique obligatoire

### ❌ À ne PLUS faire (détectée cassée le 2026-04-20)
```tsx
import { supabase } from '@/lib/supabase'        // ← client vanilla, lit localStorage
// ...
supabase.auth.getUser().then(({ data: { user } }) => {
  supabase.from('profiles').select('tier').eq('id', user.id).single()
  // ...
})
```
Ne voit PAS la session auth-v2 (stockée dans les cookies via `@supabase/ssr`).
→ `user` est `null` → `userTier` reste 'free' → gates cassés pour les users payants.

### ✅ À faire
```tsx
import { useMemo } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { hasTier } from '@/lib/credits/costs'

export default function MyPage() {
  const supabase = useMemo(() => createSupabaseBrowser(), [])
  const [userTier, setUserTier] = useState('free')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('tier').eq('id', user.id).single()
        .then(({ data }) => { if (data?.tier) setUserTier(data.tier) })
    })
  }, [supabase])

  const canUseFeature = hasTier(userTier, 'premium')  // OU canAccess(userTier, 'feature_name')
  // ...
}
```

### ✅ Pour comparer tiers
Utilise **toujours** `hasTier(userTier, 'premium')` (dans `lib/credits/costs.ts`).
Il gère : ordre canonique + tiers legacy (enterprise→ultimate, standard→strategy, basic→starter, explorer→free).
**Ne plus écrire** `userTier === 'premium'` ou `['premium', 'enterprise'].includes(userTier)` — faux négatifs garantis.

### ✅ Pour gater une feature nommée
Utilise `canAccess(userTier, 'feature_name')` (dans `lib/credits/tiers.ts`) qui lit la matrice ci-dessus.
Ajoute la feature à `FEATURE_ACCESS` dans `lib/credits/tiers.ts` avant d'ajouter un gate basé dessus.

## État de la migration (2026-04-20)

**Migrées vers `createSupabaseBrowser` + `hasTier` :**
- `/reports/[iso]` (commit b905c85)
- `/reports/[iso]/business-plan` (517cf87)
- `/country/[iso]/enriched-plan` (517cf87)
- `/country/[iso]/methods` (517cf87)

**Déjà propres** (utilisaient déjà le bon pattern) :
- `/country/[iso]/plan`
- `/country/[iso]/layout`
- `/country/[iso]/recap`
- `/account`
- `/pricing`
- `/marketplace/*` (la plupart)
- `/components/PaywallGate`, `/components/CreditCounter`, `/components/Topbar`

**À auditer dans une prochaine vague** (restent 30+ fichiers avec `supabase.auth.getUser()`
via client vanilla — principalement des **routes API** qui sont server-side et fonctionnent
correctement via le pattern `supabase-server` ; mais quelques pages clients restent. Voir
`grep -rln "from '@/lib/supabase'.*supabase\\.auth" app/`).

## Add new gate — checklist

- [ ] La feature est dans `FEATURE_ACCESS` (`lib/credits/tiers.ts`) ? Si non, l'ajouter.
- [ ] La page utilise `createSupabaseBrowser()` + `useMemo` (pas `supabase` vanilla) ?
- [ ] Le gate utilise `canAccess(tier, feature)` ou `hasTier(tier, minTier)` (pas `===`) ?
- [ ] Le message affiche le tier requis de façon cohérente avec la matrice ?
- [ ] Testé manuellement pour chaque tier : free / solo_producer / starter / strategy / premium / ultimate ?
