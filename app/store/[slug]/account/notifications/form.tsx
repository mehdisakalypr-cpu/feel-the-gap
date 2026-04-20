// © 2025-2026 Feel The Gap — notification preferences (per-store)
'use client'

import { useState, useEffect, useCallback, type FormEvent } from 'react'

interface Props { slug: string }

interface Prefs {
  newsletter: boolean
  product_updates: boolean
  promotions: boolean
  cart_recovery: boolean
  review_requests: boolean
}

const DEFAULT: Prefs = {
  newsletter: true,
  product_updates: true,
  promotions: true,
  cart_recovery: true,
  review_requests: true,
}

const LABELS: { k: keyof Prefs; l: string; desc: string; locked?: boolean }[] = [
  { k: 'newsletter',      l: 'Newsletter mensuelle',  desc: 'Nouveautés et histoires de la boutique.' },
  { k: 'product_updates', l: 'Nouveaux produits',     desc: 'Soyez prévenu·e quand un produit est mis en ligne.' },
  { k: 'promotions',      l: 'Promotions',            desc: 'Codes promo et offres limitées.' },
  { k: 'cart_recovery',   l: 'Rappel de panier',      desc: 'On vous notifie si un panier est laissé en plan.' },
  { k: 'review_requests', l: 'Demandes d’avis',       desc: 'Une semaine après la livraison, on vous demande votre avis.' },
]

export function NotificationsForm({ slug }: Props) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    fetch(`/api/store/${encodeURIComponent(slug)}/account/profile`)
      .then(r => r.ok ? r.json() : null)
      .then((j: { notification_prefs?: Partial<Prefs> } | null) => {
        if (j?.notification_prefs) setPrefs({ ...DEFAULT, ...j.notification_prefs })
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [slug])

  const submit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true); setMsg(null)
    try {
      const res = await fetch(`/api/store/${encodeURIComponent(slug)}/account/profile`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notification_prefs: prefs }),
      })
      const json = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        setMsg({ ok: false, msg: json?.error ?? 'Sauvegarde impossible' })
      } else {
        setMsg({ ok: true, msg: '✓ Préférences enregistrées.' })
      }
    } catch (err) {
      setMsg({ ok: false, msg: err instanceof Error ? err.message : 'Erreur' })
    } finally {
      setSaving(false)
    }
  }, [prefs, slug, saving])

  if (!loaded) {
    return <div className="h-32 animate-pulse rounded-2xl border border-white/10 bg-[#0D1117]" />
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117] p-6">
      <ul className="space-y-3">
        {LABELS.map(({ k, l, desc }) => (
          <li key={k} className="flex items-start justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">{l}</div>
              <div className="mt-0.5 text-xs text-gray-400">{desc}</div>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={prefs[k]}
                onChange={e => setPrefs(p => ({ ...p, [k]: e.target.checked }))}
                className="peer sr-only"
              />
              <span className="h-6 w-11 rounded-full bg-white/10 transition-colors peer-checked:bg-[#C9A84C]" />
              <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
            </label>
          </li>
        ))}
      </ul>
      {msg && (
        <div role="alert" className={`rounded-xl border px-3 py-2 text-sm ${msg.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
          {msg.msg}
        </div>
      )}
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-[#C9A84C] px-5 py-2.5 text-sm font-bold text-[#07090F] hover:bg-[#E8C97A] disabled:opacity-60"
      >
        {saving ? 'Enregistrement…' : 'Enregistrer les préférences'}
      </button>
    </form>
  )
}
