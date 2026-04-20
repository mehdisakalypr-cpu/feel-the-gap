// © 2025-2026 Feel The Gap — address book CRUD client component
'use client'

import { useState, useCallback, type FormEvent } from 'react'
import type { AddressDTO } from './page'

interface Props {
  slug: string
  initial: AddressDTO[]
}

const EMPTY: Omit<AddressDTO, 'id'> = {
  label: '',
  type: 'both',
  full_name: '',
  company: null,
  line1: '',
  line2: null,
  postal_code: '',
  city: '',
  state: null,
  country_iso2: 'FR',
  phone: null,
  is_default: false,
}

export function AddressManager({ slug, initial }: Props) {
  const [addresses, setAddresses] = useState<AddressDTO[]>(initial)
  const [editing, setEditing] = useState<AddressDTO | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const res = await fetch(`/api/store/${encodeURIComponent(slug)}/account/addresses`, { cache: 'no-store' })
    if (res.ok) {
      const j = await res.json() as { addresses?: AddressDTO[] }
      if (j.addresses) setAddresses(j.addresses)
    }
  }, [slug])

  const save = useCallback(async (form: Omit<AddressDTO, 'id'> & { id?: string }) => {
    setBusy(true); setError(null)
    try {
      const url = `/api/store/${encodeURIComponent(slug)}/account/addresses${form.id ? `/${form.id}` : ''}`
      const res = await fetch(url, {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) { setError(json?.error ?? 'Sauvegarde impossible'); return false }
      await reload()
      setEditing(null); setCreating(false)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau')
      return false
    } finally {
      setBusy(false)
    }
  }, [slug, reload])

  const remove = useCallback(async (id: string) => {
    if (!confirm('Supprimer cette adresse ?')) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/store/${encodeURIComponent(slug)}/account/addresses/${id}`, { method: 'DELETE' })
      if (!res.ok) { const j = await res.json().catch(() => null); setError((j as { error?: string } | null)?.error ?? 'Suppression impossible'); return }
      await reload()
    } finally { setBusy(false) }
  }, [slug, reload])

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {addresses.length === 0 && !creating ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#0D1117] p-8 text-center">
          <p className="text-sm text-gray-400">Aucune adresse enregistrée.</p>
          <button
            onClick={() => setCreating(true)}
            className="mt-3 rounded-xl bg-[#C9A84C] px-4 py-2 text-xs font-semibold text-[#07090F] hover:bg-[#E8C97A]"
          >
            + Ajouter une adresse
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {addresses.map(a => (
              <div key={a.id} className="rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117] p-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-white">{a.label || `${a.city}, ${a.country_iso2}`}</div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500">{labelType(a.type)}</div>
                  </div>
                  {a.is_default && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">Défaut</span>
                  )}
                </div>
                <div className="space-y-0.5 text-sm text-gray-300">
                  <div>{a.full_name}</div>
                  {a.company && <div className="text-gray-400">{a.company}</div>}
                  <div>{a.line1}</div>
                  {a.line2 && <div>{a.line2}</div>}
                  <div>{a.postal_code} {a.city}{a.state ? `, ${a.state}` : ''}</div>
                  <div>{a.country_iso2}</div>
                  {a.phone && <div className="text-xs text-gray-500">{a.phone}</div>}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setEditing(a)} disabled={busy} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10 disabled:opacity-60">
                    Modifier
                  </button>
                  <button onClick={() => remove(a.id)} disabled={busy} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20 disabled:opacity-60">
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!creating && !editing && (
            <button
              onClick={() => setCreating(true)}
              className="rounded-xl bg-[#C9A84C] px-5 py-2.5 text-sm font-semibold text-[#07090F] hover:bg-[#E8C97A]"
            >
              + Ajouter une adresse
            </button>
          )}
        </>
      )}

      {(creating || editing) && (
        <AddressFormModal
          initial={editing ?? { ...EMPTY, id: undefined }}
          busy={busy}
          onCancel={() => { setEditing(null); setCreating(false) }}
          onSave={save}
        />
      )}
    </div>
  )
}

function labelType(t: string): string {
  if (t === 'shipping') return 'Livraison'
  if (t === 'billing') return 'Facturation'
  return 'Livraison + Facturation'
}

function AddressFormModal(props: {
  initial: Omit<AddressDTO, 'id'> & { id?: string }
  busy: boolean
  onCancel: () => void
  onSave: (a: Omit<AddressDTO, 'id'> & { id?: string }) => Promise<boolean>
}) {
  const [form, setForm] = useState({ ...props.initial })

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void props.onSave(form)
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117] p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
        {form.id ? 'Modifier l’adresse' : 'Nouvelle adresse'}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Libellé (Maison, Bureau…)" value={form.label ?? ''} onChange={v => update('label', v)} />
        <SelectField label="Type" value={form.type} options={[
          { v: 'both', l: 'Livraison + Facturation' },
          { v: 'shipping', l: 'Livraison uniquement' },
          { v: 'billing', l: 'Facturation uniquement' },
        ]} onChange={v => update('type', v as AddressDTO['type'])} />
        <Field label="Nom complet *" required value={form.full_name} onChange={v => update('full_name', v)} />
        <Field label="Société" value={form.company ?? ''} onChange={v => update('company', v || null)} />
        <Field label="Adresse ligne 1 *" required value={form.line1} onChange={v => update('line1', v)} />
        <Field label="Adresse ligne 2" value={form.line2 ?? ''} onChange={v => update('line2', v || null)} />
        <Field label="Code postal *" required value={form.postal_code} onChange={v => update('postal_code', v)} />
        <Field label="Ville *" required value={form.city} onChange={v => update('city', v)} />
        <Field label="État / Région" value={form.state ?? ''} onChange={v => update('state', v || null)} />
        <Field label="Pays (ISO2) *" required value={form.country_iso2} onChange={v => update('country_iso2', v.toUpperCase().slice(0, 2))} />
        <Field label="Téléphone" type="tel" value={form.phone ?? ''} onChange={v => update('phone', v || null)} />
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-300">
        <input
          type="checkbox"
          checked={form.is_default}
          onChange={e => update('is_default', e.target.checked)}
        />
        Définir comme adresse par défaut
      </label>
      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={props.busy} className="rounded-xl bg-[#C9A84C] px-5 py-2.5 text-sm font-bold text-[#07090F] hover:bg-[#E8C97A] disabled:opacity-60">
          {props.busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" onClick={props.onCancel} disabled={props.busy} className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-gray-300 hover:bg-white/10 disabled:opacity-60">
          Annuler
        </button>
      </div>
    </form>
  )
}

function Field(props: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  type?: string
}) {
  return (
    <label className="space-y-1 text-xs">
      <span className="font-semibold uppercase tracking-wide text-gray-400">{props.label}</span>
      <input
        type={props.type ?? 'text'}
        required={props.required}
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white focus:border-[#C9A84C] focus:outline-none"
      />
    </label>
  )
}

function SelectField(props: {
  label: string
  value: string
  options: { v: string; l: string }[]
  onChange: (v: string) => void
}) {
  return (
    <label className="space-y-1 text-xs">
      <span className="font-semibold uppercase tracking-wide text-gray-400">{props.label}</span>
      <select
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white focus:border-[#C9A84C] focus:outline-none"
      >
        {props.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  )
}
