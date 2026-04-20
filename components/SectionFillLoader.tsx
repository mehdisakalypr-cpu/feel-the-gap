'use client'

/**
 * SectionFillLoader — anti "section-vide-payée"
 *
 * Quand une section est vide au load, on déclenche un fetch on-demand
 * (POST /api/agents/section-fill) sans débiter de crédits utilisateur.
 * Affiche un spinner pendant 5-15s puis recharge la page (router.refresh)
 * pour afficher le contenu fraîchement inséré.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Section = 'videos' | 'clients' | 'methods' | 'studies'

interface Props {
  iso: string
  section: Section
  product?: string
  /** Texte custom (i18n côté serveur) */
  label?: string
}

export default function SectionFillLoader({ iso, section, product, label }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'fetching' | 'done' | 'failed'>('idle')
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus('fetching')

    const start = Date.now()
    fetch('/api/agents/section-fill', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ iso, section, product }),
    })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; items_added?: number }
        if (cancelled) return
        const elapsed = Date.now() - start
        // UX : on garde le spinner au moins 1.2s pour éviter le flash blanc.
        const wait = Math.max(0, 1200 - elapsed)
        setTimeout(() => {
          if (cancelled) return
          if (j.ok) {
            setCount(j.items_added ?? 0)
            setStatus('done')
            // Refresh — la page va ré-fetcher ses données serveur.
            if ((j.items_added ?? 0) > 0) router.refresh()
          } else {
            setStatus('failed')
          }
        }, wait)
      })
      .catch(() => {
        if (cancelled) return
        setStatus('failed')
      })

    return () => {
      cancelled = true
    }
  }, [iso, section, product, router])

  if (status === 'failed') {
    return (
      <div className="p-6 rounded-2xl border border-white/10 bg-white/5 text-center">
        <p className="text-gray-400 text-sm">
          {label ?? 'Recherche en cours…'} (réessaie dans quelques minutes — nos agents sont sur le coup)
        </p>
      </div>
    )
  }

  if (status === 'done' && count === 0) {
    return (
      <div className="p-6 rounded-2xl border border-white/10 bg-white/5 text-center">
        <p className="text-gray-400 text-sm">Pas de résultat immédiat — un agent va revenir avec un scout ciblé sous 24h.</p>
      </div>
    )
  }

  return (
    <div className="p-6 rounded-2xl border border-[#C9A84C]/30 bg-[#C9A84C]/5 text-center">
      <div className="inline-flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#C9A84C] text-sm font-medium">
          {label ?? 'Recherche en cours…'}
        </p>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Nos agents scrappent le web pour vous — aucun crédit débité.
      </p>
    </div>
  )
}
