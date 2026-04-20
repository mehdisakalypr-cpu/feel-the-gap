'use client'

/**
 * /marketplace/rfq/[id] — détail RFQ + liste réponses suppliers
 * - Buyer voit toutes les réponses + bouton "accepter"
 * - Supplier (non-owner) voit le RFQ + formulaire pour répondre
 */

import { useEffect, useState, use, FormEvent } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Rfq = {
  id: string
  buyer_user_id: string
  product_slug: string
  product_label: string | null
  qty_min: number | null
  qty_max: number | null
  qty_unit: string
  target_price_eur_per_unit: number | null
  required_certifications: string[] | null
  delivery_country_iso: string | null
  delivery_deadline: string | null
  description: string | null
  status: string
  expires_at: string
  broadcasted_to_count: number
  responses_count: number
  awarded_response_id: string | null
  created_at: string
}

type RfqResponse = {
  id: string
  supplier_user_id: string
  price_eur_per_unit: number
  qty_available: number
  delivery_eta_days: number | null
  notes: string | null
  status: string
  created_at: string
}

export default function RfqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [rfq, setRfq] = useState<Rfq | null>(null)
  const [responses, setResponses] = useState<RfqResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showRespond, setShowRespond] = useState(false)
  const [respond, setRespond] = useState({ price: '', qty: '', eta: '', notes: '' })

  async function reload() {
    const [{ data: u }, { data: rfqRow }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('marketplace_rfq').select('*').eq('id', id).single(),
    ])
    setUserId(u?.user?.id ?? null)
    setRfq((rfqRow as Rfq) ?? null)
    if (rfqRow) {
      const res = await fetch(`/api/marketplace/rfq/${id}/respond`, { credentials: 'include' })
      const json = res.ok ? await res.json() : { responses: [] }
      setResponses(json.responses ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { reload() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const isBuyer = userId != null && rfq != null && rfq.buyer_user_id === userId

  async function submitResponse(e: FormEvent) {
    e.preventDefault()
    setFlash(null)
    setBusyId('respond')
    try {
      const res = await fetch(`/api/marketplace/rfq/${id}/respond`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_eur_per_unit: Number(respond.price),
          qty_available: Number(respond.qty),
          delivery_eta_days: respond.eta ? Number(respond.eta) : null,
          notes: respond.notes || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setFlash(`Erreur: ${json.error ?? 'inconnu'}`)
      } else {
        setFlash('Réponse soumise')
        setShowRespond(false)
        setRespond({ price: '', qty: '', eta: '', notes: '' })
        await reload()
      }
    } finally {
      setBusyId(null)
    }
  }

  async function accept(responseId: string) {
    setBusyId(responseId)
    setFlash(null)
    try {
      const res = await fetch(`/api/marketplace/rfq/${id}/accept`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_id: responseId }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 451) {
          setFlash(`BLOQUÉ — supplier sanctionné (${json.matches?.length ?? 0} match)`)
        } else {
          setFlash(`Erreur: ${json.error ?? 'inconnu'}`)
        }
      } else {
        setFlash('Réponse acceptée — RFQ fermé')
        await reload()
      }
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!rfq) {
    return (
      <div className="min-h-screen bg-[#07090F] text-white p-10">
        <p>RFQ introuvable. <Link href="/marketplace/rfq" className="underline">Retour →</Link></p>
      </div>
    )
  }

  const myResponse = responses.find((r) => r.supplier_user_id === userId)

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <Link href="/marketplace/rfq" className="text-xs text-[#C9A84C] hover:underline">← Retour aux RFQ</Link>

        <div className="p-5 bg-[#0D1117] border border-white/10 rounded-2xl">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-wider text-[#C9A84C]">RFQ · {rfq.status}</div>
              <h1 className="text-2xl font-bold mt-1">{rfq.product_label ?? rfq.product_slug}</h1>
              <p className="text-sm text-gray-400 mt-1">
                {rfq.qty_min ?? '?'}{rfq.qty_max ? ` – ${rfq.qty_max}` : '+'} {rfq.qty_unit}
                {rfq.target_price_eur_per_unit ? ` · cible ${rfq.target_price_eur_per_unit} €/${rfq.qty_unit}` : ''}
                {rfq.delivery_country_iso ? ` · → ${rfq.delivery_country_iso}` : ''}
              </p>
              {rfq.description && (
                <p className="text-sm text-gray-300 mt-3 whitespace-pre-wrap">{rfq.description}</p>
              )}
              {(rfq.required_certifications ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {(rfq.required_certifications ?? []).map((c) => (
                    <span key={c} className="text-[10px] px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-300">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right text-xs text-gray-400">
              <div>{rfq.responses_count}/{rfq.broadcasted_to_count} réponses</div>
              <div>Expire le {new Date(rfq.expires_at).toLocaleDateString('fr-FR')}</div>
            </div>
          </div>
        </div>

        {flash && (
          <div className="p-3 rounded-lg text-sm bg-amber-500/10 border border-amber-500/30 text-amber-200">
            {flash}
          </div>
        )}

        {!isBuyer && rfq.status === 'open' && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold">Votre réponse</h2>
            {myResponse ? (
              <div className="p-4 bg-[#0D1117] border border-emerald-500/30 rounded-xl text-sm">
                Vous avez déjà répondu : <strong>{myResponse.price_eur_per_unit} €/{rfq.qty_unit}</strong>
                {' · '}{myResponse.qty_available} {rfq.qty_unit}
                {' · statut '}<em>{myResponse.status}</em>
              </div>
            ) : showRespond ? (
              <form onSubmit={submitResponse} className="p-4 bg-[#0D1117] border border-white/10 rounded-xl space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs text-gray-400 block mb-1">Prix (€/{rfq.qty_unit}) *</span>
                    <input required type="number" step="0.01" min="0" value={respond.price}
                      onChange={(e) => setRespond((r) => ({ ...r, price: e.target.value }))}
                      className="w-full bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-400 block mb-1">Quantité dispo ({rfq.qty_unit}) *</span>
                    <input required type="number" step="0.001" min="0" value={respond.qty}
                      onChange={(e) => setRespond((r) => ({ ...r, qty: e.target.value }))}
                      className="w-full bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm" />
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs text-gray-400 block mb-1">ETA livraison (jours)</span>
                  <input type="number" min="0" value={respond.eta}
                    onChange={(e) => setRespond((r) => ({ ...r, eta: e.target.value }))}
                    className="w-full bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-400 block mb-1">Notes</span>
                  <textarea value={respond.notes}
                    onChange={(e) => setRespond((r) => ({ ...r, notes: e.target.value }))}
                    className="w-full bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm" rows={3} />
                </label>
                <div className="flex gap-2">
                  <button type="submit" disabled={busyId === 'respond'}
                    className="px-4 py-2 bg-[#C9A84C] text-[#07090F] font-bold text-sm rounded-lg disabled:opacity-50">
                    {busyId === 'respond' ? '…' : 'Soumettre'}
                  </button>
                  <button type="button" onClick={() => setShowRespond(false)}
                    className="px-4 py-2 bg-white/5 border border-white/10 text-sm rounded-lg">
                    Annuler
                  </button>
                </div>
              </form>
            ) : (
              <button onClick={() => setShowRespond(true)}
                className="px-4 py-2 bg-emerald-500 text-[#07090F] font-bold text-sm rounded-lg">
                + Répondre à cette RFQ
              </button>
            )}
          </section>
        )}

        {isBuyer && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold">Réponses ({responses.length})</h2>
            {responses.length === 0 ? (
              <p className="text-sm text-gray-400 p-6 bg-white/[.02] border border-white/5 rounded-xl text-center">
                Aucune réponse pour l'instant. Les suppliers ont jusqu'au {new Date(rfq.expires_at).toLocaleDateString('fr-FR')} pour répondre.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {responses.map((r) => (
                  <div key={r.id} className="p-4 bg-[#0D1117] border border-white/10 rounded-xl">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">
                          {r.price_eur_per_unit} €/{rfq.qty_unit} · {r.qty_available} {rfq.qty_unit}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Supplier {r.supplier_user_id.slice(0, 8)}…
                          {r.delivery_eta_days != null ? ` · ETA ${r.delivery_eta_days}j` : ''}
                          {' · '}{r.status}
                        </div>
                        {r.notes && <div className="text-xs text-gray-300 mt-2">{r.notes}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        {rfq.status === 'open' && r.status === 'submitted' && (
                          <button
                            onClick={() => accept(r.id)}
                            disabled={busyId === r.id}
                            className="px-3 py-1.5 text-xs font-bold bg-[#C9A84C] text-[#07090F] rounded-lg hover:bg-[#E8C97A] disabled:opacity-50"
                          >
                            {busyId === r.id ? '…' : 'Accepter'}
                          </button>
                        )}
                        {r.status === 'accepted' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 uppercase">
                            Accepté
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
