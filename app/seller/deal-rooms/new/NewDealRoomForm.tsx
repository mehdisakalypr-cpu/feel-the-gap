'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function NewDealRoomForm({ defaultEmail }: { defaultEmail: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [publish, setPublish] = useState(true)

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true); setError(null)
    const f = new FormData(e.currentTarget)
    const payload = {
      title: String(f.get('title') ?? '').trim(),
      summary: String(f.get('summary') ?? '').trim() || undefined,
      product_label: String(f.get('product_label') ?? '').trim() || undefined,
      country_iso: String(f.get('country_iso') ?? '').trim() || undefined,
      archetype: String(f.get('archetype') ?? '').trim() || undefined,
      hero_image_url: String(f.get('hero_image_url') ?? '').trim() || undefined,
      moq: String(f.get('moq') ?? '').trim() || undefined,
      lead_time_days: f.get('lead_time_days') ? Number(f.get('lead_time_days')) : undefined,
      incoterms: String(f.get('incoterms') ?? '').split(',').map(s => s.trim()).filter(Boolean),
      certifications: String(f.get('certifications') ?? '').split(',').map(s => s.trim()).filter(Boolean),
      price_range: {
        min: f.get('price_min') ? Number(f.get('price_min')) : undefined,
        max: f.get('price_max') ? Number(f.get('price_max')) : undefined,
        currency: String(f.get('currency') ?? 'EUR'),
        unit: String(f.get('unit') ?? '').trim() || undefined,
      },
      cta_whatsapp: String(f.get('cta_whatsapp') ?? '').trim() || undefined,
      cta_email: String(f.get('cta_email') ?? '').trim() || undefined,
      cta_phone: String(f.get('cta_phone') ?? '').trim() || undefined,
      publish,
    }
    try {
      const res = await fetch('/api/deal-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError((j as { error?: string }).error ?? 'create_failed'); return }
      const slug = (j as { slug?: string }).slug
      if (publish && slug) {
        router.push(`/deal/${slug}`)
      } else {
        router.push('/seller/deal-rooms')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network_error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <Section title="Identité">
        <Field name="title" label="Titre" required placeholder="Ex. Oignons rouges — Ferme Aïssata (CIV)" />
        <Area name="summary" label="Résumé (2-3 phrases)" rows={3} />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field name="product_label" label="Produit" placeholder="Oignon rouge" />
          <Field name="country_iso" label="Pays (ISO-3)" maxLength={3} placeholder="CIV" />
          <Field name="archetype" label="Archétype" placeholder="farmer | trader | …" />
        </div>
        <Field name="hero_image_url" label="Image hero (URL)" type="url" placeholder="https://…" />
      </Section>

      <Section title="Prix & commercial">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Field name="price_min" label="Prix min" type="number" />
          <Field name="price_max" label="Prix max" type="number" />
          <Field name="currency" label="Devise" defaultValue="EUR" maxLength={3} />
          <Field name="unit" label="Unité" placeholder="tonne, kg, …" />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field name="moq" label="Quantité minimum (MOQ)" placeholder="1 tonne" />
          <Field name="lead_time_days" label="Délai (jours)" type="number" />
        </div>
        <Field name="incoterms" label="Incoterms (virgules)" placeholder="FOB, CIF, EXW" />
        <Field name="certifications" label="Certifications (virgules)" placeholder="Bio, Fairtrade, …" />
      </Section>

      <Section title="Contact">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field name="cta_whatsapp" label="WhatsApp (E.164)" placeholder="+225 07 00 00 00 00" />
          <Field name="cta_email" label="Email de contact" type="email" defaultValue={defaultEmail} />
          <Field name="cta_phone" label="Téléphone" type="tel" />
        </div>
      </Section>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={publish} onChange={e => setPublish(e.target.checked)} />
        Publier immédiatement (décochez pour garder en brouillon)
      </label>

      {error && <p className="text-xs text-red-300">Erreur : {error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-[#C9A84C] px-5 py-3 text-sm font-semibold text-[#07090F] hover:bg-[#d6b658] disabled:opacity-60"
      >
        {busy ? 'Création…' : publish ? 'Créer et publier' : 'Créer (brouillon)'}
      </button>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <legend className="px-2 text-xs uppercase tracking-widest text-neutral-400">{title}</legend>
      <div className="space-y-3">{children}</div>
    </fieldset>
  )
}

function Field({ name, label, type = 'text', required, maxLength, placeholder, defaultValue }: {
  name: string; label: string; type?: string; required?: boolean; maxLength?: number; placeholder?: string; defaultValue?: string
}) {
  return (
    <label className="block text-xs text-neutral-400">
      {label}{required && <span className="text-red-400"> *</span>}
      <input
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100 outline-none focus:border-[#C9A84C]/50"
      />
    </label>
  )
}

function Area({ name, label, rows = 3 }: { name: string; label: string; rows?: number }) {
  return (
    <label className="block text-xs text-neutral-400">
      {label}
      <textarea
        name={name}
        rows={rows}
        className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100 outline-none focus:border-[#C9A84C]/50"
      />
    </label>
  )
}
