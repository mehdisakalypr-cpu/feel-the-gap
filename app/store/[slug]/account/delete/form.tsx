// © 2025-2026 Feel The Gap — delete account double-confirm flow
'use client'

import { useState, useCallback, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

interface Props { slug: string }

const REQUIRED_PHRASE = 'SUPPRIMER MON COMPTE'

export function DeleteFlow({ slug }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [phrase, setPhrase] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (phrase.trim() !== REQUIRED_PHRASE) {
      setError(`Tapez exactement « ${REQUIRED_PHRASE} » pour confirmer.`)
      return
    }
    if (!confirm) {
      setError('Vous devez cocher la case de confirmation.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/store/${encodeURIComponent(slug)}/account/delete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      const json = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? 'Suppression impossible')
        setBusy(false)
        return
      }
      setDone(true)
      // Redirect to store home after a short delay.
      setTimeout(() => router.push(`/store/${slug}`), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau')
      setBusy(false)
    }
  }, [phrase, confirm, busy, slug, router])

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
        <h2 className="text-lg font-semibold text-emerald-300">Compte supprimé</h2>
        <p className="mt-1 text-sm text-gray-300">
          Votre demande a été enregistrée. Vous serez redirigé vers la boutique dans quelques secondes.
        </p>
      </div>
    )
  }

  if (step === 1) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setStep(2)}
          className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-3 text-sm font-bold text-red-300 hover:bg-red-500/20"
        >
          Je veux supprimer mon compte
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-red-500/30 bg-[#0D1117] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-red-300">Confirmation</h2>
      <div className="space-y-1 text-xs">
        <label htmlFor="del-phrase" className="font-semibold uppercase tracking-wide text-gray-400">
          Tapez « {REQUIRED_PHRASE} » pour confirmer
        </label>
        <input
          id="del-phrase"
          type="text"
          autoComplete="off"
          value={phrase}
          onChange={e => setPhrase(e.target.value)}
          className="w-full rounded-xl border border-red-500/30 bg-[#111827] px-4 py-2.5 text-sm text-white focus:border-red-400 focus:outline-none"
        />
      </div>
      <label className="flex items-start gap-2 text-xs text-gray-300">
        <input
          type="checkbox"
          checked={confirm}
          onChange={e => setConfirm(e.target.checked)}
          className="mt-0.5"
        />
        <span>Je comprends que cette action est irréversible et que mes données seront anonymisées sous 30 jours.</span>
      </label>
      {error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || phrase.trim() !== REQUIRED_PHRASE || !confirm}
          className="rounded-xl bg-red-500 px-5 py-3 text-sm font-bold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Suppression…' : 'Supprimer définitivement'}
        </button>
        <button
          type="button"
          onClick={() => { setStep(1); setPhrase(''); setConfirm(false); setError(null) }}
          disabled={busy}
          className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-gray-300 hover:bg-white/10 disabled:opacity-60"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
