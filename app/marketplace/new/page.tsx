'use client'

/**
 * /marketplace/new?kind=volume|demand — formulaire unifié
 *
 * - kind=volume : producteur déclare sa production (pays, produit, qty, qualité, certs, floor price, window, incoterm)
 * - kind=demand : acheteur publie sa demande (produit, qty min/max, qualité, certs requises, ceiling price, incoterm, origin whitelist, deadline)
 *
 * Auth obligatoire (RLS owner-rw). Redirige vers /auth/login si anonyme.
 */

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Topbar from '@/components/Topbar'
import { supabase } from '@/lib/supabase'

const PRODUCT_PRESETS: Array<{ slug: string; label: string }> = [
  { slug: 'cafe', label: 'Café' },
  { slug: 'cacao', label: 'Cacao' },
  { slug: 'textile', label: 'Textile coton' },
  { slug: 'anacarde', label: 'Anacarde (noix de cajou)' },
  { slug: 'huile_palme', label: 'Huile de palme' },
  { slug: 'mangue', label: 'Mangue' },
]

const QUALITY_OPTIONS = ['specialty', 'premium', 'grade_1', 'standard', 'grade_2', 'commercial', 'basic']
const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']
const CERT_PRESETS = ['organic', 'fairtrade', 'rainforest_alliance', 'utz', 'iso9001', 'iso22000', 'halal', 'kosher', 'brc', 'global_gap']

function NewInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialKind = (searchParams.get('kind') === 'demand' ? 'demand' : 'volume') as 'volume' | 'demand'

  const [kind, setKind] = useState<'volume' | 'demand'>(initialKind)
  const [userId, setUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fields — unified, branch on kind server-side
  const [countryIso, setCountryIso] = useState('')
  const [productSlug, setProductSlug] = useState(PRODUCT_PRESETS[0].slug)
  const [productLabel, setProductLabel] = useState(PRODUCT_PRESETS[0].label)
  const [quantityKg, setQuantityKg] = useState<string>('')
  const [quantityKgMax, setQuantityKgMax] = useState<string>('')
  const [qualityGrade, setQualityGrade] = useState<string>('standard')
  const [certifications, setCertifications] = useState<string[]>([])
  const [floorPrice, setFloorPrice] = useState<string>('')
  const [ceilingPrice, setCeilingPrice] = useState<string>('')
  const [incoterm, setIncoterm] = useState<string>('FOB')
  const [availableFrom, setAvailableFrom] = useState<string>('')
  const [availableUntil, setAvailableUntil] = useState<string>('')
  const [deadline, setDeadline] = useState<string>('')
  const [deliveryCountry, setDeliveryCountry] = useState<string>('')
  const [originWhitelist, setOriginWhitelist] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      setUserId(data?.user?.id ?? null)
      setAuthChecked(true)
    })()
  }, [])

  useEffect(() => {
    const preset = PRODUCT_PRESETS.find((p) => p.slug === productSlug)
    if (preset) setProductLabel(preset.label)
  }, [productSlug])

  const toggleCert = (c: string) => {
    setCertifications((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)

    try {
      if (!userId) {
        router.push('/auth/login?redirect=/marketplace/new')
        return
      }
      if (kind === 'volume') {
        if (!countryIso.trim()) throw new Error("Pays d'origine requis (ex: CIV)")
        if (!quantityKg || Number(quantityKg) <= 0) throw new Error('Quantité (kg) requise')

        const { error: insErr } = await supabase.from('production_volumes').insert({
          producer_id: userId,
          country_iso: countryIso.trim().toUpperCase(),
          product_slug: productSlug,
          product_label: productLabel,
          quantity_kg: Number(quantityKg),
          quality_grade: qualityGrade,
          certifications,
          floor_price_eur_per_kg: floorPrice ? Number(floorPrice) : null,
          incoterm,
          available_from: availableFrom || null,
          available_until: availableUntil || null,
          notes: notes || null,
        })
        if (insErr) throw insErr
      } else {
        if (!quantityKg || Number(quantityKg) <= 0) throw new Error('Quantité minimum (kg) requise')

        const wl = originWhitelist
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)

        const { error: insErr } = await supabase.from('buyer_demands').insert({
          buyer_id: userId,
          product_slug: productSlug,
          product_label: productLabel,
          quantity_kg_min: Number(quantityKg),
          quantity_kg_max: quantityKgMax ? Number(quantityKgMax) : null,
          quality_grade: qualityGrade,
          required_certifications: certifications,
          ceiling_price_eur_per_kg: ceilingPrice ? Number(ceilingPrice) : null,
          incoterm: incoterm || null,
          origin_country_whitelist: wl,
          delivery_country_iso: deliveryCountry.trim().toUpperCase() || null,
          deadline: deadline || null,
          notes: notes || null,
        })
        if (insErr) throw insErr
      }

      router.push('/marketplace')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSubmitting(false)
    }
  }

  const title = useMemo(
    () => (kind === 'volume' ? 'Déclarer un volume de production' : 'Publier une demande d\'achat'),
    [kind]
  )

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-[#07090F] text-white">
        <Topbar />
        <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
          <h1 className="text-2xl font-bold">Connexion requise</h1>
          <p className="text-sm text-gray-400">Pour publier sur le marketplace, connecte-toi à ton compte FTG.</p>
          <Link href="/auth/login?redirect=/marketplace/new" className="inline-flex px-5 py-3 bg-[#C9A84C] text-[#07090F] font-bold text-sm rounded-xl">
            Se connecter
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <Topbar />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/marketplace" className="text-xs text-gray-400 hover:text-white">← Marketplace</Link>
        <h1 className="text-2xl md:text-3xl font-bold mt-2 mb-6">{title}</h1>

        {/* Kind toggle */}
        <div className="inline-flex rounded-xl bg-[#0D1117] border border-white/10 p-1 mb-6">
          <button
            type="button"
            onClick={() => setKind('volume')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              kind === 'volume' ? 'bg-[#C9A84C] text-[#07090F]' : 'text-gray-400 hover:text-white'
            }`}
          >
            🌾 Volume producteur
          </button>
          <button
            type="button"
            onClick={() => setKind('demand')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              kind === 'demand' ? 'bg-emerald-500 text-[#07090F]' : 'text-gray-400 hover:text-white'
            }`}
          >
            🛒 Demande acheteur
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5">
          {kind === 'volume' && (
            <Field label="Pays d'origine (ISO3)" hint="Ex: CIV, GHA, SEN">
              <input
                type="text"
                value={countryIso}
                onChange={(e) => setCountryIso(e.target.value.toUpperCase())}
                maxLength={3}
                className="w-full uppercase bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#C9A84C] outline-none"
                required
              />
            </Field>
          )}

          <Field label="Produit">
            <select
              value={productSlug}
              onChange={(e) => setProductSlug(e.target.value)}
              className="w-full bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#C9A84C] outline-none"
            >
              {PRODUCT_PRESETS.map((p) => (
                <option key={p.slug} value={p.slug}>{p.label}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={kind === 'volume' ? 'Quantité disponible (kg)' : 'Quantité minimum (kg)'}>
              <input
                type="number"
                min={1}
                step={1}
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
                className="w-full bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#C9A84C] outline-none"
                required
              />
            </Field>
            {kind === 'demand' && (
              <Field label="Quantité maximum (kg, optionnel)">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={quantityKgMax}
                  onChange={(e) => setQuantityKgMax(e.target.value)}
                  className="w-full bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#C9A84C] outline-none"
                />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Qualité">
              <select
                value={qualityGrade}
                onChange={(e) => setQualityGrade(e.target.value)}
                className="w-full bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#C9A84C] outline-none"
              >
                {QUALITY_OPTIONS.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </Field>
            <Field label="Incoterm">
              <select
                value={incoterm}
                onChange={(e) => setIncoterm(e.target.value)}
                className="w-full bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#C9A84C] outline-none"
              >
                {INCOTERMS.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={kind === 'volume' ? 'Certifications détenues' : 'Certifications requises'}>
            <div className="flex flex-wrap gap-2">
              {CERT_PRESETS.map((c) => {
                const on = certifications.includes(c)
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCert(c)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      on
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {on ? '✓ ' : ''}{c}
                  </button>
                )
              })}
            </div>
          </Field>

          {kind === 'volume' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Prix plancher (€/kg, optionnel)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={floorPrice}
                  onChange={(e) => setFloorPrice(e.target.value)}
                  className="w-full bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#C9A84C] outline-none"
                />
              </Field>
              <Field label="Dispo à partir du">
                <input
                  type="date"
                  value={availableFrom}
                  onChange={(e) => setAvailableFrom(e.target.value)}
                  className="w-full bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#C9A84C] outline-none"
                />
              </Field>
              <Field label="Dispo jusqu'au">
                <input
                  type="date"
                  value={availableUntil}
                  onChange={(e) => setAvailableUntil(e.target.value)}
                  className="w-full bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#C9A84C] outline-none"
                />
              </Field>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Prix plafond (€/kg, optionnel)">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={ceilingPrice}
                    onChange={(e) => setCeilingPrice(e.target.value)}
                    className="w-full bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#C9A84C] outline-none"
                  />
                </Field>
                <Field label="Échéance (deadline)">
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#C9A84C] outline-none"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Pays de livraison (ISO3)" hint="Ex: FRA, DEU">
                  <input
                    type="text"
                    value={deliveryCountry}
                    onChange={(e) => setDeliveryCountry(e.target.value.toUpperCase())}
                    maxLength={3}
                    className="w-full uppercase bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#C9A84C] outline-none"
                  />
                </Field>
                <Field label="Origines acceptées (ISO3, séparés par virgule)" hint="Vide = toutes origines">
                  <input
                    type="text"
                    value={originWhitelist}
                    onChange={(e) => setOriginWhitelist(e.target.value)}
                    className="w-full uppercase bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#C9A84C] outline-none"
                    placeholder="CIV, GHA, PER"
                  />
                </Field>
              </div>
            </>
          )}

          <Field label="Notes (optionnel)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#C9A84C] outline-none resize-y"
            />
          </Field>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/5">
            <Link href="/marketplace" className="text-sm text-gray-400 hover:text-white">
              Annuler
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className={`px-6 py-3 font-bold text-sm rounded-xl transition-colors ${
                kind === 'volume'
                  ? 'bg-[#C9A84C] text-[#07090F] hover:bg-[#E8C97A]'
                  : 'bg-emerald-500 text-[#07090F] hover:bg-emerald-400'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {submitting
                ? 'Envoi…'
                : kind === 'volume'
                  ? 'Publier le volume'
                  : 'Publier la demande'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-gray-300">{label}</span>
        {hint && <span className="text-[10px] text-gray-500">{hint}</span>}
      </div>
      {children}
    </label>
  )
}

export default function MarketplaceNewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07090F] flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" /></div>}>
      <NewInner />
    </Suspense>
  )
}
