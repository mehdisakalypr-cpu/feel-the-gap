'use client'

import { useEffect, useState } from 'react'

type Flag = {
  key: string
  enabled: boolean
  label: string
  description: string | null
  category: string
  updated_at: string
}

export default function FeaturesAdminPage() {
  const [flags, setFlags] = useState<Flag[]>([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState<{ key: string; label: string; next: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/features', { cache: 'no-store' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Failed to load flags')
      }
      const { flags } = await res.json()
      setFlags(flags ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  async function applyToggle() {
    if (!confirm) return
    const { key, next } = confirm
    setConfirm(null)
    try {
      const res = await fetch(`/api/admin/features/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Update failed')
      }
      setFlags(prev => prev.map(f => (f.key === key ? { ...f, enabled: next } : f)))
      setToast(`${confirm.label} ${next ? 'activé' : 'désactivé'}`)
      setTimeout(() => setToast(null), 2200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la mise à jour')
    }
  }

  const byCat = flags.reduce<Record<string, Flag[]>>((acc, f) => {
    (acc[f.category] ??= []).push(f)
    return acc
  }, {})

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-2">Feature Flags</h1>
      <p className="text-sm text-gray-400 mb-6">
        Activer / désactiver les sections du site. Une section désactivée est cachée de la navigation et retourne 404.
        <br />
        <span className="text-[#C9A84C]">Principe business</span> : un parcours vide est déceptif — mieux vaut cacher qu'exposer.
      </p>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && <div className="text-gray-400 text-sm">Chargement…</div>}

      {!loading && Object.entries(byCat).map(([cat, list]) => (
        <div key={cat} className="mb-6">
          <div className="text-xs uppercase tracking-widest text-gray-500 mb-2">{cat}</div>
          <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl divide-y divide-white/5">
            {list.map(f => (
              <div key={f.key} className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white text-sm">{f.label}</div>
                  {f.description && <div className="text-xs text-gray-500 mt-0.5">{f.description}</div>}
                  <div className="text-[10px] text-gray-600 mt-1">key: <code className="text-gray-400">{f.key}</code></div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={f.enabled}
                    onChange={() => setConfirm({ key: f.key, label: f.label, next: !f.enabled })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/10 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#C9A84C]/40 peer-checked:after:translate-x-full peer-checked:bg-[#34D399] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                  <span className={`ml-3 text-xs font-bold ${f.enabled ? 'text-[#34D399]' : 'text-gray-500'}`}>
                    {f.enabled ? 'ACTIF' : 'OFF'}
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Confirmation modal */}
      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setConfirm(null)}
        >
          <div
            role="dialog"
            className="bg-[#0D1117] border border-[rgba(201,168,76,.3)] rounded-2xl p-6 max-w-md w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-2xl mb-3">{confirm.next ? '✅' : '🚫'}</div>
            <h2 className="text-lg font-bold text-white mb-2">
              {confirm.next ? 'Activer' : 'Désactiver'} « {confirm.label} » ?
            </h2>
            <p className="text-sm text-gray-400 mb-5">
              {confirm.next
                ? `La section sera visible dans la navigation et accessible aux utilisateurs.`
                : `La section sera cachée de la navigation. Les routes /${confirm.key}* retourneront 404.`}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirm(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={applyToggle}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                  confirm.next
                    ? 'bg-[#34D399] text-[#07090F] hover:bg-[#2BBF86]'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {confirm.next ? 'Activer' : 'Désactiver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#0D1117] border border-[#34D399]/40 rounded-xl px-4 py-2 text-sm text-[#34D399] shadow-xl z-50">
          ✓ {toast}
        </div>
      )}
    </div>
  )
}
