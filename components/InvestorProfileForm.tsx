'use client'

import { useEffect, useState } from 'react'

interface Props {
  role: 'financeur' | 'investisseur'
  accentColor: string
  onSaved?: () => void
}

const SECTOR_CHOICES = [
  'Agri & Food', 'Textile / Mode', 'Tech / SaaS', 'Fintech',
  'Énergie / Clean', 'Industrie / Manufacturing', 'Santé', 'Consumer',
  'Immobilier', 'Logistique / Transport', 'Éducation', 'Autre',
]

const STAGE_CHOICES = [
  { key: 'idea', label: 'Idée' },
  { key: 'mvp', label: 'MVP' },
  { key: 'traction', label: 'Traction' },
  { key: 'scaling', label: 'Scaling' },
]

export default function InvestorProfileForm({ role, accentColor, onSaved }: Props) {
  const [sectors, setSectors] = useState<string[]>([])
  const [stages, setStages] = useState<string[]>([])
  const [countries, setCountries] = useState('')
  const [ticketMin, setTicketMin] = useState<string>('')
  const [ticketMax, setTicketMax] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/funding/investor/profile')
      .then((r) => r.json())
      .then((j) => {
        const p = j.profile
        if (p) {
          setSectors(p.sectors ?? [])
          setStages(p.stages ?? [])
          setCountries((p.countries ?? []).join(', '))
          setTicketMin(p.ticket_min_eur ? String(p.ticket_min_eur) : '')
          setTicketMax(p.ticket_max_eur ? String(p.ticket_max_eur) : '')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  function toggle<T>(val: T, arr: T[], setter: (v: T[]) => void) {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        sectors,
        stages,
        countries: countries.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean),
        ticket_min_eur: ticketMin ? Number(ticketMin) : null,
        ticket_max_eur: ticketMax ? Number(ticketMax) : null,
      }
      const res = await fetch('/api/funding/investor/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      setSaved(true)
      onSaved?.()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-gray-500 text-sm">Chargement du profil…</div>
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Secteurs ciblés</label>
        <div className="flex flex-wrap gap-2">
          {SECTOR_CHOICES.map((s) => (
            <button type="button" key={s} onClick={() => toggle(s, sectors, setSectors)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: sectors.includes(s) ? accentColor + '25' : 'rgba(255,255,255,0.04)',
                border: sectors.includes(s) ? `1px solid ${accentColor}60` : '1px solid rgba(255,255,255,0.1)',
                color: sectors.includes(s) ? accentColor : '#9CA3AF',
              }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Stades ciblés</label>
        <div className="flex flex-wrap gap-2">
          {STAGE_CHOICES.map(({ key, label }) => (
            <button type="button" key={key} onClick={() => toggle(key, stages, setStages)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: stages.includes(key) ? accentColor + '25' : 'rgba(255,255,255,0.04)',
                border: stages.includes(key) ? `1px solid ${accentColor}60` : '1px solid rgba(255,255,255,0.1)',
                color: stages.includes(key) ? accentColor : '#9CA3AF',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Pays ciblés (ISO3, séparés par virgule)</label>
        <input type="text" value={countries} onChange={(e) => setCountries(e.target.value)}
          placeholder="FRA, MAR, CIV, USA"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Ticket min (€)</label>
          <input type="number" value={ticketMin} onChange={(e) => setTicketMin(e.target.value)}
            placeholder={role === 'financeur' ? '25000' : '50000'}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Ticket max (€)</label>
          <input type="number" value={ticketMax} onChange={(e) => setTicketMax(e.target.value)}
            placeholder="500000"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white" />
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-3 text-sm text-red-300"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          ⚠️ {error}
        </div>
      )}
      {saved && (
        <div className="rounded-xl p-3 text-sm text-[#34D399]"
          style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }}>
          ✅ Profil enregistré — le matching sera calibré sur ces critères.
        </div>
      )}

      <button type="submit" disabled={submitting}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50"
        style={{ background: `linear-gradient(135deg,${accentColor},${accentColor}cc)`, color: '#07090F' }}>
        {submitting ? 'Enregistrement…' : 'Enregistrer mon profil de matching'}
      </button>
    </form>
  )
}
