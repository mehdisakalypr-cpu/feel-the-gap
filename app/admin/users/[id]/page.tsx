'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'

const TIER_CONFIG: Record<string, { name: string; color: string }> = {
  free:       { name: 'Explorer',   color: '#6B7280' },
  basic:      { name: 'Data',       color: '#60A5FA' },
  standard:   { name: 'Strategy',   color: '#C9A84C' },
  premium:    { name: 'Premium',    color: '#A78BFA' },
  enterprise: { name: 'Enterprise', color: '#64748B' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:        { label: 'En attente',       color: '#F59E0B' },
  approved:       { label: 'Approuvé',         color: '#22C55E' },
  rejected:       { label: 'Refusé',           color: '#EF4444' },
  info_requested: { label: 'Infos demandées',  color: '#60A5FA' },
  completed:      { label: 'Remboursé',        color: '#22C55E' },
}

function formatDuration(ms: number): string {
  if (ms < 1000) return '< 1s'
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
  return `${Math.floor(ms / 3600000)}h ${Math.round((ms % 3600000) / 60000)}m`
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

type UserData = {
  profile: any
  sessions: any[]
  pageAnalytics: { page: string; views: number; totalTimeMs: number; avgTimeMs: number; pctTime: number }[]
  invoices: { id: string; date: string; amount_eur: number; plan: string; stripe_event_id: string; metadata: any }[]
  tickets: any[]
  totalConnections: number
}

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'analytics' | 'sessions' | 'billing' | 'tickets'>('analytics')

  // Refund form
  const [refundOpen, setRefundOpen] = useState<string | null>(null) // invoice id
  const [refundReason, setRefundReason] = useState('')
  const [refundSubmitting, setRefundSubmitting] = useState(false)
  const [refundMessage, setRefundMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setData(d)
        setLoading(false)
      })
      .catch(() => { setError('Erreur réseau'); setLoading(false) })
  }, [id])

  async function submitRefund(invoiceId: string, amountEur: number, plan: string) {
    if (!refundReason.trim()) return
    setRefundSubmitting(true)
    try {
      const res = await fetch('/api/admin/refund-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: id,
          reason: refundReason,
          months: [{ invoice_id: invoiceId, amount_eur: amountEur, plan }],
        }),
      })
      const d = await res.json()
      if (res.ok) {
        setRefundMessage({ type: 'success', text: `Ticket #${d.ticket?.ticket_number} créé` })
        setRefundOpen(null)
        setRefundReason('')
        // Refresh data
        const refreshed = await fetch(`/api/admin/users/${id}`).then(r => r.json())
        if (!refreshed.error) setData(refreshed)
      } else {
        setRefundMessage({ type: 'error', text: d.error || 'Erreur' })
      }
    } catch {
      setRefundMessage({ type: 'error', text: 'Erreur réseau' })
    }
    setRefundSubmitting(false)
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (error) return <div className="p-6 text-red-400">{error}</div>
  if (!data) return null

  const { profile, sessions, pageAnalytics, invoices, tickets, totalConnections } = data
  const tier = TIER_CONFIG[profile.tier] ?? TIER_CONFIG.free

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Back + Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin/plans" className="text-xs text-gray-500 hover:text-white transition-colors">&larr; Plans</Link>
        <Link href="/admin/crm" className="text-xs text-gray-500 hover:text-white transition-colors">&larr; CRM</Link>
      </div>

      {/* Profile header */}
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">{profile.email}</h1>
            {profile.full_name && <p className="text-sm text-gray-400 mt-0.5">{profile.full_name}</p>}
            {profile.company && <p className="text-xs text-gray-500">{profile.company}</p>}
            <p className="text-[10px] text-gray-600 font-mono mt-2 select-all">{profile.id}</p>
          </div>
          <div className="flex items-center gap-2">
            {profile.is_admin && (
              <span className="px-2 py-1 bg-[#C9A84C]/10 text-[#C9A84C] text-[10px] font-bold rounded">ADMIN</span>
            )}
            {profile.is_delegate_admin && (
              <span className="px-2 py-1 bg-[#60A5FA]/10 text-[#60A5FA] text-[10px] font-bold rounded">DELEGUE</span>
            )}
            <span className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{ color: tier.color, background: tier.color + '22' }}>
              {profile.is_billed === false && !profile.is_admin ? `Demo ${tier.name}` : tier.name}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-5">
          {[
            { label: 'Connexions', value: totalConnections, color: '#60A5FA' },
            { label: 'Credits IA', value: `${(profile.ai_credits / 100).toFixed(2)} €`, color: '#C9A84C' },
            { label: 'Stripe', value: profile.stripe_customer_id ? 'Lié' : 'Non', color: profile.stripe_customer_id ? '#22C55E' : '#6B7280' },
            { label: 'Membre depuis', value: new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }), color: '#A78BFA' },
            { label: 'Facturé', value: profile.is_billed ? 'Oui' : 'Non', color: profile.is_billed ? '#22C55E' : '#F59E0B' },
          ].map(c => (
            <div key={c.label} className="bg-[#07090F] rounded-lg p-3">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider">{c.label}</p>
              <p className="text-lg font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0D1117] rounded-xl p-1 w-fit">
        {([
          { id: 'analytics', label: 'Analytics' },
          { id: 'sessions', label: 'Sessions' },
          { id: 'billing', label: 'Facturation' },
          { id: 'tickets', label: 'Tickets' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === t.id ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}>
            {t.label}
            {t.id === 'tickets' && tickets.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] bg-[#F59E0B]/20 text-[#F59E0B]">
                {tickets.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Analytics tab */}
      {tab === 'analytics' && (
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Temps passé par page (cumulé)</h2>
          {pageAnalytics.length === 0 ? (
            <p className="text-xs text-gray-500">Aucune donnée de navigation</p>
          ) : (
            <div className="space-y-3">
              {pageAnalytics.map(pa => (
                <div key={pa.page}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-300 font-mono">{pa.page}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-500">{pa.views} vues</span>
                      <span className="text-[10px] text-gray-500">moy. {formatDuration(pa.avgTimeMs)}</span>
                      <span className="text-xs font-semibold text-[#C9A84C]">{pa.pctTime}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-[#C9A84C] rounded-full transition-all"
                      style={{ width: `${Math.max(pa.pctTime, 1)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-white/5">
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Temps total de navigation</h3>
            <p className="text-2xl font-bold text-white">
              {formatDuration(pageAnalytics.reduce((s, p) => s + p.totalTimeMs, 0))}
            </p>
          </div>
        </div>
      )}

      {/* Sessions tab */}
      {tab === 'sessions' && (
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Historique des sessions ({sessions.length})</h2>
          {sessions.length === 0 ? (
            <p className="text-xs text-gray-500">Aucune session enregistrée</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-gray-500 text-left">
                    <th className="pb-2 pr-3 font-medium">Date</th>
                    <th className="pb-2 pr-3 font-medium">Durée</th>
                    <th className="pb-2 pr-3 font-medium">Pages</th>
                    <th className="pb-2 pr-3 font-medium">Events</th>
                    <th className="pb-2 pr-3 font-medium">Converti</th>
                    <th className="pb-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sessions.map((s: any) => (
                    <tr key={s.id} className="hover:bg-white/5">
                      <td className="py-2 pr-3 text-gray-300">{formatDate(s.started_at)}</td>
                      <td className="py-2 pr-3 text-gray-400">{formatDuration(s.durationMs)}</td>
                      <td className="py-2 pr-3 text-gray-400">{s.page_count}</td>
                      <td className="py-2 pr-3 text-gray-400">{s.events_count}</td>
                      <td className="py-2 pr-3">
                        {s.converted
                          ? <span className="text-green-400">Oui</span>
                          : <span className="text-gray-600">Non</span>
                        }
                      </td>
                      <td className="py-2 text-gray-500 truncate max-w-[150px]">{s.referrer || 'Direct'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Billing tab */}
      {tab === 'billing' && (
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Historique de facturation</h2>
          {refundMessage && (
            <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${
              refundMessage.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {refundMessage.text}
            </div>
          )}
          {invoices.length === 0 ? (
            <p className="text-xs text-gray-500">Aucun paiement enregistré</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv: any) => {
                const month = new Date(inv.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                const planName = TIER_CONFIG[inv.plan]?.name ?? inv.plan
                const isRefundOpen = refundOpen === inv.id

                return (
                  <div key={inv.id} className="border border-white/5 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-sm text-white font-medium">{month}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{planName} &middot; {formatDate(inv.date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-white">{Number(inv.amount_eur).toFixed(2)} €</span>
                        <button
                          onClick={() => { setRefundOpen(isRefundOpen ? null : inv.id); setRefundReason(''); setRefundMessage(null) }}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
                            isRefundOpen
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-white/5 text-gray-400 hover:text-white border border-white/5'
                          }`}
                        >
                          {isRefundOpen ? 'Annuler' : 'Rembourser'}
                        </button>
                      </div>
                    </div>

                    {isRefundOpen && (
                      <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
                        <textarea
                          value={refundReason}
                          onChange={e => setRefundReason(e.target.value)}
                          placeholder="Raison du remboursement..."
                          className="w-full bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C9A84C]/50 resize-none"
                          rows={2}
                        />
                        <button
                          onClick={() => submitRefund(inv.id, inv.amount_eur, inv.plan)}
                          disabled={refundSubmitting || !refundReason.trim()}
                          className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-semibold hover:bg-red-500/30 transition-colors disabled:opacity-50"
                        >
                          {refundSubmitting ? 'Envoi...' : 'Créer ticket de remboursement'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tickets tab */}
      {tab === 'tickets' && (
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Tickets de remboursement</h2>
          {tickets.length === 0 ? (
            <p className="text-xs text-gray-500">Aucun ticket</p>
          ) : (
            <div className="space-y-3">
              {tickets.map((t: any) => {
                const st = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.pending
                return (
                  <Link key={t.id} href={`/admin/tickets/${t.id}`}
                    className="block border border-white/5 rounded-xl p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-white font-medium">Ticket #{t.ticket_number}</span>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{t.reason}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-white">{Number(t.total_amount_eur).toFixed(2)} €</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ color: st.color, background: st.color + '22' }}>
                          {st.label}
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-600 mt-2">{formatDate(t.created_at)}</p>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
