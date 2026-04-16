'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Product = {
  id: string
  slug: string
  title: string
  origin_country: string
  unit_price_eur: number
  unit: string
  available_qty: number | null
  images: string[]
  status: string
  visibility: string
  views_count: number
  quotes_requested_count: number
  updated_at: string
}

const C = { bg: '#0A0E1A', card: '#0F172A', border: 'rgba(96,165,250,.2)', accent: '#60A5FA', text: '#E2E8F0', muted: '#64748B', green: '#10B981', red: '#EF4444' }

export default function SellerProductsPage() {
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/seller/products').then(r => r.json()).then(d => {
      if (d.ok) setItems(d.items)
      else setError(d.error || 'Erreur')
      setLoading(false)
    }).catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('Archiver ce produit ?')) return
    const r = await fetch(`/api/seller/products/${id}`, { method: 'DELETE' })
    const d = await r.json()
    if (d.ok) setItems(items.filter(p => p.id !== id))
  }

  async function togglePublish(p: Product) {
    const newStatus = p.status === 'active' ? 'draft' : 'active'
    const r = await fetch(`/api/seller/products/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, visibility: newStatus === 'active' ? 'public' : 'private' }),
    })
    const d = await r.json()
    if (d.ok) setItems(items.map(x => x.id === p.id ? { ...x, status: newStatus, visibility: newStatus === 'active' ? 'public' : 'private' } : x))
  }

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Mes produits export</h1>
            <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0' }}>Catalogue B2B — visible par acheteurs vérifiés via les opportunités FTG.</p>
          </div>
          <Link href="/seller/products/new" style={{ background: C.accent, color: '#0A0E1A', padding: '10px 18px', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>+ Ajouter un produit</Link>
        </div>

        {loading && <div style={{ color: C.muted }}>Chargement…</div>}
        {error && <div style={{ color: C.red, padding: 12, border: `1px solid ${C.red}`, marginBottom: 16 }}>Erreur : {error}</div>}
        {!loading && items.length === 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 32, textAlign: 'center' }}>
            <p style={{ color: C.muted }}>Aucun produit pour l'instant.</p>
            <Link href="/seller/products/new" style={{ color: C.accent, fontWeight: 700 }}>Créer ton premier produit →</Link>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {items.map(p => (
            <div key={p.id} style={{ background: C.card, border: `1px solid ${C.border}`, padding: 16 }}>
              {p.images?.[0] && <img src={p.images[0]} alt={p.title} style={{ width: '100%', height: 160, objectFit: 'cover', marginBottom: 10 }} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, padding: '2px 8px', background: p.status === 'active' ? C.green : C.muted, color: '#0A0E1A', fontWeight: 700 }}>{p.status}</span>
                <span style={{ fontSize: 10, color: C.muted }}>{p.visibility}</span>
              </div>
              <h3 style={{ margin: '4px 0 8px', fontSize: 15, fontWeight: 700 }}>{p.title}</h3>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
                {p.origin_country} · {p.unit_price_eur}€/{p.unit} · stock {p.available_qty ?? '?'}{p.unit}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
                👁 {p.views_count} vues · 💬 {p.quotes_requested_count} devis demandés
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link href={`/seller/products/${p.id}`} style={{ flex: 1, padding: '6px 10px', border: `1px solid ${C.border}`, color: C.text, textDecoration: 'none', fontSize: 12, textAlign: 'center' }}>Détail</Link>
                <button onClick={() => togglePublish(p)} style={{ flex: 1, padding: '6px 10px', background: 'transparent', border: `1px solid ${C.accent}`, color: C.accent, fontSize: 12, cursor: 'pointer' }}>{p.status === 'active' ? 'Dépublier' : 'Publier'}</button>
                <button onClick={() => handleDelete(p.id)} style={{ padding: '6px 10px', background: 'transparent', border: `1px solid ${C.red}`, color: C.red, fontSize: 12, cursor: 'pointer' }}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
