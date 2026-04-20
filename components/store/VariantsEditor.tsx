'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { centsToEuros, eurosToCents } from './_utils'

export interface OptionInput {
  id?: string
  name: string
  position: number
  values: string[]
}

export interface VariantInput {
  id?: string
  sku: string
  ean: string
  option_values: Record<string, string>
  price_b2c_ttc_cents: number | null
  price_b2b_ht_cents: number | null
  stock_qty: number
  weight_g: number | null
  position: number
  active: boolean
}

interface Props {
  productId: string
  initialOptions: OptionInput[]
  initialVariants: VariantInput[]
}

export function VariantsEditor({ productId, initialOptions, initialVariants }: Props) {
  const router = useRouter()
  const [opts, setOpts] = useState<OptionInput[]>(initialOptions)
  const [vars, setVars] = useState<VariantInput[]>(initialVariants)
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  function addOption() {
    setOpts(prev => [...prev, { name: '', position: prev.length, values: [] }])
  }
  function updateOption(idx: number, patch: Partial<OptionInput>) {
    setOpts(prev => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)))
  }
  function removeOption(idx: number) {
    setOpts(prev => prev.filter((_, i) => i !== idx))
  }

  function addVariant() {
    setVars(prev => [
      ...prev,
      {
        sku: '', ean: '',
        option_values: {},
        price_b2c_ttc_cents: null,
        price_b2b_ht_cents: null,
        stock_qty: 0,
        weight_g: null,
        position: prev.length,
        active: true,
      },
    ])
  }
  function updateVariant(idx: number, patch: Partial<VariantInput>) {
    setVars(prev => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)))
  }
  function removeVariant(idx: number) {
    setVars(prev => prev.filter((_, i) => i !== idx))
  }

  async function save() {
    setErr(null); setOk(false)
    // Validate options
    for (const o of opts) {
      if (!o.name.trim()) { setErr('Toutes les options doivent avoir un nom.'); return }
    }
    startTransition(async () => {
      try {
        const r = await fetch(`/api/store/products/${productId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            options: opts.map(o => ({ id: o.id, name: o.name.trim(), position: o.position, values: o.values.filter(Boolean) })),
            variants: vars.map(v => ({
              id: v.id,
              sku: v.sku.trim() || null,
              ean: v.ean.trim() || null,
              option_values: v.option_values,
              price_b2c_ttc_cents: v.price_b2c_ttc_cents,
              price_b2b_ht_cents: v.price_b2b_ht_cents,
              stock_qty: v.stock_qty,
              weight_g: v.weight_g,
              position: v.position,
              active: v.active,
            })),
          }),
        })
        const j = await r.json()
        if (!r.ok || j.error) {
          setErr(j.message ?? j.error ?? 'Erreur.')
          return
        }
        setOk(true)
        router.refresh()
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'R\u00e9seau indisponible.')
      }
    })
  }

  return (
    <div className="space-y-4">
      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300">{err}</div>}
      {ok && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-300">\u2713 Variantes enregistr\u00e9es.</div>}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase text-gray-500">Options</h3>
          <button onClick={addOption} type="button" className="text-xs text-[#C9A84C] hover:underline">+ Ajouter une option</button>
        </div>
        {opts.map((o, idx) => (
          <div key={idx} className="grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3 sm:grid-cols-[1fr_2fr_auto]">
            <input
              value={o.name}
              onChange={e => updateOption(idx, { name: e.target.value })}
              placeholder="Nom (ex. Taille)"
              className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
            />
            <input
              value={o.values.join(', ')}
              onChange={e => updateOption(idx, { values: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              placeholder="Valeurs s\u00e9par\u00e9es par virgule (ex. S, M, L)"
              className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
            />
            <button onClick={() => removeOption(idx)} type="button" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 hover:bg-red-500/20">
              Suppr.
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase text-gray-500">Variantes</h3>
          <button onClick={addVariant} type="button" className="text-xs text-[#C9A84C] hover:underline">+ Ajouter une variante</button>
        </div>
        {vars.map((v, idx) => (
          <div key={idx} className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="grid gap-2 sm:grid-cols-4">
              <input
                value={v.sku}
                onChange={e => updateVariant(idx, { sku: e.target.value })}
                placeholder="SKU"
                className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
              />
              <input
                value={v.ean}
                onChange={e => updateVariant(idx, { ean: e.target.value })}
                placeholder="EAN"
                className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
              />
              <input
                value={centsToEuros(v.price_b2c_ttc_cents)}
                onChange={e => updateVariant(idx, { price_b2c_ttc_cents: e.target.value ? eurosToCents(e.target.value) : null })}
                placeholder="Prix B2C TTC (\u20ac)"
                inputMode="decimal"
                className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
              />
              <input
                value={centsToEuros(v.price_b2b_ht_cents)}
                onChange={e => updateVariant(idx, { price_b2b_ht_cents: e.target.value ? eurosToCents(e.target.value) : null })}
                placeholder="Prix B2B HT (\u20ac)"
                inputMode="decimal"
                className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {opts.map(o => (
                <select
                  key={o.name}
                  value={v.option_values[o.name] ?? ''}
                  onChange={e => updateVariant(idx, { option_values: { ...v.option_values, [o.name]: e.target.value } })}
                  className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
                >
                  <option value="">{o.name || 'option'}\u2026</option>
                  {o.values.map(val => <option key={val} value={val}>{val}</option>)}
                </select>
              ))}
              <input
                type="number"
                value={v.stock_qty}
                onChange={e => updateVariant(idx, { stock_qty: Number(e.target.value) })}
                placeholder="Stock"
                className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
              />
              <input
                type="number"
                value={v.weight_g ?? ''}
                onChange={e => updateVariant(idx, { weight_g: e.target.value ? Number(e.target.value) : null })}
                placeholder="Poids (g)"
                className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" checked={v.active} onChange={e => updateVariant(idx, { active: e.target.checked })} />
                Active
              </label>
              <button onClick={() => removeVariant(idx)} type="button" className="text-xs text-red-400 hover:underline">
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={pending}
          type="button"
          className="rounded-xl bg-[#C9A84C] px-5 py-2 text-xs font-bold text-[#07090F] hover:bg-[#E8C97A] disabled:opacity-50"
        >
          {pending ? 'Sauvegarde\u2026' : 'Enregistrer options & variantes'}
        </button>
      </div>
    </div>
  )
}
