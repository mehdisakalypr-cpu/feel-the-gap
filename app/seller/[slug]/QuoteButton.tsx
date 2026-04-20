'use client'

import { useState } from 'react'

const C = { accent: '#60A5FA', bg: '#0A0E1A', card: '#0F172A', border: 'rgba(96,165,250,.2)', text: '#E2E8F0', muted: '#64748B', green: '#10B981', red: '#EF4444', gold: '#C9A84C' }

type TransportQuote = {
  provider: 'freightos' | 'estimator'
  mode: string
  priceEur: number
  transitDays: number
  insuranceEur?: number
  customsEur?: number
}

const MODE_LABELS: Record<string, string> = {
  ocean_fcl: 'Mer FCL',
  ocean_lcl: 'Mer LCL',
  air: 'Aérien',
  parcel: 'Colis express',
  road: 'Route',
  rail: 'Rail',
}

export default function QuoteButton(props: {
  productId: string
  sellerId: string
  productTitle: string
  originCountry?: string
  originPort?: string | null
  unitPriceEur?: number
  unit?: string
}) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [quotes, setQuotes] = useState<TransportQuote[] | null>(null)

  async function fetchEstimate(fd: FormData) {
    const country = String(fd.get('country') ?? '').trim().toUpperCase()
    const destination = String(fd.get('destination') ?? '').trim()
    const quantity = Number(fd.get('quantity') ?? 0)
    if (!country || country.length < 2 || !destination || !quantity) {
      setError('Pays ISO3 + destination + quantité requis pour estimer')
      return
    }
    setEstimating(true); setError(null); setQuotes(null)
    const weightKg = quantity * 1 // default : 1kg par unité — approximation prudente
    const valueEur = (props.unitPriceEur ?? 0) * quantity
    try {
      const r = await fetch('/api/transport/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originPort: props.originPort || props.originCountry || 'origin',
          originCountry: props.originCountry || 'FRA',
          destinationPort: destination,
          destinationCountry: country,
          weightKg,
          valueEur: valueEur || undefined,
          compare: true,
        }),
      })
      const d = await r.json()
      if (d.ok && Array.isArray(d.quotes)) setQuotes(d.quotes)
      else setError(d.error || 'Estimation indisponible')
    } catch (e) {
      setError('Réseau indisponible')
    }
    setEstimating(false)
  }

  async function handleEstimate(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    const form = (e.target as HTMLElement).closest('form')
    if (form) await fetchEstimate(new FormData(form))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true); setError(null)
    const fd = new FormData(e.currentTarget)
    const r = await fetch('/api/seller/quote-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: props.productId,
        seller_id: props.sellerId,
        buyer_email: fd.get('email'),
        buyer_company: fd.get('company'),
        buyer_country: fd.get('country'),
        quantity: fd.get('quantity'),
        incoterm: fd.get('incoterm'),
        destination: fd.get('destination'),
        message: fd.get('message'),
        transport_estimate: quotes?.[0] ?? null,
      }),
    })
    const d = await r.json()
    setSubmitting(false)
    if (d.ok) setDone(true)
    else setError(d.error || 'Erreur')
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ width: '100%', background: C.accent, color: C.bg, padding: '10px 16px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
        Demander un devis
      </button>
    )
  }

  if (done) {
    return (
      <div style={{ padding: 12, background: 'rgba(16,185,129,.1)', border: `1px solid ${C.green}`, color: C.green, fontSize: 13, textAlign: 'center' }}>
        ✓ Demande envoyée — le vendeur te répondra par email.
      </div>
    )
  }

  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, padding: 12, marginTop: 8 }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Devis pour <strong style={{ color: C.text }}>{props.productTitle}</strong></div>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 8 }}>
        <input name="email" type="email" required placeholder="Ton email pro" style={fieldStyle} />
        <input name="company" required placeholder="Nom société" style={fieldStyle} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input name="country" required maxLength={3} placeholder="Pays ISO3" style={fieldStyle} />
          <input name="quantity" required placeholder="Quantité" type="number" min="1" style={fieldStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <select name="incoterm" defaultValue="CIF" style={fieldStyle}>
            {['EXW','FCA','CPT','CIP','DAP','DPU','DDP','FAS','FOB','CFR','CIF'].map(x => <option key={x}>{x}</option>)}
          </select>
          <input name="destination" placeholder="Port/ville destination" style={fieldStyle} />
        </div>
        <button type="button" onClick={handleEstimate} disabled={estimating} style={{
          background: 'transparent', border: `1px dashed ${C.gold}`, color: C.gold,
          padding: '6px 10px', fontSize: 11, fontWeight: 600,
          cursor: estimating ? 'not-allowed' : 'pointer',
          opacity: estimating ? 0.6 : 1,
        }}>
          {estimating ? 'Estimation…' : '→ Estimer transport (3 modes)'}
        </button>
        {quotes && quotes.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 8, fontSize: 11 }}>
            <div style={{ color: C.muted, marginBottom: 6 }}>
              Estimations ({quotes[0].provider === 'freightos' ? 'Freightos live' : 'estimateur interne'}) — cheapest first
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              {quotes.map((q, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6, padding: '3px 0', borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ color: C.text }}>{MODE_LABELS[q.mode] ?? q.mode}</span>
                  <span style={{ color: C.muted }}>{q.transitDays}j</span>
                  <strong style={{ color: C.gold }}>{q.priceEur.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</strong>
                </div>
              ))}
            </div>
            {quotes[0].insuranceEur && (
              <div style={{ color: C.muted, marginTop: 6, fontSize: 10 }}>
                + Assurance ≈ {Math.round(quotes[0].insuranceEur)} € · Douane ≈ {Math.round(quotes[0].customsEur ?? 0)} €
              </div>
            )}
          </div>
        )}
        <textarea name="message" placeholder="Message (optionnel)" rows={2} style={fieldStyle} />
        {error && <div style={{ color: C.red, fontSize: 11 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="submit" disabled={submitting} style={{ flex: 1, background: C.accent, color: C.bg, padding: '8px 12px', border: 'none', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, fontSize: 12 }}>
            {submitting ? 'Envoi…' : 'Envoyer la demande'}
          </button>
          <button type="button" onClick={() => setOpen(false)} style={{ padding: '8px 12px', background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer', fontSize: 12 }}>
            Annuler
          </button>
        </div>
      </form>
    </div>
  )
}

const fieldStyle: React.CSSProperties = {
  background: C.card, border: `1px solid ${C.border}`, color: C.text, padding: '6px 8px', fontSize: 12, fontFamily: 'inherit', width: '100%',
}
