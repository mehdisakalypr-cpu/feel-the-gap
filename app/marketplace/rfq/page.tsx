'use client'

/**
 * /marketplace/rfq — liste des RFQ du buyer connecté.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Rfq = {
  id: string
  product_slug: string
  product_label: string | null
  qty_min: number | null
  qty_max: number | null
  qty_unit: string
  target_price_eur_per_unit: number | null
  status: string
  expires_at: string
  broadcasted_to_count: number
  responses_count: number
  created_at: string
}

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
  closing: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
  closed: 'bg-violet-500/15 border-violet-500/40 text-violet-300',
  expired: 'bg-white/5 border-white/10 text-gray-500',
}

export default function RfqListPage() {
  const [rfqs, setRfqs] = useState<Rfq[]>([])
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      if (cancelled) return
      const isAuth = !!u?.user
      setAuthed(isAuth)
      if (!isAuth) { setLoading(false); return }
      const res = await fetch('/api/marketplace/rfq', { credentials: 'include' })
      const json = res.ok ? await res.json() : { rfqs: [] }
      if (cancelled) return
      setRfqs(json.rfqs ?? [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#C9A84C]">Marketplace · RFQ</div>
            <h1 className="text-2xl font-bold">Mes appels d'offres</h1>
            <p className="text-sm text-gray-400">Publiez une demande, recevez plusieurs cotations en parallèle.</p>
          </div>
          <Link
            href="/marketplace/rfq/new"
            className="px-4 py-2 bg-[#C9A84C] text-[#07090F] font-bold text-sm rounded-lg hover:bg-[#E8C97A]"
          >
            + Nouvelle RFQ
          </Link>
        </div>

        {!authed && !loading && (
          <div className="p-6 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm text-amber-200">
            Connecte-toi pour voir tes RFQ. <Link href="/login" className="underline">Login →</Link>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && authed && rfqs.length === 0 && (
          <div className="p-8 bg-white/[.02] border border-white/5 rounded-xl text-center">
            <p className="text-sm text-gray-400">Aucune RFQ pour l'instant. Crées-en une pour recevoir tes premières cotations.</p>
          </div>
        )}

        {!loading && rfqs.length > 0 && (
          <div className="grid grid-cols-1 gap-3">
            {rfqs.map((r) => (
              <Link
                key={r.id}
                href={`/marketplace/rfq/${r.id}`}
                className="block p-4 bg-[#0D1117] border border-white/10 rounded-xl hover:border-[#C9A84C]/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {r.product_label ?? r.product_slug}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {r.qty_min ?? '?'}{r.qty_max ? ` – ${r.qty_max}` : '+'} {r.qty_unit}
                      {r.target_price_eur_per_unit ? ` · cible ${r.target_price_eur_per_unit} €/${r.qty_unit}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider ${STATUS_BADGE[r.status] ?? 'bg-white/5 border-white/10 text-gray-400'}`}>
                      {r.status}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {r.responses_count}/{r.broadcasted_to_count} réponses
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
