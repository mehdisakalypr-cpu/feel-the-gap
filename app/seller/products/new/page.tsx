'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const C = { bg: '#0A0E1A', card: '#0F172A', border: 'rgba(96,165,250,.2)', accent: '#60A5FA', text: '#E2E8F0', muted: '#64748B', red: '#EF4444' }

const sb = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const UNITS = ['kg', 'ton', 'pallet', 'piece', 'box', 'liter']
const INCOTERMS = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF']

export default function NewProductPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string>('')
  const [uploading, setUploading] = useState(false)

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError(null)
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setError('Connexion requise'); setUploading(false); return }
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error: upErr } = await sb.storage.from('seller-products').upload(path, file, { cacheControl: '3600', upsert: false })
    if (upErr) { setError(upErr.message); setUploading(false); return }
    const { data: pub } = sb.storage.from('seller-products').getPublicUrl(path)
    setImageUrl(pub.publicUrl)
    setUploading(false)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true); setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = {
      title: fd.get('title'),
      description: fd.get('description'),
      hs_code: fd.get('hs_code'),
      origin_country: String(fd.get('origin_country')).toUpperCase(),
      origin_port: fd.get('origin_port'),
      unit_price_eur: Number(fd.get('unit_price_eur')),
      min_order_qty: fd.get('min_order_qty') ? Number(fd.get('min_order_qty')) : null,
      unit: fd.get('unit'),
      available_qty: fd.get('available_qty') ? Number(fd.get('available_qty')) : null,
      incoterm_preferred: fd.get('incoterm_preferred'),
      images: imageUrl ? [imageUrl] : [],
      status: fd.get('publish') === 'on' ? 'active' : 'draft',
      visibility: fd.get('publish') === 'on' ? 'public' : 'private',
    }
    const r = await fetch('/api/seller/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const d = await r.json()
    setSubmitting(false)
    if (d.ok) router.push(`/seller/products/${d.id}`)
    else setError(d.error || 'Erreur')
  }

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Ajouter un produit export</h1>
        <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>Décris ton produit pour qu'il soit visible par les acheteurs B2B internationaux.</p>

        <form onSubmit={handleSubmit} style={{ background: C.card, border: `1px solid ${C.border}`, padding: 20, display: 'grid', gap: 14 }}>
          <Field label="Nom du produit *" name="title" required minLength={3} placeholder="Ex: Cashew nuts W320 grade A" />
          <Field label="Description" name="description" textarea placeholder="Origine, qualité, certifications, conditionnement…" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Code SH (HS code)" name="hs_code" placeholder="Ex: 0801.32" />
            <Field label="Pays origine ISO3 *" name="origin_country" required minLength={3} maxLength={3} placeholder="Ex: CIV" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Port d'origine" name="origin_port" placeholder="Ex: Abidjan" />
            <Select label="Incoterm préféré" name="incoterm_preferred" options={INCOTERMS} defaultValue="FOB" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="Prix unitaire € *" name="unit_price_eur" type="number" step="0.01" required placeholder="2.50" />
            <Select label="Unité" name="unit" options={UNITS} defaultValue="kg" />
            <Field label="Stock dispo" name="available_qty" type="number" step="0.01" placeholder="5000" />
          </div>
          <Field label="Quantité minimum commande" name="min_order_qty" type="number" step="0.01" placeholder="100" />

          <div>
            <label style={{ display: 'block', fontSize: 12, color: C.muted, marginBottom: 6 }}>Image produit</label>
            <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} style={{ color: C.text, fontSize: 12 }} />
            {uploading && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Upload en cours…</div>}
            {imageUrl && <img src={imageUrl} alt="preview" style={{ maxWidth: 200, marginTop: 8 }} />}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" name="publish" /> Publier immédiatement (visible acheteurs)
          </label>

          {error && <div style={{ color: C.red, fontSize: 13 }}>{error}</div>}

          <button type="submit" disabled={submitting || uploading} style={{ background: C.accent, color: '#0A0E1A', padding: '12px 20px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
            {submitting ? 'Création…' : 'Créer le produit'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field(props: { label: string; name: string; required?: boolean; minLength?: number; maxLength?: number; type?: string; step?: string; placeholder?: string; textarea?: boolean }) {
  const common = {
    name: props.name, required: props.required, minLength: props.minLength, maxLength: props.maxLength,
    placeholder: props.placeholder,
    style: { width: '100%', background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit' },
  }
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: C.muted, marginBottom: 6 }}>{props.label}</label>
      {props.textarea
        ? <textarea {...common} rows={3} />
        : <input {...common} type={props.type ?? 'text'} step={props.step} />
      }
    </div>
  )
}

function Select(props: { label: string; name: string; options: string[]; defaultValue?: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: C.muted, marginBottom: 6 }}>{props.label}</label>
      <select name={props.name} defaultValue={props.defaultValue} style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: '10px 12px', fontSize: 13 }}>
        {props.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
