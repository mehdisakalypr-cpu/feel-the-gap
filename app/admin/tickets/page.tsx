'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:        { label: 'En attente',       color: '#F59E0B' },
  approved:       { label: 'Approuvé',         color: '#22C55E' },
  rejected:       { label: 'Refusé',           color: '#EF4444' },
  info_requested: { label: 'Infos demandées',  color: '#60A5FA' },
  completed:      { label: 'Remboursé',        color: '#22C55E' },
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export default function TicketsListPage() {
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    const url = filter === 'all' ? '/api/admin/refund-tickets' : `/api/admin/refund-tickets?status=${filter}`
    fetch(url)
      .then(r => r.json())
      .then(d => { setTickets(d.tickets ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filter])

  const pendingCount = tickets.filter(t => t.status === 'pending').length

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Tickets de remboursement</h1>
        <p className="text-sm text-gray-500 mt-1">Demandes de remboursement des admins délégués</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-[#0D1117] rounded-xl p-1 w-fit">
        {[
          { id: 'all', label: 'Tous' },
          { id: 'pending', label: 'En attente', count: pendingCount },
          { id: 'info_requested', label: 'Infos demandées' },
          { id: 'completed', label: 'Remboursés' },
          { id: 'rejected', label: 'Refusés' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.id ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}>
            {f.label}
            {'count' in f && f.count !== undefined && f.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] bg-[#F59E0B]/20 text-[#F59E0B]">
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-[#0D1117] border border-white/5 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-500">Aucun ticket</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((t: any) => {
            const st = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.pending
            const user = t.user as any
            const requester = t.requester as any

            return (
              <Link key={t.id} href={`/admin/tickets/${t.id}`}
                className="block bg-[#0D1117] border border-white/5 rounded-xl p-4 hover:bg-white/[.03] transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-white">#{t.ticket_number}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ color: st.color, background: st.color + '22' }}>
                      {st.label}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-white">{Number(t.total_amount_eur).toFixed(2)} €</span>
                </div>
                <p className="text-xs text-gray-400 mt-1.5 line-clamp-1">{t.reason}</p>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-600">
                  <span>Client: {user?.email ?? '?'}</span>
                  <span>Par: {requester?.email ?? '?'}</span>
                  <span>{formatDate(t.created_at)}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
