'use client'

import { useEffect, useState } from 'react'

export type BpAccessTicket = {
  ok: true
  mode: 'direct' | 'credits' | 'upsell'
  reason: string
  tier: string
  opps_count: number
  credits: {
    balance: number
    subscription: number
    topup: number
    required: number
    cost_per_bp: number
    sufficient: boolean
  }
  ftg: {
    balance: number
    monthly_quota: number
    sufficient: boolean
  }
  upsell: null | {
    missing_credits: number
    subscribe_url: string
    topup_url: string
  }
}

type Props = {
  open: boolean
  oppsCount: number
  onClose: () => void
  onProceedDirect: () => void
  onProceedWithCredits: () => void
}

export default function BpAccessGateModal({
  open,
  oppsCount,
  onClose,
  onProceedDirect,
  onProceedWithCredits,
}: Props) {
  const [ticket, setTicket] = useState<BpAccessTicket | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setTicket(null); setError(null); setLoading(true)
    fetch('/api/reports/bp-access', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ opps_count: oppsCount }),
    })
      .then(async r => {
        if (r.status === 401) {
          window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
          return null
        }
        return r.json()
      })
      .then(json => {
        if (cancelled || !json) return
        if (!json.ok) { setError(json.error ?? 'server_error'); return }
        setTicket(json as BpAccessTicket)
        if (json.mode === 'direct') onProceedDirect()
      })
      .catch(e => {
        if (cancelled) return
        setError(String(e?.message || e))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, oppsCount, onProceedDirect])

  if (!open) return null
  if (loading || !ticket) {
    return (
      <div style={overlayStyle} role="dialog" aria-modal="true">
        <div style={panelStyle}>
          <div style={{ color: '#F5F0E8', fontSize: 14 }}>Vérification de ton accès…</div>
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div style={overlayStyle} role="dialog" aria-modal="true">
        <div style={panelStyle}>
          <div style={{ color: '#FCA5A5', fontSize: 14 }}>Erreur : {error}</div>
          <button onClick={onClose} style={closeBtnStyle}>Fermer</button>
        </div>
      </div>
    )
  }
  if (ticket.mode === 'direct') {
    return null
  }
  if (ticket.mode === 'credits') {
    return (
      <div style={overlayStyle} role="dialog" aria-modal="true">
        <div style={panelStyle}>
          <h2 style={titleStyle}>Utiliser tes crédits</h2>
          <p style={textStyle}>
            Tu n&apos;as pas d&apos;abonnement Premium/Strategy/Ultimate mais tu as
            assez de crédits pour générer <strong>{ticket.opps_count}</strong> business plan(s).
          </p>
          <div style={boxStyle}>
            <div>Coût : <strong>{ticket.credits.required} crédits</strong> ({ticket.credits.cost_per_bp} crédits × {ticket.opps_count} BP)</div>
            <div>Solde : <strong>{ticket.credits.balance} crédits</strong></div>
            <div style={{ color: '#86EFAC', marginTop: 6 }}>Solde après débit : {Math.max(0, ticket.credits.balance - ticket.credits.required)} crédits</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={onClose} style={cancelBtnStyle}>Annuler</button>
            <button onClick={onProceedWithCredits} style={primaryBtnStyle}>
              ⚡ Générer ({ticket.credits.required} crédits)
            </button>
          </div>
          <a href="/pricing" style={upsellLinkStyle}>Ou passe Premium (150 BP/mois inclus)</a>
        </div>
      </div>
    )
  }
  const missing = ticket.upsell?.missing_credits ?? 0
  return (
    <div style={overlayStyle} role="dialog" aria-modal="true">
      <div style={panelStyle}>
        <h2 style={titleStyle}>Débloquer les business plans</h2>
        <p style={textStyle}>
          {ticket.tier === 'free' || ticket.tier === 'solo_producer' || ticket.tier === 'starter'
            ? `Pour générer ${ticket.opps_count} business plan(s), tu as 2 options :`
            : `Ton plan ${ticket.tier} a épuisé son quota Fill-the-Gap ce mois-ci. 2 options :`}
        </p>
        <div style={twoColStyle}>
          <a href={ticket.upsell?.subscribe_url ?? '/pricing'} style={tileStyle}>
            <div style={tileTitleStyle}>🪙 Passer Premium / Strategy</div>
            <div style={tileDescStyle}>À partir de €99/mois — accès direct aux business plans, crédits inclus, quota Fill-the-Gap (150 BP/mo).</div>
            <div style={tileCtaStyle}>Voir les plans →</div>
          </a>
          <a href={ticket.upsell?.topup_url ?? '/pricing#topup'} style={tileStyle}>
            <div style={tileTitleStyle}>⚡ Acheter des crédits</div>
            <div style={tileDescStyle}>
              Il te manque <strong>{missing} crédits</strong> (coût total {ticket.credits.required},
              solde {ticket.credits.balance}). Packs dès €12.
            </div>
            <div style={tileCtaStyle}>Voir les packs →</div>
          </a>
        </div>
        <button onClick={onClose} style={cancelBtnStyle}>Plus tard</button>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(7,9,15,0.72)', zIndex: 500,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
}
const panelStyle: React.CSSProperties = {
  background: '#0D1117', border: '1px solid #1F2937', borderRadius: 16,
  maxWidth: 560, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
}
const titleStyle: React.CSSProperties = { color: '#F5F0E8', fontSize: 20, fontWeight: 700, marginBottom: 8 }
const textStyle: React.CSSProperties = { color: '#CBD5E1', fontSize: 14, lineHeight: 1.5, marginBottom: 12 }
const boxStyle: React.CSSProperties = { background: '#0B1220', border: '1px solid #1E293B', borderRadius: 10, padding: 12, color: '#E2E8F0', fontSize: 13 }
const twoColStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 16 }
const tileStyle: React.CSSProperties = { background: '#0B1220', border: '1px solid #1E293B', borderRadius: 12, padding: 14, textDecoration: 'none', color: 'inherit' }
const tileTitleStyle: React.CSSProperties = { color: '#F5F0E8', fontSize: 15, fontWeight: 700, marginBottom: 6 }
const tileDescStyle: React.CSSProperties = { color: '#CBD5E1', fontSize: 12.5, lineHeight: 1.5, marginBottom: 8 }
const tileCtaStyle: React.CSSProperties = { color: '#E8C97A', fontSize: 13, fontWeight: 600 }
const primaryBtnStyle: React.CSSProperties = { background: 'linear-gradient(135deg,#34D399,#10B981)', color: '#07090F', borderRadius: 10, padding: '10px 14px', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }
const cancelBtnStyle: React.CSSProperties = { background: 'transparent', color: '#94A3B8', borderRadius: 10, padding: '10px 14px', fontWeight: 600, fontSize: 13, border: '1px solid #1F2937', cursor: 'pointer' }
const closeBtnStyle: React.CSSProperties = { ...cancelBtnStyle, marginTop: 12 }
const upsellLinkStyle: React.CSSProperties = { display: 'block', marginTop: 12, color: '#E8C97A', fontSize: 12.5, textDecoration: 'underline' }
