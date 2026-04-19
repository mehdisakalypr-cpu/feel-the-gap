'use client'

/**
 * JourneyStickyDock — barre d'action sticky-bottom visible sur toutes les
 * étapes du parcours (8 étapes country/[iso]/*).
 *
 * Affiche :
 *   - Étape précédente / suivante (ou "Retour à la carte" sur étape 1)
 *   - Compteur d'opportunités Fill-the-Gap (si tier premium/ultimate)
 *   - Compteur de crédits AI (si user connecté avec ai_credits > 0)
 *
 * Position : `fixed bottom-0` avec backdrop blur. Z 40 (sous Topbar z-50).
 * S'auto-détecte la step depuis le pathname.
 */

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useLang } from '@/components/LanguageProvider'
import { useJourneyContext } from '@/lib/journey/context'
import {
  sequentialSteps,
  type JourneyStep,
  type JourneyStepId,
} from '@/lib/journey/steps'

function stepFromPathname(pathname: string): JourneyStepId | null {
  const parts = pathname.split('/').filter(Boolean)
  // /country/<iso>[/section]
  if (parts[0] !== 'country' || !parts[1]) return null
  const section = parts[2]
  switch (section) {
    case undefined:        return 'country'
    case 'methods':        return 'methods'
    case 'enriched-plan':
    case 'plan':           return 'business_plan'
    case 'videos':         return 'videos'
    case 'clients':        return 'clients'
    case 'recap':          return 'recap'
    case 'store':          return 'store'
    case 'success':        return 'success' as JourneyStepId
    default:               return null
  }
}

function withParams(href: string, product: string | null, iso: string | null): string {
  const u = new URL(href, 'https://placeholder.local')
  if (product) u.searchParams.set('product', product)
  if (iso) u.searchParams.set('iso', iso)
  const qs = u.searchParams.toString()
  return qs ? `${u.pathname}?${qs}` : u.pathname
}

export default function JourneyStickyDock() {
  const pathname = usePathname() ?? ''
  const { lang } = useLang()
  const fr = lang === 'fr'
  const activeProduct = useJourneyContext((s) => s.activeProduct)

  const stepId = stepFromPathname(pathname)
  const isoMatch = pathname.match(/^\/country\/([^/]+)/)
  const iso = isoMatch?.[1]?.toUpperCase() ?? ''

  // ── User tier + counters ──────────────────────────────────────────────
  const [tier, setTier] = useState<string>('free')
  const [aiCredits, setAiCredits] = useState<number | null>(null)
  const [ftgQuota, setFtgQuota] = useState<{ balance: number; grant: number } | null>(null)
  const [isLogged, setIsLogged] = useState(false)

  useEffect(() => {
    const sb = createSupabaseBrowser()
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setIsLogged(true)
      const { data: profile } = await sb
        .from('profiles')
        .select('tier, ai_credits')
        .eq('id', data.user.id)
        .maybeSingle()
      if (profile?.tier) setTier(profile.tier)
      if (typeof profile?.ai_credits === 'number') setAiCredits(profile.ai_credits)
    })
  }, [])

  const showFtgCounter = tier === 'premium' || tier === 'ultimate'
  useEffect(() => {
    if (!showFtgCounter) { setFtgQuota(null); return }
    let cancelled = false
    fetch('/api/credits/fillthegap/balance', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j?.ok) return
        setFtgQuota({ balance: Number(j.balance ?? 0), grant: Number(j.grant ?? 0) })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [showFtgCounter])

  // ── Render guard : seulement sur les étapes du parcours country ───────
  if (!stepId || !iso) return null

  const all = sequentialSteps()
  const idx = all.findIndex((s) => s.id === stepId)
  if (idx === -1) return null

  const prev: JourneyStep | null = idx > 0 ? all[idx - 1] : null
  const next: JourneyStep | null = idx < all.length - 1 ? all[idx + 1] : null
  const isFirst = idx === 0

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 lg:left-80 bg-[#0D1117]/95 backdrop-blur border-t border-white/10 px-3 md:px-6 py-2.5"
      role="navigation"
      aria-label={fr ? 'Navigation parcours' : 'Journey navigation'}
    >
      <div className="max-w-6xl mx-auto flex items-center gap-3 flex-wrap">
        {/* PREV / Back to map */}
        {isFirst ? (
          <Link
            href="/map"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition-colors shrink-0"
          >
            <span aria-hidden>←</span>
            <span>🗺️ {fr ? 'Carte monde' : 'World map'}</span>
          </Link>
        ) : prev ? (
          <Link
            href={withParams(prev.href(iso), activeProduct, iso)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition-colors shrink-0"
          >
            <span aria-hidden>←</span>
            <span className="hidden sm:inline">{fr ? 'Étape précédente :' : 'Previous step:'}</span>
            <span aria-hidden>{prev.icon}</span>
            <span className="hidden md:inline">{fr ? prev.labelFr : prev.labelEn}</span>
          </Link>
        ) : (
          <span className="shrink-0" />
        )}

        {/* CENTER : counters */}
        <div className="flex-1 flex items-center justify-center gap-3 flex-wrap min-w-0">
          {showFtgCounter && ftgQuota && ftgQuota.grant > 0 && (
            <Link
              href="/account#subscription"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#A78BFA]/10 border border-[#A78BFA]/30 text-[#A78BFA] text-xs font-semibold whitespace-nowrap transition-colors hover:bg-[#A78BFA]/20"
              title={fr ? 'Quota mensuel Fill-the-Gap' : 'Monthly Fill-the-Gap quota'}
            >
              <span aria-hidden>🎯</span>
              <span>
                {ftgQuota.balance}<span className="opacity-60">/{ftgQuota.grant}</span>
                <span className="ml-1 hidden sm:inline opacity-80">{fr ? 'opps ce mois' : 'opps this month'}</span>
              </span>
            </Link>
          )}

          {isLogged && aiCredits !== null && (
            <Link
              href="/account#credits"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] text-xs font-semibold whitespace-nowrap transition-colors hover:bg-[#C9A84C]/20"
              title={fr ? 'Mes crédits AI' : 'My AI credits'}
            >
              <span aria-hidden>💎</span>
              <span>
                €{(aiCredits / 100).toFixed(2)}
                <span className="ml-1 hidden sm:inline opacity-80">{fr ? 'crédits' : 'credits'}</span>
              </span>
            </Link>
          )}
        </div>

        {/* NEXT */}
        {next ? (
          <Link
            href={withParams(next.href(iso), activeProduct, iso)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#07090F] text-xs font-bold transition-colors shrink-0"
          >
            <span className="hidden sm:inline">{fr ? 'Étape suivante :' : 'Next step:'}</span>
            <span aria-hidden>{next.icon}</span>
            <span className="hidden md:inline">{fr ? next.labelFr : next.labelEn}</span>
            <span aria-hidden>→</span>
          </Link>
        ) : (
          <span className="shrink-0" />
        )}
      </div>
    </div>
  )
}
