'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'

const TIERS = [
  { id: 'free',       name: 'Explorer',   color: '#6B7280', price: 'Gratuit' },
  { id: 'basic',      name: 'Data',        color: '#60A5FA', price: '29 €/mois' },
  { id: 'standard',   name: 'Strategy',    color: '#C9A84C', price: '99 €/mois' },
  { id: 'premium',    name: 'Premium',     color: '#A78BFA', price: '149 €/mois' },
  { id: 'enterprise', name: 'Enterprise',  color: '#64748B', price: 'Sur mesure' },
]

const DEMO_DURATIONS = [
  { label: '7 jours',  days: 7 },
  { label: '14 jours', days: 14 },
  { label: '30 jours', days: 30 },
  { label: '60 jours', days: 60 },
  { label: '90 jours', days: 90 },
  { label: 'Illimité', days: 0 },
]

type UserProfile = {
  id: string
  email: string
  full_name: string | null
  company: string | null
  tier: string
  is_billed: boolean
  is_admin: boolean
  is_delegate_admin: boolean
  demo_expires_at: string | null
  ai_credits: number
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
}

export default function PlansPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserProfile[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<UserProfile | null>(null)

  // Edit state
  const [editTier, setEditTier] = useState('')
  const [editBilled, setEditBilled] = useState(true)
  const [editDemoDays, setEditDemoDays] = useState(0)
  const [editDelegate, setEditDelegate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q.trim())}`)
      const data = await res.json()
      setResults(data.users ?? [])
    } catch {
      setResults([])
    }
    setSearching(false)
  }, [])

  function selectUser(user: UserProfile) {
    setSelected(user)
    setEditTier(user.tier)
    setEditBilled(user.is_billed)
    setEditDelegate(user.is_delegate_admin)
    setResults([])
    setQuery(user.email)
    setMessage(null)

    // Calculate remaining demo days
    if (user.demo_expires_at) {
      const remaining = Math.max(0, Math.ceil((new Date(user.demo_expires_at).getTime() - Date.now()) / 86400000))
      setEditDemoDays(remaining || 30)
    } else {
      setEditDemoDays(0)
    }
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setMessage(null)

    const demoExpiresAt = !editBilled && editDemoDays > 0
      ? new Date(Date.now() + editDemoDays * 86400000).toISOString()
      : !editBilled && editDemoDays === 0
        ? null // Illimité
        : null // Facturé = pas de démo

    try {
      const res = await fetch('/api/admin/users/update-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selected.id,
          tier: editTier,
          isBilled: editBilled,
          demoExpiresAt,
          isDelegateAdmin: editDelegate,
        }),
      })
      const data = await res.json()
      if (res.ok && data.user) {
        setSelected({ ...selected, ...data.user })
        const tierName = TIERS.find(t => t.id === editTier)?.name ?? editTier
        const label = editBilled ? tierName : `Demo ${tierName}`
        setMessage({ type: 'success', text: `Plan mis à jour: ${label}` })
      } else {
        setMessage({ type: 'error', text: data.error || 'Erreur inconnue' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur réseau' })
    }
    setSaving(false)
  }

  const tierInfo = TIERS.find(t => t.id === editTier)
  const displayLabel = selected?.is_admin
    ? 'Admin (jamais facturé)'
    : editBilled
      ? tierInfo?.name ?? editTier
      : `Demo ${tierInfo?.name ?? editTier}`

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Gestion des Plans</h1>
        <p className="text-sm text-gray-500 mt-1">Rechercher un utilisateur et modifier son plan</p>
      </div>

      {/* Search */}
      <div className="relative">
        <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
          Rechercher par email, nom ou ID interne
        </label>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); search(e.target.value) }}
          placeholder="john@example.com, John Doe, ou UUID..."
          className="w-full bg-[#0D1117] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C9A84C]/50 transition-colors"
        />
        {searching && (
          <div className="absolute right-4 top-[42px] text-xs text-gray-500">Recherche...</div>
        )}

        {/* Results dropdown */}
        {results.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-[#0D1117] border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-72 overflow-y-auto">
            {results.map(u => (
              <button
                key={u.id}
                onClick={() => selectUser(u)}
                className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-white">{u.email}</span>
                    {u.full_name && (
                      <span className="text-xs text-gray-500 ml-2">({u.full_name})</span>
                    )}
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{
                      color: TIERS.find(t => t.id === u.tier)?.color ?? '#6B7280',
                      background: (TIERS.find(t => t.id === u.tier)?.color ?? '#6B7280') + '22',
                    }}
                  >
                    {u.is_billed ? (TIERS.find(t => t.id === u.tier)?.name ?? u.tier) : `Demo ${TIERS.find(t => t.id === u.tier)?.name ?? u.tier}`}
                  </span>
                </div>
                <div className="text-[10px] text-gray-600 mt-0.5 font-mono">{u.id}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected user card */}
      {selected && (
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-6 space-y-6">
          {/* User info header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{selected.email}</h2>
              {selected.full_name && (
                <p className="text-sm text-gray-400">{selected.full_name}</p>
              )}
              {selected.company && (
                <p className="text-xs text-gray-500">{selected.company}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selected.is_admin && (
                <span className="px-3 py-1 bg-[#C9A84C]/10 text-[#C9A84C] text-xs font-semibold rounded-full">
                  ADMIN
                </span>
              )}
              <Link href={`/admin/users/${selected.id}`}
                className="px-3 py-1 bg-white/5 text-gray-400 hover:text-white text-xs rounded-full border border-white/10 transition-colors">
                Voir profil complet &rarr;
              </Link>
            </div>
          </div>

          {/* Read-only fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-gray-600 uppercase tracking-wider">ID interne</label>
              <p className="text-xs text-gray-400 font-mono mt-1 select-all">{selected.id}</p>
            </div>
            <div>
              <label className="text-[10px] text-gray-600 uppercase tracking-wider">Date de création</label>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(selected.created_at).toLocaleDateString('fr-FR', {
                  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </p>
            </div>
            <div>
              <label className="text-[10px] text-gray-600 uppercase tracking-wider">Crédits IA</label>
              <p className="text-xs text-gray-400 mt-1">{(selected.ai_credits / 100).toFixed(2)} €</p>
            </div>
            <div>
              <label className="text-[10px] text-gray-600 uppercase tracking-wider">Stripe</label>
              <p className="text-xs text-gray-400 mt-1">
                {selected.stripe_customer_id
                  ? <span className="text-green-400">Lié</span>
                  : <span className="text-gray-600">Non lié</span>
                }
              </p>
            </div>
          </div>

          <hr className="border-white/5" />

          {/* Plan selector */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-3 block">Plan</label>
            <div className="grid grid-cols-5 gap-2">
              {TIERS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setEditTier(t.id)}
                  className={`rounded-xl px-3 py-3 text-center transition-all border ${
                    editTier === t.id
                      ? 'ring-2 border-transparent'
                      : 'border-white/5 hover:border-white/10'
                  }`}
                  style={editTier === t.id ? {
                    background: t.color + '15',
                    borderColor: t.color + '40',
                    boxShadow: `0 0 0 2px ${t.color}40`,
                  } : undefined}
                >
                  <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ background: t.color }} />
                  <p className="text-xs font-semibold text-white">{t.name}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{t.price}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Billing toggle */}
          {!selected.is_admin && (
            <div className="flex items-center justify-between bg-[#07090F] rounded-xl px-4 py-3">
              <div>
                <p className="text-sm text-white">Facturer ce plan</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {editBilled
                    ? 'Le plan sera facturé via Stripe'
                    : `Plan gratuit (Demo ${tierInfo?.name ?? editTier})`
                  }
                </p>
              </div>
              <button
                onClick={() => setEditBilled(!editBilled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  editBilled ? 'bg-[#22C55E]' : 'bg-gray-700'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  editBilled ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          )}

          {/* Demo duration */}
          {!editBilled && !selected.is_admin && (
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-3 block">
                Durée du mode démo
              </label>
              <div className="grid grid-cols-6 gap-2">
                {DEMO_DURATIONS.map(d => (
                  <button
                    key={d.days}
                    onClick={() => setEditDemoDays(d.days)}
                    className={`rounded-lg px-2 py-2 text-xs text-center transition-all border ${
                      editDemoDays === d.days
                        ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C] font-semibold'
                        : 'border-white/5 text-gray-400 hover:border-white/10'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {editDemoDays > 0 && (
                <p className="text-[11px] text-gray-600 mt-2">
                  Expire le {new Date(Date.now() + editDemoDays * 86400000).toLocaleDateString('fr-FR', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </p>
              )}
              {editDemoDays === 0 && (
                <p className="text-[11px] text-gray-600 mt-2">
                  Aucune expiration — l'utilisateur garde l'accès indéfiniment
                </p>
              )}
            </div>
          )}

          {/* Admin délégué toggle */}
          {!selected.is_admin && (
            <div className="flex items-center justify-between bg-[#07090F] rounded-xl px-4 py-3">
              <div>
                <p className="text-sm text-white">Admin délégué</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {editDelegate
                    ? 'Peut gérer les plans et créer des tickets de remboursement (validation requise)'
                    : 'Utilisateur standard — pas d\'accès admin'
                  }
                </p>
              </div>
              <button
                onClick={() => setEditDelegate(!editDelegate)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  editDelegate ? 'bg-[#60A5FA]' : 'bg-gray-700'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  editDelegate ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          )}

          {selected.is_admin && (
            <div className="bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded-xl px-4 py-3">
              <p className="text-xs text-[#C9A84C]">
                Compte administrateur — jamais facturé, accès complet permanent.
              </p>
            </div>
          )}

          {/* Preview */}
          <div className="bg-[#07090F] rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider">Affichage du plan</p>
              <p className="text-sm font-semibold mt-1" style={{ color: tierInfo?.color ?? '#6B7280' }}>
                {displayLabel}
              </p>
            </div>
            {!editBilled && !selected.is_admin && selected.demo_expires_at && (
              <div className="text-right">
                <p className="text-[10px] text-gray-600 uppercase tracking-wider">Expiration actuelle</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(selected.demo_expires_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            )}
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-[#C9A84C] text-[#07090F] font-semibold text-sm rounded-xl hover:bg-[#C9A84C]/90 transition-colors disabled:opacity-60"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
            {message && (
              <p className={`text-sm ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {message.text}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Help text */}
      {!selected && (
        <div className="bg-[#0D1117] border border-white/5 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-3">Comment utiliser</h3>
          <ul className="text-xs text-gray-500 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-[#C9A84C]">1.</span>
              Recherchez un utilisateur par email, nom ou ID interne (UUID)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#C9A84C]">2.</span>
              Sélectionnez-le dans les résultats — ses informations s'affichent
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#C9A84C]">3.</span>
              Changez le plan (Explorer, Data, Strategy, Premium, Enterprise)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#C9A84C]">4.</span>
              Décochez "Facturer" pour créer un plan démo gratuit (Demo Explorer, Demo Data...)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#C9A84C]">5.</span>
              Définissez la durée du mode démo avant que l'utilisateur soit invité à payer
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
