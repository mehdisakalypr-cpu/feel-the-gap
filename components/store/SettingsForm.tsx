'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface BillingEntity {
  legal_name?: string
  vat_number?: string
  siren?: string
  email?: string
  phone?: string
  address?: string
}

interface Initial {
  name: string
  mode_b2b: boolean
  mode_b2c: boolean
  primary_color: string
  custom_domain: string
  twofa_enabled: boolean
  billing_entity: Record<string, unknown>
}

export function SettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(initial.name)
  const [b2b, setB2b] = useState(initial.mode_b2b)
  const [b2c, setB2c] = useState(initial.mode_b2c)
  const [color, setColor] = useState(initial.primary_color)
  const [domain, setDomain] = useState(initial.custom_domain)
  const [twofa, setTwofa] = useState(initial.twofa_enabled)
  const [be, setBe] = useState<BillingEntity>(() => ({
    legal_name: typeof initial.billing_entity?.legal_name === 'string' ? initial.billing_entity.legal_name : '',
    vat_number: typeof initial.billing_entity?.vat_number === 'string' ? initial.billing_entity.vat_number : '',
    siren:      typeof initial.billing_entity?.siren === 'string' ? initial.billing_entity.siren : '',
    email:      typeof initial.billing_entity?.email === 'string' ? initial.billing_entity.email : '',
    phone:      typeof initial.billing_entity?.phone === 'string' ? initial.billing_entity.phone : '',
    address:    typeof initial.billing_entity?.address === 'string' ? initial.billing_entity.address : '',
  }))
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  function patch(field: keyof BillingEntity, value: string) {
    setBe(prev => ({ ...prev, [field]: value }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setOk(false)
    if (!b2b && !b2c) { setErr('Choisissez au moins un mode (B2B ou B2C).'); return }
    startTransition(async () => {
      try {
        const r = await fetch('/api/store/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            mode_b2b: b2b,
            mode_b2c: b2c,
            primary_color: color,
            custom_domain: domain.trim() || null,
            twofa_enabled: twofa,
            billing_entity: be,
          }),
        })
        const j = await r.json()
        if (!r.ok || j.error) {
          setErr(j.message ?? j.error ?? 'Erreur.')
        } else {
          setOk(true)
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
      {ok && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">\u2713 Param\u00e8tres enregistr\u00e9s.</div>}

      <section className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">G\u00e9n\u00e9ral</h2>
        <Field label="Nom de la boutique">
          <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
            <input type="checkbox" checked={b2c} onChange={e => setB2c(e.target.checked)} className="mt-1" />
            <div>
              <div className="text-sm font-semibold text-white">B2C</div>
              <div className="text-xs text-gray-400">Vente aux particuliers (TTC).</div>
            </div>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
            <input type="checkbox" checked={b2b} onChange={e => setB2b(e.target.checked)} className="mt-1" />
            <div>
              <div className="text-sm font-semibold text-white">B2B</div>
              <div className="text-xs text-gray-400">Vente aux professionnels (HT).</div>
            </div>
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Branding</h2>
        <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
          <Field label="Couleur principale">
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-[#111827]" />
          </Field>
          <Field label="Domaine personnalis\u00e9">
            <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="boutique.exemple.fr" className={inputCls} />
          </Field>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Entit\u00e9 de facturation</h2>
        <p className="text-xs text-gray-500">Ces informations figurent sur les factures \u00e9mises aux acheteurs.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Raison sociale">
            <input value={be.legal_name ?? ''} onChange={e => patch('legal_name', e.target.value)} className={inputCls} />
          </Field>
          <Field label="N\u00b0 TVA intracommunautaire">
            <input value={be.vat_number ?? ''} onChange={e => patch('vat_number', e.target.value)} placeholder="FR12345678901" className={inputCls} />
          </Field>
          <Field label="SIREN">
            <input value={be.siren ?? ''} onChange={e => patch('siren', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Email facturation">
            <input value={be.email ?? ''} onChange={e => patch('email', e.target.value)} type="email" className={inputCls} />
          </Field>
          <Field label="T\u00e9l\u00e9phone">
            <input value={be.phone ?? ''} onChange={e => patch('phone', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Adresse postale">
            <input value={be.address ?? ''} onChange={e => patch('address', e.target.value)} className={inputCls} />
          </Field>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">S\u00e9curit\u00e9</h2>
        <label className="flex items-start gap-2 rounded-lg bg-white/5 p-3">
          <input type="checkbox" checked={twofa} onChange={e => setTwofa(e.target.checked)} className="mt-1" />
          <div>
            <div className="text-sm font-semibold text-white">Activer l&apos;authentification \u00e0 deux facteurs (2FA)</div>
            <div className="text-xs text-gray-400">
              Requise pour activer la boutique au-del\u00e0 d&apos;un certain quota de commandes.
              Configurez ensuite votre 2FA dans <span className="font-mono text-gray-500">Mon compte</span>.
            </div>
          </div>
        </label>
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="rounded-xl bg-[#C9A84C] px-6 py-2.5 text-sm font-bold text-[#07090F] hover:bg-[#E8C97A] disabled:opacity-50">
          {pending ? 'Enregistrement\u2026' : 'Enregistrer les param\u00e8tres'}
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
