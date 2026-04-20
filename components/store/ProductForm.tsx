'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { centsToEuros, eurosToCents } from './_utils'

export interface ProductFormValue {
  name: string
  description: string
  sku: string
  ean: string
  segment: 'b2c' | 'b2b' | 'both'
  packaging_type: 'unit' | 'weight' | 'volume'
  packaging_unit: string
  packaging_qty: string
  price_b2c_ttc_cents?: number | null
  price_b2b_ht_cents?: number | null
  vat_rate_pct: string
  stock_qty: string
  stock_low_alert: string
  stock_unlimited: boolean
  norms: string
  labels: string
  legal_docs: string
  visibility: 'draft' | 'active' | 'archived'
}

const DEFAULT: ProductFormValue = {
  name: '',
  description: '',
  sku: '',
  ean: '',
  segment: 'b2c',
  packaging_type: 'unit',
  packaging_unit: 'piece',
  packaging_qty: '1',
  price_b2c_ttc_cents: null,
  price_b2b_ht_cents: null,
  vat_rate_pct: '20',
  stock_qty: '0',
  stock_low_alert: '',
  stock_unlimited: false,
  norms: '',
  labels: '',
  legal_docs: '[]',
  visibility: 'draft',
}

interface Props {
  initial?: Partial<ProductFormValue>
  productId?: string
}

const PKG_UNITS: Record<string, string[]> = {
  unit: ['piece', 'pack', 'set'],
  weight: ['g', 'kg', 't'],
  volume: ['ml', 'l', 'm3'],
}

export function ProductForm({ initial, productId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [v, setV] = useState<ProductFormValue>(() => ({
    ...DEFAULT,
    ...(initial ?? {}),
    packaging_qty: initial?.packaging_qty ?? DEFAULT.packaging_qty,
    stock_qty: initial?.stock_qty ?? DEFAULT.stock_qty,
    stock_low_alert: initial?.stock_low_alert ?? '',
    vat_rate_pct: initial?.vat_rate_pct ?? '20',
    norms: initial?.norms ?? '',
    labels: initial?.labels ?? '',
    legal_docs: initial?.legal_docs ?? '[]',
  }))
  const [b2cEur, setB2cEur] = useState(centsToEuros(initial?.price_b2c_ttc_cents ?? null))
  const [b2bEur, setB2bEur] = useState(centsToEuros(initial?.price_b2b_ht_cents ?? null))
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  function set<K extends keyof ProductFormValue>(k: K, value: ProductFormValue[K]) {
    setV(prev => ({ ...prev, [k]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setOk(false)
    if (!v.name.trim()) { setErr('Le nom est requis.'); return }
    if (v.segment !== 'b2b' && !b2cEur.trim()) { setErr('Prix B2C TTC requis.'); return }
    if (v.segment !== 'b2c' && !b2bEur.trim()) { setErr('Prix B2B HT requis.'); return }

    let legalDocs: unknown = []
    try {
      legalDocs = JSON.parse(v.legal_docs || '[]')
      if (!Array.isArray(legalDocs)) throw new Error('not_array')
    } catch {
      setErr('Documents l\u00e9gaux : JSON invalide (attendu tableau).'); return
    }

    const payload = {
      name: v.name.trim(),
      description: v.description.trim() || null,
      sku: v.sku.trim() || null,
      ean: v.ean.trim() || null,
      segment: v.segment,
      packaging_type: v.packaging_type,
      packaging_unit: v.packaging_unit,
      packaging_qty: Number(v.packaging_qty.replace(',', '.')) || 1,
      price_b2c_ttc_cents: v.segment === 'b2b' ? null : eurosToCents(b2cEur),
      price_b2b_ht_cents: v.segment === 'b2c' ? null : eurosToCents(b2bEur),
      vat_rate_pct: Number(v.vat_rate_pct.replace(',', '.')) || 0,
      stock_qty: v.stock_unlimited ? 0 : Number(v.stock_qty.replace(',', '.')) || 0,
      stock_low_alert: v.stock_low_alert ? Number(v.stock_low_alert.replace(',', '.')) : null,
      stock_unlimited: v.stock_unlimited,
      norms: v.norms.split(',').map(s => s.trim()).filter(Boolean),
      labels: v.labels.split(',').map(s => s.trim()).filter(Boolean),
      legal_docs: legalDocs,
      visibility: v.visibility,
    }

    startTransition(async () => {
      try {
        const url = productId ? `/api/store/products/${productId}` : '/api/store/products'
        const method = productId ? 'PATCH' : 'POST'
        const r = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const j = await r.json()
        if (!r.ok || j.error) {
          setErr(j.message ?? j.error ?? 'Erreur lors de l\u2019enregistrement.')
          return
        }
        setOk(true)
        if (!productId && j.id) {
          router.push(`/account/store/products/${j.id}`)
        } else {
          router.refresh()
        }
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'R\u00e9seau indisponible.')
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{err}</div>}
      {ok && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">\u2713 Enregistr\u00e9.</div>}

      <section className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">G\u00e9n\u00e9ral</h2>
        <Field label="Nom *">
          <input value={v.name} onChange={e => set('name', e.target.value)} required className={inputCls} />
        </Field>
        <Field label="Description">
          <textarea value={v.description} onChange={e => set('description', e.target.value)} rows={5} className={inputCls + ' resize-y'} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="SKU"><input value={v.sku} onChange={e => set('sku', e.target.value)} className={inputCls} /></Field>
          <Field label="EAN / GTIN"><input value={v.ean} onChange={e => set('ean', e.target.value)} className={inputCls} /></Field>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Conditionnement & prix</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Segment">
            <select value={v.segment} onChange={e => set('segment', e.target.value as ProductFormValue['segment'])} className={inputCls}>
              <option value="b2c">B2C</option>
              <option value="b2b">B2B</option>
              <option value="both">B2B + B2C</option>
            </select>
          </Field>
          <Field label="Type">
            <select
              value={v.packaging_type}
              onChange={e => {
                const t = e.target.value as 'unit' | 'weight' | 'volume'
                setV(p => ({ ...p, packaging_type: t, packaging_unit: PKG_UNITS[t][0] }))
              }}
              className={inputCls}
            >
              <option value="unit">Unit\u00e9</option>
              <option value="weight">Poids</option>
              <option value="volume">Volume</option>
            </select>
          </Field>
          <Field label="Unit\u00e9">
            <select value={v.packaging_unit} onChange={e => set('packaging_unit', e.target.value)} className={inputCls}>
              {PKG_UNITS[v.packaging_type].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Quantit\u00e9 par unit\u00e9">
            <input value={v.packaging_qty} onChange={e => set('packaging_qty', e.target.value)} inputMode="decimal" className={inputCls} />
          </Field>
          {v.segment !== 'b2b' && (
            <Field label="Prix B2C TTC (\u20ac) *">
              <input value={b2cEur} onChange={e => setB2cEur(e.target.value)} inputMode="decimal" required className={inputCls} />
            </Field>
          )}
          {v.segment !== 'b2c' && (
            <Field label="Prix B2B HT (\u20ac) *">
              <input value={b2bEur} onChange={e => setB2bEur(e.target.value)} inputMode="decimal" required className={inputCls} />
            </Field>
          )}
          <Field label="TVA (%)">
            <input value={v.vat_rate_pct} onChange={e => set('vat_rate_pct', e.target.value)} inputMode="decimal" className={inputCls} />
          </Field>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Stock</h2>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={v.stock_unlimited} onChange={e => set('stock_unlimited', e.target.checked)} />
          Stock illimit\u00e9 (service, num\u00e9rique\u2026)
        </label>
        {!v.stock_unlimited && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Stock initial">
              <input value={v.stock_qty} onChange={e => set('stock_qty', e.target.value)} inputMode="decimal" className={inputCls} />
            </Field>
            <Field label="Alerte stock faible">
              <input value={v.stock_low_alert} onChange={e => set('stock_low_alert', e.target.value)} inputMode="decimal" placeholder="vide = pas d&apos;alerte" className={inputCls} />
            </Field>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Conformit\u00e9 & l\u00e9gal</h2>
        <Field label="Normes (s\u00e9par\u00e9es par virgule)">
          <input value={v.norms} onChange={e => set('norms', e.target.value)} placeholder="CE, ISO9001, FDA" className={inputCls} />
        </Field>
        <Field label="Labels (s\u00e9par\u00e9s par virgule)">
          <input value={v.labels} onChange={e => set('labels', e.target.value)} placeholder="bio, AOP, halal" className={inputCls} />
        </Field>
        <Field label="Documents l\u00e9gaux (JSON: [&#123;name,url,mandatory&#125;])">
          <textarea value={v.legal_docs} onChange={e => set('legal_docs', e.target.value)} rows={3} className={inputCls + ' font-mono text-xs'} />
        </Field>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Visibilit\u00e9</h2>
        <Field label="Statut de publication">
          <select value={v.visibility} onChange={e => set('visibility', e.target.value as ProductFormValue['visibility'])} className={inputCls}>
            <option value="draft">Brouillon (non visible)</option>
            <option value="active">En ligne</option>
            <option value="archived">Archiv\u00e9</option>
          </select>
        </Field>
      </section>

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-[#C9A84C] px-6 py-2.5 text-sm font-bold text-[#07090F] transition-colors hover:bg-[#E8C97A] disabled:opacity-50"
        >
          {isPending ? 'Enregistrement\u2026' : (productId ? 'Mettre \u00e0 jour' : 'Cr\u00e9er le produit')}
        </button>
      </div>
    </form>
  )
}

const inputCls =
  'w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#C9A84C] focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</label>
      {children}
    </div>
  )
}
