'use client'

import { useState, useEffect, useCallback } from 'react'

const PARCOURS_OPTIONS = [
  { key: 'entrepreneur', label: 'Entrepreneur', icon: '🧭', color: '#C9A84C' },
  { key: 'influenceur', label: 'Influenceur', icon: '🎤', color: '#A78BFA' },
  { key: 'financeur', label: 'Financeur', icon: '🏦', color: '#34D399' },
  { key: 'investisseur', label: 'Investisseur', icon: '📈', color: '#60A5FA' },
]

type DemoRequest = {
  id: string
  email: string
  full_name: string
  company: string | null
  message: string | null
  status: 'pending' | 'approved' | 'rejected'
  parcours: string[] | null
  created_at: string
  reviewed_at: string | null
}

type TourStep = {
  id: string
  parcours: string
  step_order: number
  title_fr: string
  title_en: string
  body_fr: string
  body_en: string
  target_url: string
  target_id: string | null
  position: string
  published: boolean
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending:  { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B', label: 'En attente' },
  approved: { bg: 'rgba(52,211,153,0.15)', text: '#34D399', label: 'Approuvé' },
  rejected: { bg: 'rgba(239,68,68,0.15)',  text: '#EF4444', label: 'Refusé' },
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      className="fixed top-4 right-4 z-[100] rounded-xl px-4 py-3 text-sm font-medium shadow-2xl animate-in slide-in-from-top"
      style={{
        background: type === 'success' ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)',
        border: `1px solid ${type === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
        color: type === 'success' ? '#34D399' : '#EF4444',
      }}
    >
      {message}
    </div>
  )
}

export default function DemoParcoursPage() {
  const [tab, setTab] = useState<'demandes' | 'parcours'>('demandes')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">🎯 Parcours démo</h1>
        <p className="text-sm text-gray-400">
          Gérez les demandes d&apos;accès démo et configurez les étapes des parcours guidés.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-white/5 w-fit">
        {(['demandes', 'parcours'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-[#C9A84C]/15 text-[#C9A84C]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {t === 'demandes' ? 'Demandes' : 'Parcours'}
          </button>
        ))}
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {tab === 'demandes' ? (
        <DemandesTab onToast={setToast} />
      ) : (
        <ParcoursTab onToast={setToast} />
      )}
    </div>
  )
}

// ── Tab 1: Demandes ──────────────────────────────────────────────────────────

function DemandesTab({ onToast }: { onToast: (t: { message: string; type: 'success' | 'error' }) => void }) {
  const [requests, setRequests] = useState<DemoRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [modal, setModal] = useState<DemoRequest | null>(null)
  const [modalParcours, setModalParcours] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const fetchRequests = useCallback(async () => {
    try {
      const url = filter === 'all'
        ? '/api/admin/demo-parcours'
        : `/api/admin/demo-parcours?status=${filter}`
      const res = await fetch(url)
      const j = await res.json()
      setRequests(j.requests ?? [])
    } catch {
      onToast({ message: 'Erreur de chargement.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [filter, onToast])

  useEffect(() => {
    setLoading(true)
    fetchRequests()
  }, [fetchRequests])

  function openModal(req: DemoRequest) {
    setModal(req)
    setModalParcours(req.parcours ?? [])
  }

  function toggleParcours(key: string) {
    setModalParcours((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  async function updateRequest(status: string, parcours?: string[]) {
    if (!modal) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/demo-parcours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: modal.id,
          status,
          parcours: parcours ?? modalParcours,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      onToast({ message: `Demande ${status === 'approved' ? 'approuvée' : status === 'rejected' ? 'refusée' : 'mise à jour'}.`, type: 'success' })
      setModal(null)
      fetchRequests()
    } catch (err) {
      onToast({ message: (err as Error).message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function deleteRequest(id: string) {
    if (!confirm('Supprimer cette demande ?')) return
    try {
      const res = await fetch(`/api/admin/demo-parcours?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erreur')
      onToast({ message: 'Demande supprimée.', type: 'success' })
      fetchRequests()
    } catch {
      onToast({ message: 'Erreur de suppression.', type: 'error' })
    }
  }

  return (
    <>
      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {['all', 'pending', 'approved', 'rejected'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-[#C9A84C]/15 text-[#C9A84C]'
                : 'text-gray-500 hover:text-white hover:bg-white/5'
            }`}
          >
            {f === 'all' ? 'Toutes' : STATUS_STYLES[f].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">Aucune demande.</div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,.15)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Nom</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium hidden md:table-cell">Entreprise</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium hidden lg:table-cell">Date</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Statut</th>
                <th className="px-4 py-3 text-xs text-gray-500 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => {
                const s = STATUS_STYLES[req.status] ?? STATUS_STYLES.pending
                return (
                  <tr
                    key={req.id}
                    className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                    onClick={() => openModal(req)}
                  >
                    <td className="px-4 py-3 text-white font-mono text-xs">{req.email}</td>
                    <td className="px-4 py-3 text-gray-300">{req.full_name}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{req.company ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell text-xs">
                      {new Date(req.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: s.bg, color: s.text }}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteRequest(req.id) }}
                        className="text-gray-600 hover:text-red-400 transition-colors text-xs"
                        title="Supprimer"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal ────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,.2)' }}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold text-white">{modal.full_name}</h3>
                  <p className="text-xs text-gray-500 font-mono">{modal.email}</p>
                </div>
                <button
                  onClick={() => setModal(null)}
                  className="text-gray-500 hover:text-white transition-colors text-lg"
                >
                  ✕
                </button>
              </div>

              {modal.company && (
                <div className="mb-3 text-sm text-gray-400">
                  <span className="text-gray-600">Entreprise:</span> {modal.company}
                </div>
              )}
              {modal.message && (
                <div className="mb-4 p-3 rounded-lg bg-white/5 text-sm text-gray-300">
                  {modal.message}
                </div>
              )}

              <div className="mb-5">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">
                  Parcours à activer
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {PARCOURS_OPTIONS.map((p) => {
                    const checked = modalParcours.includes(p.key)
                    return (
                      <button
                        key={p.key}
                        onClick={() => toggleParcours(p.key)}
                        className="flex items-center gap-2 p-3 rounded-xl text-sm transition-all text-left"
                        style={{
                          background: checked ? `${p.color}15` : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${checked ? p.color + '40' : 'rgba(255,255,255,0.06)'}`,
                          color: checked ? p.color : '#6B7280',
                        }}
                      >
                        <span className="text-lg">{p.icon}</span>
                        <span className="flex-1 font-medium">{p.label}</span>
                        {checked && <span style={{ color: p.color }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => updateRequest('approved')}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                >
                  {saving ? '...' : 'Valider'}
                </button>
                <button
                  onClick={() => updateRequest('rejected', [])}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                >
                  Refuser
                </button>
                <button
                  onClick={() => updateRequest('approved', [])}
                  disabled={saving}
                  className="py-2.5 px-4 rounded-xl text-sm transition-all disabled:opacity-50 bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
                >
                  Désactiver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Tab 2: Parcours (Tour Steps) ─────────────────────────────────────────────

function ParcoursTab({ onToast }: { onToast: (t: { message: string; type: 'success' | 'error' }) => void }) {
  const [selectedParcours, setSelectedParcours] = useState('entrepreneur')
  const [steps, setSteps] = useState<TourStep[]>([])
  const [loading, setLoading] = useState(true)
  const [editingStep, setEditingStep] = useState<TourStep | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchSteps = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/demo-parcours/steps?parcours=${selectedParcours}`)
      const j = await res.json()
      setSteps(j.steps ?? [])
    } catch {
      onToast({ message: 'Erreur de chargement des étapes.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [selectedParcours, onToast])

  useEffect(() => {
    fetchSteps()
  }, [fetchSteps])

  function newStep() {
    const maxOrder = steps.reduce((m, s) => Math.max(m, s.step_order), 0)
    setEditingStep({
      id: '',
      parcours: selectedParcours,
      step_order: maxOrder + 1,
      title_fr: '',
      title_en: '',
      body_fr: '',
      body_en: '',
      target_url: '',
      target_id: null,
      position: 'bottom',
      published: true,
    })
  }

  async function saveStep() {
    if (!editingStep) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = { ...editingStep }
      if (!editingStep.id) delete body.id
      const res = await fetch('/api/admin/demo-parcours/steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      onToast({ message: 'Étape sauvegardée.', type: 'success' })
      setEditingStep(null)
      fetchSteps()
    } catch (err) {
      onToast({ message: (err as Error).message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function deleteStep(id: string) {
    if (!confirm('Supprimer cette étape ?')) return
    try {
      const res = await fetch(`/api/admin/demo-parcours/steps?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erreur')
      onToast({ message: 'Étape supprimée.', type: 'success' })
      fetchSteps()
    } catch {
      onToast({ message: 'Erreur de suppression.', type: 'error' })
    }
  }

  const meta = PARCOURS_OPTIONS.find((p) => p.key === selectedParcours)!

  return (
    <>
      {/* Parcours selector */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {PARCOURS_OPTIONS.map((p) => (
          <button
            key={p.key}
            onClick={() => { setSelectedParcours(p.key); setEditingStep(null) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{
              background: selectedParcours === p.key ? `${p.color}15` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${selectedParcours === p.key ? p.color + '40' : 'rgba(255,255,255,0.06)'}`,
              color: selectedParcours === p.key ? p.color : '#6B7280',
            }}
          >
            <span>{p.icon}</span> {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-400">
          {steps.length} étape{steps.length !== 1 ? 's' : ''} — Parcours{' '}
          <span style={{ color: meta.color }}>{meta.label}</span>
        </div>
        <button
          onClick={newStep}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/30 hover:bg-[#C9A84C]/25 transition-colors"
        >
          + Nouvelle étape
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : steps.length === 0 && !editingStep ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          Aucune étape pour ce parcours.
        </div>
      ) : (
        <div className="space-y-2">
          {steps.map((step) => (
            <div
              key={step.id}
              className="rounded-xl p-4 flex items-start gap-3 group"
              style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,.1)' }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: `${meta.color}20`, color: meta.color }}
              >
                {step.step_order}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-white">{step.title_fr || '(sans titre)'}</span>
                  {!step.published && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/5 text-gray-500">brouillon</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">{step.target_url}</p>
                {step.target_id && (
                  <p className="text-[10px] text-gray-600 font-mono mt-0.5">#{step.target_id}</p>
                )}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditingStep({ ...step })}
                  className="px-2 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Modifier
                </button>
                <button
                  onClick={() => deleteStep(step.id)}
                  className="px-2 py-1 rounded text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                >
                  Suppr
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Edit / Create step modal ──────────────────────────── */}
      {editingStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div
            className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl my-8"
            style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,.2)' }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-white">
                  {editingStep.id ? 'Modifier l\'étape' : 'Nouvelle étape'}
                </h3>
                <button onClick={() => setEditingStep(null)} className="text-gray-500 hover:text-white text-lg">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Ordre</label>
                  <input
                    type="number"
                    value={editingStep.step_order}
                    onChange={(e) => setEditingStep({ ...editingStep, step_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-[#07090F] border border-white/10 text-sm text-white focus:outline-none focus:border-[#C9A84C]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Position</label>
                  <select
                    value={editingStep.position}
                    onChange={(e) => setEditingStep({ ...editingStep, position: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#07090F] border border-white/10 text-sm text-white focus:outline-none focus:border-[#C9A84C]"
                  >
                    <option value="bottom">Bottom</option>
                    <option value="top">Top</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Titre (FR) *</label>
                  <input
                    type="text"
                    value={editingStep.title_fr}
                    onChange={(e) => setEditingStep({ ...editingStep, title_fr: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#07090F] border border-white/10 text-sm text-white focus:outline-none focus:border-[#C9A84C]"
                    placeholder="Bienvenue sur la carte"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Titre (EN)</label>
                  <input
                    type="text"
                    value={editingStep.title_en}
                    onChange={(e) => setEditingStep({ ...editingStep, title_en: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#07090F] border border-white/10 text-sm text-white focus:outline-none focus:border-[#C9A84C]"
                    placeholder="Welcome to the map"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Corps (FR)</label>
                  <textarea
                    value={editingStep.body_fr}
                    onChange={(e) => setEditingStep({ ...editingStep, body_fr: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-[#07090F] border border-white/10 text-sm text-white focus:outline-none focus:border-[#C9A84C] resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Corps (EN)</label>
                  <textarea
                    value={editingStep.body_en}
                    onChange={(e) => setEditingStep({ ...editingStep, body_en: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-[#07090F] border border-white/10 text-sm text-white focus:outline-none focus:border-[#C9A84C] resize-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">URL cible *</label>
                  <input
                    type="text"
                    value={editingStep.target_url}
                    onChange={(e) => setEditingStep({ ...editingStep, target_url: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#07090F] border border-white/10 text-sm text-white font-mono focus:outline-none focus:border-[#C9A84C]"
                    placeholder="/map"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">ID élément cible</label>
                  <input
                    type="text"
                    value={editingStep.target_id ?? ''}
                    onChange={(e) => setEditingStep({ ...editingStep, target_id: e.target.value || null })}
                    className="w-full px-3 py-2 rounded-lg bg-[#07090F] border border-white/10 text-sm text-white font-mono focus:outline-none focus:border-[#C9A84C]"
                    placeholder="ftg-country-panel"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingStep.published}
                    onChange={(e) => setEditingStep({ ...editingStep, published: e.target.checked })}
                    className="rounded border-white/20 bg-[#07090F] text-[#C9A84C] focus:ring-[#C9A84C]"
                  />
                  <span className="text-sm text-gray-300">Publié</span>
                </label>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditingStep(null)}
                  className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={saveStep}
                  disabled={saving || !editingStep.title_fr || !editingStep.target_url}
                  className="px-6 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 bg-[#C9A84C] text-black hover:bg-[#d4b65e]"
                >
                  {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
