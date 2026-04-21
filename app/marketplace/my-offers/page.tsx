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
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase'
import { t, getLocale } from '@/lib/i18n/t'

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

// Render description template with nested {strong} + {em} tags as React elements
function renderRichDescription(strongColor: string): React.ReactNode {
  const raw = t('marketplace.myOffers.description')
  const re = /\{(strong|em)\}(.*?)\{\/\1\}/g
  const parts: React.ReactNode[] = []
  let last = 0
  let i = 0
  for (const match of raw.matchAll(re)) {
    const idx = match.index ?? 0
    if (idx > last) parts.push(raw.slice(last, idx))
    if (match[1] === 'strong') parts.push(<strong key={i++} style={{ color: strongColor }}>{match[2]}</strong>)
    else parts.push(<em key={i++}>{match[2]}</em>)
    last = idx + match[0].length
  }
  if (last < raw.length) parts.push(raw.slice(last))
  return parts
}

function statusMeta(s: Match['status']) {
  switch (s) {
    case 'proposed':          return { color: C.amber, label: t('marketplace.myOffers.status.proposed'),          icon: '🟠', blink: true }
    case 'counter_proposed':  return { color: C.blue,  label: t('marketplace.myOffers.status.counter_proposed'),  icon: '🔵', blink: false }
    case 'accepted_producer': return { color: C.amber, label: t('marketplace.myOffers.status.accepted_producer'), icon: '🟠', blink: false }
    case 'accepted_buyer':    return { color: C.amber, label: t('marketplace.myOffers.status.accepted_buyer'),    icon: '🟠', blink: false }
    case 'confirmed':         return { color: C.green, label: t('marketplace.myOffers.status.confirmed'),         icon: '🟢', blink: false }
    case 'paid':              return { color: C.green, label: t('marketplace.myOffers.status.paid'),              icon: '🟢', blink: false }
    case 'rejected':          return { color: C.red,   label: t('marketplace.myOffers.status.rejected'),          icon: '🔴', blink: false }
    case 'expired':           return { color: C.dim,   label: t('marketplace.myOffers.status.expired'),           icon: '⚪', blink: false }
  }
}

export default function MyOffersPage() {
  const localeFmt = (() => {
    const l = getLocale()
    return l === 'en' ? 'en-US' : l === 'es' ? 'es-ES' : 'fr-FR'
  })()
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
      if (!r.ok) throw new Error(j.error || t('marketplace.myOffers.errors.payFailed'))
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
      if (!r.ok) throw new Error(j.error || t('marketplace.myOffers.errors.decideFailed'))
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
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: C.gold, margin: 0 }}>{t('marketplace.myOffers.title')}</h1>
        <p style={{ color: C.muted, fontSize: '.88rem', margin: '6px 0 0', lineHeight: 1.5 }}>
          {renderRichDescription(C.gold)}
        </p>
      </header>

      {/* Legend 4 colors */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20, fontSize: '.74rem', color: C.muted }}>
        <span style={{ color: C.amber }}>{t('marketplace.myOffers.legend.orange')}</span>
        <span style={{ color: C.blue }}>{t('marketplace.myOffers.legend.blue')}</span>
        <span style={{ color: C.green }}>{t('marketplace.myOffers.legend.green')}</span>
        <span style={{ color: C.red }}>{t('marketplace.myOffers.legend.red')}</span>
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
              {f === 'all' ? t('marketplace.myOffers.filter.all') : f.replace('_', ' ')} ({n})
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
        <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>{t('marketplace.myOffers.loading')}</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: '.8rem' }}>
          {t('marketplace.myOffers.empty')}
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
                        {t('marketplace.myOffers.matchLine', { id: m.id.slice(0, 8), score: m.match_score ?? '—' })}
                      </span>
                    </div>
                    <div style={{ marginTop: 8, fontSize: '.8rem', color: C.text }}>
                      <span style={{ color: C.gold }}>{m.volume_product ?? m.demand_product}</span>
                      {m.volume_country && <span style={{ color: C.muted }}> · {t('marketplace.myOffers.origin', { country: m.volume_country })}</span>}
                      {m.demand_country && <span style={{ color: C.muted }}> · {t('marketplace.myOffers.delivery', { country: m.demand_country })}</span>}
                    </div>
                    <div style={{ marginTop: 4, fontSize: '.78rem', color: C.muted }}>
                      {Number(m.proposed_quantity_kg ?? 0).toLocaleString(localeFmt)} kg @
                      {' '}€{Number(m.proposed_price_eur_per_kg ?? 0).toFixed(2)}/kg
                      {' '}→ <strong style={{ color: C.text }}>€{Number(m.proposed_total_eur ?? 0).toLocaleString(localeFmt, { maximumFractionDigits: 0 })}</strong>
                    </div>
                    {m.status === 'counter_proposed' && m.counter_total_eur && (
                      <div style={{ marginTop: 6, padding: 8, background: `${C.blue}15`, border: `1px solid ${C.blue}44`, borderRadius: 4, fontSize: '.76rem' }}>
                        <strong style={{ color: C.blue }}>{t('marketplace.myOffers.counterOffer', { by: m.counter_by ?? '' })}</strong> :
                        {' '}{Number(m.counter_quantity_kg ?? 0).toLocaleString(localeFmt)} kg @
                        {' '}€{Number(m.counter_price_eur_per_kg ?? 0).toFixed(2)}/kg
                        {' '}→ €{Number(m.counter_total_eur ?? 0).toLocaleString(localeFmt, { maximumFractionDigits: 0 })}
                        {m.counter_message && <div style={{ marginTop: 4, color: C.muted, fontStyle: 'italic' }}>&quot;{m.counter_message}&quot;</div>}
                      </div>
                    )}
                    {m.status === 'confirmed' && m.pricing_tier_fee_eur && (
                      <div style={{ marginTop: 6, padding: 8, background: `${C.green}15`, border: `1px solid ${C.green}44`, borderRadius: 4, fontSize: '.76rem' }}>
                        <strong style={{ color: C.green }}>{t('marketplace.myOffers.commissionDue')}</strong> : €{(m.pricing_tier_fee_eur / 100).toLocaleString(localeFmt, { maximumFractionDigits: 2 })}
                        {' '}{t('marketplace.myOffers.commissionDueSuffix', { tier: m.pricing_tier_label ?? '' })}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '.68rem', color: C.dim, minWidth: 120 }}>
                    {t('marketplace.myOffers.receivedOn', { date: new Date(m.created_at).toLocaleDateString(localeFmt) })}
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
                      >{t('marketplace.myOffers.actions.accept')}</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); decide(m.id, 'refuse') }}
                        disabled={submitting}
                        style={actionBtn(C.red)}
                      >{t('marketplace.myOffers.actions.refuse')}</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setCounterForm({ price: String(m.proposed_price_eur_per_kg ?? ''), quantity: String(m.proposed_quantity_kg ?? ''), message: '' }) }}
                        style={actionBtn(C.blue)}
                      >{t('marketplace.myOffers.actions.counter')}</button>
                    </div>
                    {counterForm.price && (
                      <div style={{ marginTop: 10, padding: 10, background: `${C.blue}08`, border: `1px solid ${C.blue}33`, borderRadius: 4 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                          <input
                            type="number" step="0.01" placeholder={t('marketplace.myOffers.counterForm.pricePlaceholder')}
                            value={counterForm.price}
                            onChange={(e) => setCounterForm(p => ({ ...p, price: e.target.value }))}
                            style={inputStyle}
                          />
                          <input
                            type="number" placeholder={t('marketplace.myOffers.counterForm.quantityPlaceholder')}
                            value={counterForm.quantity}
                            onChange={(e) => setCounterForm(p => ({ ...p, quantity: e.target.value }))}
                            style={inputStyle}
                          />
                        </div>
                        <textarea
                          placeholder={t('marketplace.myOffers.counterForm.messagePlaceholder')}
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
                          >{t('marketplace.myOffers.actions.sendCounter')}</button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setCounterForm({ price: '', quantity: '', message: '' }) }}
                            style={{ ...actionBtn(C.dim), background: 'transparent' }}
                          >{t('marketplace.myOffers.actions.cancel')}</button>
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
                      {t('marketplace.myOffers.actions.payFee', { amount: m.pricing_tier_fee_eur ? `€${(m.pricing_tier_fee_eur / 100).toLocaleString(localeFmt, { maximumFractionDigits: 2 })}` : '—' })}
                    </button>
                    <span style={{ marginLeft: 10, fontSize: '.7rem', color: C.muted }}>
                      {t('marketplace.myOffers.payFeeHint')}
                    </span>
                  </div>
                )}

                {isSel && m.status === 'paid' && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.dim}33`, fontSize: '.78rem', color: C.muted }}>
                    <div style={{ color: C.green, fontWeight: 600, marginBottom: 6 }}>
                      {t('marketplace.myOffers.paidOn', { date: m.identities_revealed_at ? new Date(m.identities_revealed_at).toLocaleDateString(localeFmt) : '—' })}
                    </div>
                    {(() => {
                      const raw = t('marketplace.myOffers.paidHint', { link: '%%LINK%%' })
                      const [pre, post] = raw.split('%%LINK%%')
                      return <>{pre}<a href={`/marketplace/${m.id}`} style={{ color: C.gold }}>{t('marketplace.myOffers.paidHintLink')}</a>{post}</>
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <footer style={{ marginTop: 24, padding: 14, background: C.card, border: `1px dashed ${C.dim}`, borderRadius: 6, fontSize: '.72rem', color: C.muted, lineHeight: 1.6 }}>
        <div style={{ color: C.gold, fontWeight: 600, marginBottom: 4 }}>{t('marketplace.myOffers.footer.title')}</div>
        {(() => {
          const subStrong = t('marketplace.myOffers.footer.subStrong')
          const ppaStrong = t('marketplace.myOffers.footer.ppaStrong')
          const raw = t('marketplace.myOffers.footer.body', { subStrong: '%%SUB%%', ppaStrong: '%%PPA%%' })
          const parts = raw.split(/(%%SUB%%|%%PPA%%)/)
          return (
            <>
              {parts.map((p, i) => {
                if (p === '%%SUB%%') return <strong key={i}>{subStrong}</strong>
                if (p === '%%PPA%%') return <strong key={i}>{ppaStrong}</strong>
                return <span key={i}>{p}</span>
              })}
              {' '}<Link href="/marketplace/subscriptions" style={{ color: C.gold }}>{t('marketplace.myOffers.footer.link')}</Link>
            </>
          )
        })()}
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
