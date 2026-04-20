'use client'

/**
 * /marketplace/rfq/new — formulaire création RFQ
 */

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function RfqNewPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    product_slug: '',
    product_label: '',
    qty_min: '',
    qty_max: '',
    qty_unit: 'tonnes',
    target_price_eur_per_unit: '',
    required_certifications: '',
    delivery_country_iso: '',
    delivery_deadline: '',
    description: '',
  })

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        product_slug: form.product_slug.trim(),
        product_label: form.product_label.trim() || null,
        qty_min: form.qty_min ? Number(form.qty_min) : null,
        qty_max: form.qty_max ? Number(form.qty_max) : null,
        qty_unit: form.qty_unit,
        target_price_eur_per_unit: form.target_price_eur_per_unit ? Number(form.target_price_eur_per_unit) : null,
        required_certifications: form.required_certifications
          .split(',').map((s) => s.trim()).filter(Boolean),
        delivery_country_iso: form.delivery_country_iso.trim() || null,
        delivery_deadline: form.delivery_deadline || null,
        description: form.description.trim() || null,
      }
      const res = await fetch('/api/marketplace/rfq', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Échec création RFQ')
      } else {
        router.push(`/marketplace/rfq/${json.id}`)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div>
          <div className="text-xs uppercase tracking-wider text-[#C9A84C]">Marketplace · Nouvelle RFQ</div>
          <h1 className="text-2xl font-bold">Publier un appel d'offres</h1>
          <p className="text-sm text-gray-400">
            Décrivez votre besoin, nous le diffusons à tous les producteurs matching (max 50).
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Produit (slug, ex. coffee-arabica) *">
            <input
              required
              value={form.product_slug}
              onChange={(e) => update('product_slug', e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Libellé produit">
            <input
              value={form.product_label}
              onChange={(e) => update('product_label', e.target.value)}
              className="input"
              placeholder="Café Arabica grade A"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Quantité min">
              <input type="number" step="0.001" min="0" value={form.qty_min}
                onChange={(e) => update('qty_min', e.target.value)} className="input" />
            </Field>
            <Field label="Quantité max">
              <input type="number" step="0.001" min="0" value={form.qty_max}
                onChange={(e) => update('qty_max', e.target.value)} className="input" />
            </Field>
            <Field label="Unité">
              <select value={form.qty_unit} onChange={(e) => update('qty_unit', e.target.value)} className="input">
                <option value="tonnes">tonnes</option>
                <option value="kg">kg</option>
                <option value="containers">containers</option>
                <option value="units">unités</option>
              </select>
            </Field>
          </div>
          <Field label="Prix cible (€/unité)">
            <input type="number" step="0.01" min="0" value={form.target_price_eur_per_unit}
              onChange={(e) => update('target_price_eur_per_unit', e.target.value)} className="input" />
          </Field>
          <Field label="Certifications requises (séparées par virgule)">
            <input value={form.required_certifications}
              onChange={(e) => update('required_certifications', e.target.value)}
              className="input"
              placeholder="organic, fair-trade, rainforest-alliance" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pays de livraison (ISO2)">
              <input value={form.delivery_country_iso}
                onChange={(e) => update('delivery_country_iso', e.target.value.toUpperCase().slice(0, 2))}
                className="input" placeholder="FR" maxLength={2} />
            </Field>
            <Field label="Deadline livraison">
              <input type="date" value={form.delivery_deadline}
                onChange={(e) => update('delivery_deadline', e.target.value)} className="input" />
            </Field>
          </div>
          <Field label="Description / spécifications">
            <textarea value={form.description}
              onChange={(e) => update('description', e.target.value)}
              className="input min-h-[100px]" rows={4}
              placeholder="Conditionnement, qualité visée, contraintes logistiques…" />
          </Field>

          {error && (
            <div className="p-3 rounded-lg text-sm bg-red-500/10 border border-red-500/30 text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] disabled:opacity-50"
          >
            {submitting ? '...' : 'Publier la RFQ'}
          </button>
        </form>
      </div>
      <style jsx>{`
        .input {
          width: 100%;
          background: #07090F;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: white;
        }
        .input:focus { outline: none; border-color: rgba(201,168,76,.4); }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-400 mb-1">{label}</span>
      {children}
    </label>
  )
}
