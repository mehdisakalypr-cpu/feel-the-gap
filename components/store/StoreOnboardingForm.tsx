'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  ownerEmail: string
}

const SLUG_RE = /^[a-z0-9-]{3,40}$/

export function StoreOnboardingForm({ ownerEmail }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [b2c, setB2c] = useState(true)
  const [b2b, setB2b] = useState(false)
  const [cgv, setCgv] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function autoSlug(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!name.trim()) { setErr('Le nom est obligatoire.'); return }
    if (!SLUG_RE.test(slug)) { setErr('Slug invalide (3-40 caract\u00e8res, a-z, 0-9, tirets).'); return }
    if (!b2b && !b2c) { setErr('Choisissez au moins un mode de vente (B2B ou B2C).'); return }
    if (!cgv) { setErr('Vous devez accepter les CGV FTG.'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/store/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          create: true,
          name: name.trim(),
          slug,
          mode_b2b: b2b,
          mode_b2c: b2c,
          cgv_signed: true,
          billing_entity: { email: ownerEmail },
        }),
      })
      const j = await res.json()
      if (!res.ok || j.error) {
        setErr(j.message ?? j.error ?? 'Erreur lors de la cr\u00e9ation.')
        setSubmitting(false)
        return
      }
      router.refresh()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'R\u00e9seau indisponible.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-white/10 bg-[#0D1117] p-6">
      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {err}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Nom de la boutique
          </label>
          <input
            value={name}
            onChange={e => {
              setName(e.target.value)
              if (!slug) setSlug(autoSlug(e.target.value))
            }}
            required
            placeholder="Ex. La Ferme du Mont d&apos;Or"
            className="w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#C9A84C] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Slug (URL boutique)
          </label>
          <div className="flex items-center gap-1">
            <span className="rounded-l-xl border border-white/10 border-r-0 bg-white/5 px-3 py-2.5 text-xs text-gray-500">
              /store/
            </span>
            <input
              value={slug}
              onChange={e => setSlug(autoSlug(e.target.value))}
              required
              placeholder="ma-boutique"
              className="w-full rounded-r-xl border border-white/10 bg-[#111827] px-4 py-2.5 font-mono text-sm text-white placeholder-gray-600 focus:border-[#C9A84C] focus:outline-none"
            />
          </div>
          <p className="mt-1 text-[10px] text-gray-500">
            3-40 caract\u00e8res, lettres min., chiffres et tirets.
          </p>
        </div>
      </div>

      <fieldset className="rounded-xl border border-white/10 p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Modes de vente
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-white/5 p-3">
            <input type="checkbox" checked={b2c} onChange={e => setB2c(e.target.checked)} className="mt-1" />
            <div>
              <div className="text-sm font-semibold text-white">B2C</div>
              <div className="text-xs text-gray-400">Vente aux particuliers (TTC).</div>
            </div>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-white/5 p-3">
            <input type="checkbox" checked={b2b} onChange={e => setB2b(e.target.checked)} className="mt-1" />
            <div>
              <div className="text-sm font-semibold text-white">B2B</div>
              <div className="text-xs text-gray-400">Vente aux professionnels (HT).</div>
            </div>
          </label>
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <input type="checkbox" checked={cgv} onChange={e => setCgv(e.target.checked)} className="mt-1" />
        <div className="text-sm">
          <div className="font-semibold text-white">J&apos;accepte les CGV vendeur Feel The Gap</div>
          <div className="text-xs text-gray-400 mt-0.5">
            Les <a className="text-[#C9A84C] underline-offset-2 hover:underline" href="/legal/cgv-vendeur" target="_blank" rel="noopener noreferrer">CGV vendeur FTG</a> r\u00e9gissent l&apos;usage de la plateforme. Vous restez le marchand de vos ventes.
          </div>
        </div>
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-[#C9A84C] px-6 py-2.5 text-sm font-bold text-[#07090F] transition-colors hover:bg-[#E8C97A] disabled:opacity-50"
        >
          {submitting ? 'Cr\u00e9ation\u2026' : 'Cr\u00e9er ma boutique'}
        </button>
      </div>
    </form>
  )
}
