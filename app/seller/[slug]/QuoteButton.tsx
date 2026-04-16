'use client'

import { useState } from 'react'

const C = { accent: '#60A5FA', bg: '#0A0E1A', card: '#0F172A', border: 'rgba(96,165,250,.2)', text: '#E2E8F0', muted: '#64748B', green: '#10B981', red: '#EF4444' }

export default function QuoteButton(props: { productId: string; sellerId: string; productTitle: string }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          <input name="quantity" required placeholder="Quantité" style={fieldStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <select name="incoterm" defaultValue="CIF" style={fieldStyle}>
            {['EXW','FCA','CPT','CIP','DAP','DPU','DDP','FAS','FOB','CFR','CIF'].map(x => <option key={x}>{x}</option>)}
          </select>
          <input name="destination" placeholder="Destination" style={fieldStyle} />
        </div>
        <textarea name="message" placeholder="Message (optionnel)" rows={2} style={fieldStyle} />
        {error && <div style={{ color: C.red, fontSize: 11 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="submit" disabled={submitting} style={{ flex: 1, background: C.accent, color: C.bg, padding: '8px 12px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
            {submitting ? 'Envoi…' : 'Envoyer'}
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
