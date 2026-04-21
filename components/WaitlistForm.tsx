'use client'

import { useState } from 'react'

interface Props {
  role: 'financeur' | 'investisseur'
  accentColor: string
  defaultEmail?: string
}

const SECTOR_CHOICES = [
  'Agri & Food',
  'Textile / Mode',
  'Tech / SaaS',
  'Fintech',
  'Énergie / Clean',
  'Industrie / Manufacturing',
  'Santé',
  'Consumer',
  'Immobilier',
  'Logistique / Transport',
  'Éducation',
  'Autre',
]

const STAGE_CHOICES = [
  { key: 'idea', label: 'Idée' },
  { key: 'mvp', label: 'MVP' },
  { key: 'traction', label: 'Traction' },
  { key: 'scaling', label: 'Scaling' },
]

export default function WaitlistForm({ role, accentColor, defaultEmail = '' }: Props) {
  const [email, setEmail] = useState(defaultEmail)
  const [sectors, setSectors] = useState<string[]>([])
  const [stages, setStages] = useState<string[]>([])
  const [countries, setCountries] = useState('')
  const [ticketMin, setTicketMin] = useState<string>('')
  const [ticketMax, setTicketMax] = useState<string>('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function toggle<T>(val: T, arr: T[], setter: (v: T[]) => void) {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        email,
        role_kind: role,
        profile: {
          sectors,
          stages,
          countries: countries.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean),
          ticket_min_eur: ticketMin ? Number(ticketMin) : null,
          ticket_max_eur: ticketMax ? Number(ticketMax) : null,
        },
      }
      const res = await fetch('/api/funding/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      setSuccess(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-3xl p-8 text-center max-w-xl mx-auto"
        style={{ background: '#0D1117', border: `1px solid ${accentColor}30` }}>
        <div className="text-5xl mb-3">🎯</div>
        <h3 className="text-xl font-bold text-white mb-2">Inscription confirmée</h3>
        <p className="text-sm text-gray-400 mb-4">
          Vous êtes sur la liste d'attente. Dès que le catalogue s'ouvre, vous recevrez un email avec un accès prioritaire — et la possibilité de devenir Founding Pioneer avec -30% à vie.
        </p>
        <div className="text-xs text-gray-500">
          Préférez-vous qu'on vous contacte avant ? Écrivez à <a className="underline" href="mailto:founders@feelthegap.com">founders@feelthegap.com</a>
        </div>
      </div>
    )
  }

  const labelRole = role === 'financeur' ? 'Financeur (banque, crédit, family office dette)' : 'Investisseur (angel, VC, family office equity)'

  return (
    <form onSubmit={submit} className="rounded-3xl p-6 md:p-8 max-w-2xl mx-auto"
      style={{ background: '#0D1117', border: `1px solid ${accentColor}25` }}>
      <div className="mb-5">
        <h3 className="text-xl font-bold text-white mb-1">Rejoindre la liste d'attente</h3>
        <p className="text-sm text-gray-400">{labelRole}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Email professionnel *</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom@societe.com"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white" />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Secteurs d'intérêt</label>
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
              placeholder="50000"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Ticket max (€)</label>
            <input type="number" value={ticketMax} onChange={(e) => setTicketMax(e.target.value)}
              placeholder="500000"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white" />
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl p-3 text-sm text-red-300"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          ⚠️ {error}
        </div>
      )}

      <button type="submit" disabled={submitting}
        className="w-full mt-5 py-3 rounded-xl font-bold text-sm disabled:opacity-50"
        style={{ background: `linear-gradient(135deg,${accentColor},${accentColor}cc)`, color: '#07090F' }}>
        {submitting ? 'Inscription…' : "S'inscrire sur la liste d'attente"}
      </button>

      <p className="mt-3 text-[11px] text-gray-500 text-center">
        Aucun engagement. Pas de carte demandée. Vous recevrez un accès prioritaire dès l'ouverture du catalogue.
      </p>
    </form>
  )
}
