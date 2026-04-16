import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ iso: string }> }

type Section = {
  id: string
  icon: string
  label: string
  href: (iso: string) => string
  weight: number
  requiredTier: 'explorer' | 'data' | 'strategy' | 'premium'
  description: string
}

const SECTIONS: Section[] = [
  { id: 'country',       icon: '🌍', label: 'Fiche pays',            href: iso => `/country/${iso}`,               weight: 5,  requiredTier: 'explorer', description: 'Vue marché de base' },
  { id: 'report',        icon: '📊', label: 'Rapport d\'opportunités', href: iso => `/reports/${iso}`,              weight: 10, requiredTier: 'data',     description: 'Gaps import/export chiffrés' },
  { id: 'studies',       icon: '📑', label: 'Études approfondies',   href: iso => `/country/${iso}?tab=studies`,   weight: 5,  requiredTier: 'strategy', description: 'Factbook, énergie, coûts prod' },
  { id: 'business_plan', icon: '💼', label: 'Business plan',         href: iso => `/country/${iso}/enriched-plan`, weight: 20, requiredTier: 'strategy', description: '3 scénarios chiffrés' },
  { id: 'clients',       icon: '🎯', label: 'Clients potentiels',    href: iso => `/country/${iso}/clients`,       weight: 20, requiredTier: 'strategy', description: 'Acheteurs B2B matchés' },
  { id: 'videos',        icon: '🎬', label: 'Vidéos de ce marché',   href: iso => `/country/${iso}/videos`,        weight: 5,  requiredTier: 'data',     description: 'Formation + insights terrain' },
  { id: 'store',         icon: '🏪', label: 'Site e-commerce',       href: iso => `/country/${iso}/store`,         weight: 35, requiredTier: 'premium',  description: 'Mini-site marchand en 5 min' },
]

const TIER_RANK: Record<string, number> = { explorer: 0, data: 1, basic: 1, standard: 1, strategy: 2, premium: 3 }

function tierLabel(t: string): string {
  const map: Record<string, string> = { explorer: 'Explorer', data: 'Data', strategy: 'Strategy', premium: 'Premium' }
  return map[t] ?? t
}

async function loadUser() {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )
    const cookieStore = await cookies()
    const token = cookieStore.get('sb-access-token')?.value
    if (!token) return { tier: 'explorer', userId: null as string | null }
    const { data } = await sb.auth.getUser(token)
    if (!data.user) return { tier: 'explorer', userId: null }
    const { data: profile } = await sb.from('profiles').select('tier').eq('id', data.user.id).single()
    return { tier: (profile?.tier ?? 'explorer') as string, userId: data.user.id }
  } catch {
    return { tier: 'explorer', userId: null }
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
  const userRank = TIER_RANK[tier] ?? 0

  const evaluated = SECTIONS.map(s => {
    const accessibleByTier = userRank >= TIER_RANK[s.requiredTier]
    const consulted = accessibleByTier && visits.has(s.id)
    return { ...s, accessibleByTier, consulted }
  })

  const consumedWeight = evaluated.filter(s => s.consulted).reduce((a, s) => a + s.weight, 0)
  const accessibleWeight = evaluated.filter(s => s.accessibleByTier).reduce((a, s) => a + s.weight, 0)
  const leftOnTable = 100 - consumedWeight

  const archetype =
    consumedWeight >= 100 ? { icon: '👑', title: 'Le Business Man', tagline: 'Tu es opérationnel — à toi de jouer.' }
    : consumedWeight >= 70 ? { icon: '⚔️', title: 'Le Pionnier',     tagline: 'Tu as tracé ta voie — le plan est prêt.' }
    : consumedWeight >= 40 ? { icon: '🔭', title: 'L\'Éclaireur',    tagline: 'Tu as analysé le terrain.' }
    : consumedWeight >= 10 ? { icon: '🧭', title: 'L\'Aventurier',   tagline: 'Tu as effleuré l\'opportunité.' }
    : { icon: '🌱', title: 'Nouveau venu', tagline: 'Commence ton parcours sur cette opportunité.' }

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link href={`/country/${iso}`} className="text-[#C9A84C] text-sm hover:underline mb-4 inline-block">← Fiche pays</Link>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🎖️</span>
          <h1 className="text-3xl md:text-4xl font-bold">Synthèse — {iso.toUpperCase()}</h1>
        </div>
        <p className="text-gray-400 text-sm mb-8">Votre parcours sur cette opportunité. Plan actuel : <strong>{tierLabel(tier)}</strong>.</p>

        <div className="rounded-2xl border border-[#C9A84C]/30 bg-[#C9A84C]/5 p-6 mb-10">
          <p className="text-xs uppercase tracking-wider text-[#C9A84C] mb-2">Votre archétype sur cette opportunité</p>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-5xl">{archetype.icon}</span>
            <div>
              <p className="text-3xl font-bold leading-tight">{archetype.title}</p>
              <p className="text-sm text-gray-300">{archetype.tagline}</p>
            </div>
          </div>
          <p className="text-4xl font-bold mb-1">{consumedWeight}%</p>
          <p className="text-xs text-gray-400 mb-4">valeur FTG consommée sur cette opportunité</p>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#C9A84C] to-[#E8C56E] transition-all" style={{ width: `${consumedWeight}%` }} />
          </div>
          {leftOnTable > 0 && (
            <p className="text-xs text-gray-400 mt-4">
              Il vous reste <strong className="text-[#C9A84C]">{leftOnTable}%</strong> de ressources à débloquer sur cette opportunité.
              {userRank < 3 && (
                <> <Link href="/pricing" className="text-[#C9A84C] underline">Upgradez pour atteindre 100%</Link>.</>
              )}
            </p>
          )}
        </div>

        <h2 className="text-xl font-semibold mb-4">Les {SECTIONS.length} ressources</h2>
        <div className="space-y-3">
          {evaluated.map(s => {
            const status = s.consulted ? 'consulted' : s.accessibleByTier ? 'available' : 'locked'
            const badge =
              status === 'consulted' ? { bg: 'bg-[#10B981]/15', fg: 'text-[#10B981]', label: '✓ consulté' }
              : status === 'available' ? { bg: 'bg-[#C9A84C]/15', fg: 'text-[#C9A84C]', label: 'disponible — à explorer' }
              : { bg: 'bg-white/5', fg: 'text-gray-500', label: `🔒 ${tierLabel(s.requiredTier)}+ requis` }
            return (
              <div key={s.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <span className="text-3xl">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <p className="font-semibold">{s.label}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${badge.bg} ${badge.fg}`}>{badge.label}</span>
                    <span className="text-xs text-gray-500">poids {s.weight}%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{s.description}</p>
                </div>
                {status === 'consulted' && (
                  <Link href={s.href(iso)} className="text-xs text-[#C9A84C] hover:underline whitespace-nowrap">Revoir →</Link>
                )}
                {status === 'available' && (
                  <Link href={s.href(iso)} className="text-xs px-3 py-1.5 rounded-full bg-[#C9A84C] text-black font-semibold whitespace-nowrap">Ouvrir</Link>
                )}
                {status === 'locked' && (
                  <Link href="/pricing" className="text-xs px-3 py-1.5 rounded-full border border-white/15 text-gray-300 hover:border-[#C9A84C]/50 whitespace-nowrap">Upgrade</Link>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-10 p-5 rounded-2xl border border-white/10 bg-white/5">
          <p className="text-sm font-semibold mb-1">Méthode de calcul</p>
          <p className="text-xs text-gray-400">
            Chaque ressource a un poids reflétant sa valeur commerciale :
            Fiche pays 5%, Rapport 10%, Études 5%, Business plan 20%, Clients potentiels 20%, Vidéos 5%, Site e-commerce 35%.
            Total 100%. Votre score = somme des poids des ressources effectivement consultées pour ce pays.
          </p>
        </div>
      </div>
    </div>
  )
}
