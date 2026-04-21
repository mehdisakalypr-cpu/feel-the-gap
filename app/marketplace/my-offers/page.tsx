'use client'

/**
 * /marketplace/my-offers — offres de matching reçues / envoyées
 * Shaka 2026-04-21
 *
 * 4 couleurs selon status :
 *   🟠 orange clignotant → proposed (match généré, action requise)
 *   🔵 bleu → counter_proposed (contre-offre en attente)
 *   🔴 rouge → rejected (refusé par l'un des 2)
 *   🟢 vert → confirmed / paid (les 2 acceptent, paiement en attente ou fait)
 *
 * Anonymisé : pseudos seulement jusqu'à fee payé.
 */

import { useState, useEffect, useMemo } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'

type Match = {
  id: string
  status: 'proposed' | 'counter_proposed' | 'accepted_producer' | 'accepted_buyer' | 'confirmed' | 'paid' | 'rejected' | 'expired'
  match_score: number | null
  proposed_quantity_kg: number | null
  proposed_price_eur_per_kg: number | null
  proposed_total_eur: number | null
  counter_price_eur_per_kg: number | null
  counter_quantity_kg: number | null
  counter_total_eur: number | null
  counter_by: 'producer' | 'buyer' | null
  counter_message: string | null
  counter_at: string | null
  producer_decision: 'accept' | 'refuse' | 'counter' | null
  buyer_decision: 'accept' | 'refuse' | 'counter' | null
  pricing_tier_label: string | null
  pricing_tier_fee_eur: number | null
  buyer_pseudo: string | null
  seller_pseudo: string | null
  created_at: string
  accepted_at: string | null
  confirmed_at: string | null
  identities_revealed_at: string | null
  volume_product: string | null
  volume_country: string | null
  demand_product: string | null
  demand_country: string | null
}

const C = {
  bg: '#07090F', card: '#0D1117', gold: '#C9A84C', text: '#E8E0D0',
  muted: '#9BA8B8', dim: '#5A6A7A', green: '#10B981', red: '#EF4444',
  blue: '#60A5FA', amber: '#F59E0B', purple: '#A78BFA',
}

function statusMeta(s: Match['status']) {
  switch (s) {
    case 'proposed': return { color: C.amber, label: 'Match proposé', icon: '🟠', blink: true }
    case 'counter_proposed': return { color: C.blue, label: 'Contre-offre en attente', icon: '🔵', blink: false }
    case 'accepted_producer': return { color: C.amber, label: 'Producteur a accepté · en attente buyer', icon: '🟠', blink: false }
    case 'accepted_buyer': return { color: C.amber, label: 'Buyer a accepté · en attente producteur', icon: '🟠', blink: false }
    case 'confirmed': return { color: C.green, label: 'Confirmé · paiement en attente', icon: '🟢', blink: false }
    case 'paid': return { color: C.green, label: '✓ Payé · identités révélées', icon: '🟢', blink: false }
    case 'rejected': return { color: C.red, label: 'Refusé', icon: '🔴', blink: false }
    case 'expired': return { color: C.dim, label: 'Expiré', icon: '⚪', blink: false }
  }
}

export default function MyOffersPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | Match['status']>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [counterForm, setCounterForm] = useState<{ price: string; quantity: string; message: string }>({ price: '', quantity: '', message: '' })
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    setLoading(true); setError(null)
    try {
      const sb = createSupabaseBrowser()
      const { data, error: err } = await sb
        .from('v_marketplace_my_offers')
        .select('*')
        .order('created_at', { ascending: false })
      if (err) throw err
      setMatches((data as Match[]) ?? [])
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function payFee(id: string) {
    setSubmitting(true); setError(null)
    try {
      const r = await fetch(`/api/marketplace/matches/${id}/pay-fee`, { method: 'POST' })
      const j = await r.json()
      if (r.status === 401 && j.redirect) { window.location.href = j.redirect; return }
      if (!r.ok) throw new Error(j.error || 'Paiement impossible')
      if (j.url) { window.location.href = j.url; return } // Stripe redirect
      if (j.mode === 'subscription') {
        // Quota consommé, UI rafraîchie pour refléter paid+reveal
        await load()
      }
    } catch (e) { setError((e as Error).message) }
    finally { setSubmitting(false) }
  }

  async function decide(id: string, action: 'accept' | 'refuse' | 'counter', counter?: { price?: number; quantity?: number; message?: string }) {
    setSubmitting(true); setError(null)
    try {
      const r = await fetch(`/api/marketplace/matches/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, counter }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Decide failed')
      await load()
      setSelected(null)
      setCounterForm({ price: '', quantity: '', message: '' })
    } catch (e) { setError((e as Error).message) }
    finally { setSubmitting(false) }
  }

  const filtered = useMemo(
    () => filter === 'all' ? matches : matches.filter(m => m.status === filter),
    [matches, filter],
  )

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: matches.length }
    for (const m of matches) c[m.status] = (c[m.status] ?? 0) + 1
    return c
  }, [matches])

  return (
    <div style={{ padding: 24, color: C.text, fontFamily: 'Inter, sans-serif', maxWidth: 1400, margin: '0 auto' }}>
      <style>{`
        @keyframes blink-amber {
          0%, 100% { box-shadow: 0 0 0 0 ${C.amber}00; }
          50% { box-shadow: 0 0 0 6px ${C.amber}55; }
        }
        .blink-row { animation: blink-amber 1.6s ease-in-out infinite; }
      `}</style>

      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: C.gold, margin: 0 }}>📬 Mes offres</h1>
        <p style={{ color: C.muted, fontSize: '.88rem', margin: '6px 0 0', lineHeight: 1.5 }}>
          Matches entre ton offre (volume de production) et une demande (buyer), ou l&apos;inverse. <strong style={{ color: C.gold }}>Tout reste anonyme</strong> des deux côtés jusqu&apos;à ce que les 2 parties acceptent <em>et</em> la commission soit payée.
        </p>
      </header>

      {/* Legend 4 colors */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20, fontSize: '.74rem', color: C.muted }}>
        <span><span style={{ color: C.amber }}>🟠 Orange</span> proposé · action requise</span>
        <span><span style={{ color: C.blue }}>🔵 Bleu</span> contre-offre en attente</span>
        <span><span style={{ color: C.green }}>🟢 Vert</span> confirmé / payé</span>
        <span><span style={{ color: C.red }}>🔴 Rouge</span> refusé</span>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['all', 'proposed', 'counter_proposed', 'accepted_producer', 'accepted_buyer', 'confirmed', 'paid', 'rejected'] as const).map(f => {
          const n = counts[f] ?? 0
          if (f !== 'all' && n === 0) return null
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 12px', fontSize: '.72rem',
                background: filter === f ? C.gold : 'transparent',
                color: filter === f ? C.bg : C.muted,
                border: `1px solid ${filter === f ? C.gold : C.dim}44`,
                borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {f === 'all' ? 'Tous' : f.replace('_', ' ')} ({n})
            </button>
          )
        })}
      </div>

      {error && (
        <div style={{ padding: 12, background: `${C.red}15`, border: `1px solid ${C.red}44`, color: C.red, fontSize: '.78rem', marginBottom: 12, borderRadius: 4 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: '.8rem' }}>
          Aucune offre dans cette catégorie pour l&apos;instant.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map(m => {
            const meta = statusMeta(m.status)
            const isSel = selected === m.id
            const isPendingProposed = m.status === 'proposed' || m.status === 'accepted_producer' || m.status === 'accepted_buyer'
            return (
              <div
                key={m.id}
                onClick={() => setSelected(isSel ? null : m.id)}
                className={meta.blink ? 'blink-row' : ''}
                style={{
                  padding: 16, borderRadius: 8, cursor: 'pointer',
                  background: `${meta.color}0D`,
                  border: `1.5px solid ${meta.color}66`,
                  transition: 'all .15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: meta.color, fontSize: '.9rem' }}>
                        {meta.icon} {meta.label}
                      </span>
                      <span style={{ fontSize: '.7rem', color: C.dim }}>
                        Match #{m.id.slice(0, 8)} · score {m.match_score ?? '—'}%
                      </span>
                    </div>
                    <div style={{ marginTop: 8, fontSize: '.8rem', color: C.text }}>
                      <span style={{ color: C.gold }}>{m.volume_product ?? m.demand_product}</span>
                      {m.volume_country && <span style={{ color: C.muted }}> · origine {m.volume_country}</span>}
                      {m.demand_country && <span style={{ color: C.muted }}> · livraison {m.demand_country}</span>}
                    </div>
                    <div style={{ marginTop: 4, fontSize: '.78rem', color: C.muted }}>
                      {Number(m.proposed_quantity_kg ?? 0).toLocaleString('fr-FR')} kg @
                      {' '}€{Number(m.proposed_price_eur_per_kg ?? 0).toFixed(2)}/kg
                      {' '}→ <strong style={{ color: C.text }}>€{Number(m.proposed_total_eur ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}</strong>
                    </div>
                    {m.status === 'counter_proposed' && m.counter_total_eur && (
                      <div style={{ marginTop: 6, padding: 8, background: `${C.blue}15`, border: `1px solid ${C.blue}44`, borderRadius: 4, fontSize: '.76rem' }}>
                        <strong style={{ color: C.blue }}>Contre-offre ({m.counter_by})</strong> :
                        {' '}{Number(m.counter_quantity_kg ?? 0).toLocaleString('fr-FR')} kg @
                        {' '}€{Number(m.counter_price_eur_per_kg ?? 0).toFixed(2)}/kg
                        {' '}→ €{Number(m.counter_total_eur ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                        {m.counter_message && <div style={{ marginTop: 4, color: C.muted, fontStyle: 'italic' }}>&quot;{m.counter_message}&quot;</div>}
                      </div>
                    )}
                    {m.status === 'confirmed' && m.pricing_tier_fee_eur && (
                      <div style={{ marginTop: 6, padding: 8, background: `${C.green}15`, border: `1px solid ${C.green}44`, borderRadius: 4, fontSize: '.76rem' }}>
                        <strong style={{ color: C.green }}>Commission due</strong> : €{(m.pricing_tier_fee_eur / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                        {' '}({m.pricing_tier_label}, ajusté PPP pays acheteur)
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '.68rem', color: C.dim, minWidth: 120 }}>
                    Reçu le {new Date(m.created_at).toLocaleDateString('fr-FR')}
                  </div>
                </div>

                {/* Actions */}
                {isSel && isPendingProposed && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.dim}33` }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); decide(m.id, 'accept') }}
                        disabled={submitting}
                        style={actionBtn(C.green)}
                      >✓ Accepter</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); decide(m.id, 'refuse') }}
                        disabled={submitting}
                        style={actionBtn(C.red)}
                      >✕ Refuser</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setCounterForm({ price: String(m.proposed_price_eur_per_kg ?? ''), quantity: String(m.proposed_quantity_kg ?? ''), message: '' }) }}
                        style={actionBtn(C.blue)}
                      >⇄ Contre-offre</button>
                    </div>
                    {counterForm.price && (
                      <div style={{ marginTop: 10, padding: 10, background: `${C.blue}08`, border: `1px solid ${C.blue}33`, borderRadius: 4 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                          <input
                            type="number" step="0.01" placeholder="Prix €/kg"
                            value={counterForm.price}
                            onChange={(e) => setCounterForm(p => ({ ...p, price: e.target.value }))}
                            style={inputStyle}
                          />
                          <input
                            type="number" placeholder="Quantité kg"
                            value={counterForm.quantity}
                            onChange={(e) => setCounterForm(p => ({ ...p, quantity: e.target.value }))}
                            style={inputStyle}
                          />
                        </div>
                        <textarea
                          placeholder="Message facultatif (motif, conditions…)"
                          value={counterForm.message}
                          onChange={(e) => setCounterForm(p => ({ ...p, message: e.target.value }))}
                          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              decide(m.id, 'counter', {
                                price: Number(counterForm.price),
                                quantity: Number(counterForm.quantity) || Number(m.proposed_quantity_kg),
                                message: counterForm.message,
                              })
                            }}
                            disabled={submitting || !counterForm.price}
                            style={actionBtn(C.blue)}
                          >Envoyer contre-offre</button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setCounterForm({ price: '', quantity: '', message: '' }) }}
                            style={{ ...actionBtn(C.dim), background: 'transparent' }}
                          >Annuler</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isSel && m.status === 'confirmed' && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.dim}33` }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); payFee(m.id) }}
                      disabled={submitting}
                      style={actionBtn(C.gold)}
                    >
                      💳 Payer la commission ({m.pricing_tier_fee_eur ? `€${(m.pricing_tier_fee_eur / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}` : '—'})
                    </button>
                    <span style={{ marginLeft: 10, fontSize: '.7rem', color: C.muted }}>
                      Pris sur ton abo si quota dispo, sinon Stripe one-shot.
                    </span>
                  </div>
                )}

                {isSel && m.status === 'paid' && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.dim}33`, fontSize: '.78rem', color: C.muted }}>
                    <div style={{ color: C.green, fontWeight: 600, marginBottom: 6 }}>
                      ✓ Commission payée le {m.identities_revealed_at ? new Date(m.identities_revealed_at).toLocaleDateString('fr-FR') : '—'}
                    </div>
                    Ouvre le fil de discussion dans <a href={`/marketplace/${m.id}`} style={{ color: C.gold }}>la fiche du match</a> pour récupérer les coordonnées de l&apos;autre partie et organiser la transaction.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <footer style={{ marginTop: 24, padding: 14, background: C.card, border: `1px dashed ${C.dim}`, borderRadius: 6, fontSize: '.72rem', color: C.muted, lineHeight: 1.6 }}>
        <div style={{ color: C.gold, fontWeight: 600, marginBottom: 4 }}>💎 Deux formules au choix</div>
        <strong>Abonnement</strong> (Starter €99 / Growth €299 / Pro €749 / Unlimited €1 499 / mo baseline × PPP pays acheteur) · <strong>Pay-per-act</strong> (€149 / €499 / €999 selon volume transaction × PPP). <a href="/marketplace/subscriptions" style={{ color: C.gold }}>Voir les formules →</a>
      </footer>
    </div>
  )
}

// ── Atoms ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', background: C.bg, border: `1px solid ${C.dim}44`,
  color: C.text, fontSize: '.76rem', fontFamily: 'inherit', outline: 'none', borderRadius: 3,
}

function actionBtn(color: string): React.CSSProperties {
  return {
    padding: '8px 14px', background: `${color}20`, border: `1px solid ${color}`,
    color, fontSize: '.76rem', fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit', borderRadius: 4,
  }
}
