import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import RecapClient, { type RecapSection } from './RecapClient'
import { compareTiers } from '@/lib/credits/tier-helpers'
import type { PlanTier } from '@/lib/credits/costs'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ iso: string }> }

type SectionDef = {
  id: string
  icon: string
  label: string
  href: (iso: string) => string
  weight: number
  requiredTier: PlanTier
  description: string
}

const SECTIONS: SectionDef[] = [
  { id: 'country',       icon: '🌍', label: 'Fiche pays',              href: iso => `/country/${iso}`,               weight: 5,  requiredTier: 'free',     description: 'Vue marché de base' },
  { id: 'report',        icon: '📊', label: "Rapport d'opportunités",  href: iso => `/reports/${iso}`,                weight: 10, requiredTier: 'starter',  description: 'Gaps import/export chiffrés' },
  { id: 'studies',       icon: '📑', label: 'Études approfondies',     href: iso => `/country/${iso}?tab=studies`,    weight: 5,  requiredTier: 'strategy', description: 'Factbook, énergie, coûts prod' },
  { id: 'business_plan', icon: '💼', label: 'Business plan',           href: iso => `/country/${iso}/enriched-plan`,  weight: 20, requiredTier: 'strategy', description: '3 scénarios chiffrés' },
  { id: 'clients',       icon: '🎯', label: 'Clients potentiels',      href: iso => `/country/${iso}/clients`,        weight: 20, requiredTier: 'strategy', description: 'Acheteurs B2B matchés' },
  { id: 'videos',        icon: '🎬', label: 'Vidéos de ce marché',     href: iso => `/country/${iso}/videos`,         weight: 5,  requiredTier: 'starter',  description: 'Formation + insights terrain' },
  { id: 'store',         icon: '🏪', label: 'Site e-commerce',         href: iso => `/country/${iso}/store`,          weight: 35, requiredTier: 'premium',  description: 'Mini-site marchand en 5 min' },
]

// Map legacy tier strings to canonical PlanTier (cohérent avec lib/credits/costs.ts).
function toPlanTier(t: string | null | undefined): PlanTier {
  const map: Record<string, PlanTier> = {
    free: 'free',
    explorer: 'free',
    solo_producer: 'solo_producer',
    basic: 'starter',
    data: 'starter',
    starter: 'starter',
    standard: 'strategy',
    strategy: 'strategy',
    premium: 'premium',
    ultimate: 'ultimate',
    enterprise: 'custom',
    custom: 'custom',
  }
  return map[(t ?? 'free').toLowerCase()] ?? 'free'
}

const TIER_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  solo_producer: 'Solo Producer',
  starter: 'Data',
  strategy: 'Strategy',
  premium: 'Premium',
  ultimate: 'Ultimate',
  custom: 'Enterprise',
}

async function loadUser(): Promise<{ tier: PlanTier; userId: string | null }> {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )
    const cookieStore = await cookies()
    const token = cookieStore.get('sb-access-token')?.value
    if (!token) return { tier: 'free', userId: null }
    const { data } = await sb.auth.getUser(token)
    if (!data.user) return { tier: 'free', userId: null }
    const { data: profile } = await sb.from('profiles').select('tier').eq('id', data.user.id).single()
    return { tier: toPlanTier(profile?.tier as string | undefined), userId: data.user.id }
  } catch {
    return { tier: 'free', userId: null }
  }
}

async function loadVisits(userId: string | null, iso: string): Promise<Set<string>> {
  if (!userId) return new Set()
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )
    const { data } = await sb
      .from('journey_visits')
      .select('section_id')
      .eq('user_id', userId)
      .eq('country_iso', iso.toUpperCase())
    return new Set((data ?? []).map(r => r.section_id as string))
  } catch {
    return new Set()
  }
}

export default async function RecapPage({ params }: Props) {
  const { iso } = await params
  const { tier, userId } = await loadUser()
  const visits = await loadVisits(userId, iso)

  const evaluated: RecapSection[] = SECTIONS.map(s => {
    // accessibleByTier : user tier >= requiredTier (compareTiers >= 0 quand left >= right)
    const accessibleByTier = compareTiers(tier, s.requiredTier) >= 0
    const consulted = accessibleByTier && visits.has(s.id)
    return {
      id: s.id,
      icon: s.icon,
      label: s.label,
      href: s.href(iso),
      weight: s.weight,
      requiredTier: s.requiredTier,
      description: s.description,
      accessibleByTier,
      consulted,
    }
  })

  const consumedWeight = evaluated.filter(s => s.consulted).reduce((a, s) => a + s.weight, 0)
  const leftOnTable = 100 - consumedWeight

  const archetype =
    consumedWeight >= 100 ? { icon: '👑', title: 'Le Business Man',  tagline: 'Tu es opérationnel — à toi de jouer.' }
    : consumedWeight >= 70  ? { icon: '⚔️', title: 'Le Pionnier',     tagline: "Tu as tracé ta voie — le plan est prêt." }
    : consumedWeight >= 40  ? { icon: '🔭', title: "L'Éclaireur",     tagline: 'Tu as analysé le terrain.' }
    : consumedWeight >= 10  ? { icon: '🧭', title: "L'Aventurier",    tagline: "Tu as effleuré l'opportunité." }
    : { icon: '🌱', title: 'Nouveau venu', tagline: 'Commence ton parcours sur cette opportunité.' }

  return (
    <RecapClient
      iso={iso.toUpperCase()}
      tier={tier}
      tierLabel={TIER_LABELS[tier]}
      sections={evaluated}
      consumedWeight={consumedWeight}
      leftOnTable={leftOnTable}
      archetype={archetype}
    />
  )
}
