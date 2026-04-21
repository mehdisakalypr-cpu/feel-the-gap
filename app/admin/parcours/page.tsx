'use client'

import { useEffect, useState } from 'react'

type Row = {
  role_kind: 'entrepreneur' | 'financeur' | 'investisseur' | 'influenceur'
  enabled: boolean
  auto_enable_threshold: number | null
  enabled_at: string | null
  disabled_at: string | null
  reason: string | null
  updated_at: string
}

type MarketplaceState = {
  phase: string
  dossiers_complete_count: number
  dossiers_in_progress_count: number
  unlock_threshold: number
  waitlist_count: number
}

const LABELS: Record<string, { emoji: string; title: string; tagline: string }> = {
  entrepreneur: { emoji: '🧭', title: 'Entrepreneur', tagline: 'Parcours cœur — toujours actif (cold start de la plateforme).' },
  financeur:    { emoji: '🏦', title: 'Financeur',    tagline: 'Ouvrir le parcours dette/crédit. Inutile avant qu\'il n\'y ait des dossiers à analyser.' },
  investisseur: { emoji: '📈', title: 'Investisseur', tagline: 'Ouvrir le parcours equity. Même logique — attendre un volume minimum de dossiers.' },
  influenceur:  { emoji: '🎤', title: 'Influenceur',  tagline: 'Activation manuelle — dépend des campagnes affiliées actives.' },
}

export default function AdminParcoursPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [state, setState] = useState<MarketplaceState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [reasonInput, setReasonInput] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/admin/parcours-state').then(r => r.json()),
        fetch('/api/funding/marketplace/state').then(r => r.json()),
      ])
      if (r1.error) throw new Error(r1.error)
      setRows(r1.rows ?? [])
      if (!r2.error) setState(r2)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function toggle(row: Row, nextEnabled: boolean) {
    if (row.role_kind === 'entrepreneur') return // always on
    setSaving(row.role_kind)
    setError('')
    try {
      const res = await fetch('/api/admin/parcours-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: row.role_kind,
          enabled: nextEnabled,
          reason: reasonInput[row.role_kind] || null,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1">🚪 Parcours</h1>
          <p className="text-sm text-gray-400">
            Activer ou désactiver chaque type de parcours. Quand un parcours est désactivé, ses routes
            renvoient 404, ses liens disparaissent de la topbar, et ses options sont filtrées dans les
            formulaires (création de dossier, etc).
          </p>
        </div>

        {state && (
          <div className="rounded-2xl p-4 mb-6 text-sm"
            style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,0.25)' }}>
            <span className="text-[#C9A84C] font-bold">Dossiers complets : {state.dossiers_complete_count}/{state.unlock_threshold}</span>
            <span className="text-gray-500 ml-3">· en cours : {state.dossiers_in_progress_count} · waitlist : {state.waitlist_count} · phase : {state.phase}</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl p-3 mb-4 text-sm text-red-300"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            ⚠️ {error}
          </div>
        )}

        <div className="space-y-4">
          {loading ? (
            <div className="text-sm text-gray-500">Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-gray-500">Aucune ligne — exécutez la migration parcours_state.</div>
          ) : rows.map((row) => {
            const meta = LABELS[row.role_kind]
            const disabled = row.role_kind === 'entrepreneur'
            const thresholdMet = row.auto_enable_threshold != null && state
              ? state.dossiers_complete_count >= row.auto_enable_threshold
              : true
            return (
              <div key={row.role_kind} className="rounded-2xl p-5"
                style={{
                  background: '#0D1117',
                  border: `1px solid ${row.enabled ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`,
                }}>
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="text-3xl">{meta.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-lg font-bold">{meta.title}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{
                          background: row.enabled ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
                          color: row.enabled ? '#34D399' : '#9CA3AF',
                          border: `1px solid ${row.enabled ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}`,
                        }}>
                        {row.enabled ? 'ACTIF' : 'DÉSACTIVÉ'}
                      </span>
                      {row.auto_enable_threshold != null && (
                        <span className="text-[10px] text-gray-500">
                          auto-enable à {row.auto_enable_threshold} dossiers {thresholdMet && !row.enabled && '⚠️ seuil atteint'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mb-2">{meta.tagline}</p>
                    {row.reason && (
                      <div className="text-xs text-gray-500 mb-2">Raison : « {row.reason} »</div>
                    )}
                    {row.enabled && row.enabled_at && (
                      <div className="text-[10px] text-gray-600">Activé le {new Date(row.enabled_at).toLocaleString('fr-FR')}</div>
                    )}
                    {!row.enabled && row.disabled_at && (
                      <div className="text-[10px] text-gray-600">Désactivé le {new Date(row.disabled_at).toLocaleString('fr-FR')}</div>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col gap-2 min-w-[200px]">
                    <input
                      type="text"
                      value={reasonInput[row.role_kind] ?? ''}
                      onChange={(e) => setReasonInput(s => ({ ...s, [row.role_kind]: e.target.value }))}
                      placeholder="Raison (facultatif)"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                      disabled={disabled}
                    />
                    <button
                      onClick={() => toggle(row, !row.enabled)}
                      disabled={disabled || saving === row.role_kind}
                      className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                      style={{
                        background: row.enabled ? 'rgba(239,68,68,0.15)' : '#34D399',
                        color: row.enabled ? '#F87171' : '#07090F',
                        border: row.enabled ? '1px solid rgba(239,68,68,0.3)' : 'none',
                      }}>
                      {disabled ? 'Toujours actif'
                        : saving === row.role_kind ? '…'
                        : row.enabled ? 'Désactiver' : 'Activer'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-10 rounded-2xl p-5 text-sm text-gray-400"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="font-bold text-white mb-2">🤖 Auto-activation</div>
          <p>
            Quand <code className="bg-white/5 px-1.5 py-0.5 rounded text-xs">dossiers_complete_count ≥ auto_enable_threshold</code>,
            la fonction <code className="bg-white/5 px-1.5 py-0.5 rounded text-xs">recompute_marketplace_state()</code> appelle
            automatiquement <code className="bg-white/5 px-1.5 py-0.5 rounded text-xs">auto_enable_parcours()</code> qui flippe
            les rows concernées à <code className="bg-white/5 px-1.5 py-0.5 rounded text-xs">enabled=true</code>. Le cron VPS
            (toutes 5 min) rafraîchit ce compteur.
          </p>
        </div>
      </div>
    </div>
  )
}
