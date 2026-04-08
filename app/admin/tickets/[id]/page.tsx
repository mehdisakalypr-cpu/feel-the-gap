'use client'

import { useState, useEffect, use } from 'react'
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

export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [ticket, setTicket] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [action, setAction] = useState<string>('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function loadTicket() {
    const res = await fetch(`/api/admin/refund-tickets/${id}`)
    const d = await res.json()
    if (d.error) { setError(d.error); return }
    setTicket(d.ticket)
    setMessages(d.messages ?? [])
  }

  useEffect(() => {
    loadTicket().finally(() => setLoading(false))
  }, [id])

  async function handleAction() {
    if (!action || !message.trim()) return
    setSubmitting(true)
    setSubmitMsg(null)
    try {
      const res = await fetch(`/api/admin/refund-tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, message: message.trim() }),
      })
      const d = await res.json()
      if (res.ok) {
        setSubmitMsg({ type: 'success', text: `Action "${action}" effectuée` })
        setAction('')
        setMessage('')
        await loadTicket()
      } else {
        setSubmitMsg({ type: 'error', text: d.error || 'Erreur' })
      }
    } catch {
      setSubmitMsg({ type: 'error', text: 'Erreur réseau' })
    }
    setSubmitting(false)
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (error) return <div className="p-6 text-red-400">{error}</div>
  if (!ticket) return null

  const st = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.pending
  const user = ticket.user as any
  const requester = ticket.requester as any
  const months = (ticket.months as any[]) ?? []
  const isTerminal = ['completed', 'rejected'].includes(ticket.status)

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <Link href="/admin/tickets" className="text-xs text-gray-500 hover:text-white transition-colors">
        &larr; Tous les tickets
      </Link>

      {/* Header */}
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white">Ticket #{ticket.ticket_number}</h1>
          <span className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{ color: st.color, background: st.color + '22' }}>
            {st.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-gray-600 uppercase tracking-wider mb-1">Client</p>
            <Link href={`/admin/users/${user?.id}`} className="text-[#60A5FA] hover:underline">
              {user?.email ?? 'N/A'}
            </Link>
            {user?.full_name && <p className="text-gray-500">{user.full_name}</p>}
          </div>
          <div>
            <p className="text-gray-600 uppercase tracking-wider mb-1">Demandé par</p>
            <p className="text-gray-300">{requester?.email ?? 'N/A'}</p>
            {requester?.is_admin && <span className="text-[9px] text-[#C9A84C]">ADMIN</span>}
            {requester?.is_delegate_admin && !requester?.is_admin && <span className="text-[9px] text-[#60A5FA]">DELEGUE</span>}
          </div>
          <div>
            <p className="text-gray-600 uppercase tracking-wider mb-1">Montant total</p>
            <p className="text-lg font-bold text-white">{Number(ticket.total_amount_eur).toFixed(2)} €</p>
          </div>
          <div>
            <p className="text-gray-600 uppercase tracking-wider mb-1">Créé le</p>
            <p className="text-gray-400">{formatDate(ticket.created_at)}</p>
          </div>
        </div>

        {/* Months breakdown */}
        {months.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Mois à rembourser</p>
            <div className="space-y-1">
              {months.map((m: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs bg-[#07090F] rounded-lg px-3 py-2">
                  <span className="text-gray-300">{m.plan ?? '—'}</span>
                  <span className="text-white font-medium">{Number(m.amount_eur).toFixed(2)} €</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {ticket.stripe_refund_ids?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Refunds Stripe</p>
            <p className="text-xs text-green-400 font-mono">{ticket.stripe_refund_ids.join(', ')}</p>
          </div>
        )}
      </div>

      {/* Raison */}
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-2">Raison</h2>
        <p className="text-sm text-gray-400 whitespace-pre-wrap">{ticket.reason}</p>
      </div>

      {/* Messages / Timeline */}
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Historique</h2>
        <div className="space-y-4">
          {messages.map((msg: any) => {
            const author = msg.author as any
            const actionLabels: Record<string, string> = {
              approve: 'a approuvé',
              reject: 'a refusé',
              request_info: 'a demandé des informations',
              respond: 'a répondu',
            }
            const actionLabel = msg.action ? (actionLabels[msg.action as string] ?? msg.action) : null

            return (
              <div key={msg.id} className="border-l-2 pl-4 py-1" style={{
                borderColor: msg.action === 'approve' ? '#22C55E'
                  : msg.action === 'reject' ? '#EF4444'
                  : msg.action === 'request_info' ? '#60A5FA'
                  : '#333'
              }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-white font-medium">{author?.email ?? '?'}</span>
                  {author?.is_admin && <span className="text-[8px] text-[#C9A84C] font-bold">ADMIN</span>}
                  {author?.is_delegate_admin && !author?.is_admin && <span className="text-[8px] text-[#60A5FA] font-bold">DELEGUE</span>}
                  {actionLabel && (
                    <span className="text-[10px] text-gray-500 italic">{actionLabel}</span>
                  )}
                  <span className="text-[10px] text-gray-600 ml-auto">{formatDate(msg.created_at)}</span>
                </div>
                <p className="text-sm text-gray-400 whitespace-pre-wrap">{msg.message}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      {!isTerminal && (
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Action</h2>

          <div className="flex gap-2 mb-4">
            {[
              { id: 'approve', label: 'Approuver', color: '#22C55E' },
              { id: 'reject', label: 'Refuser', color: '#EF4444' },
              { id: 'request_info', label: 'Demander infos', color: '#60A5FA' },
              { id: 'respond', label: 'Répondre', color: '#6B7280' },
            ].map(a => (
              <button key={a.id} onClick={() => setAction(a.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  action === a.id
                    ? 'border-transparent'
                    : 'border-white/5 text-gray-400'
                }`}
                style={action === a.id ? {
                  background: a.color + '20',
                  color: a.color,
                  borderColor: a.color + '40',
                } : undefined}
              >
                {a.label}
              </button>
            ))}
          </div>

          {action && (
            <div className="space-y-3">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={
                  action === 'approve' ? 'Commentaire de validation...'
                  : action === 'reject' ? 'Raison du refus...'
                  : action === 'request_info' ? 'Quelles informations supplémentaires ?'
                  : 'Votre message...'
                }
                className="w-full bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C9A84C]/50 resize-none"
                rows={3}
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAction}
                  disabled={submitting || !message.trim()}
                  className="px-5 py-2 bg-[#C9A84C] text-[#07090F] font-semibold text-sm rounded-xl hover:bg-[#C9A84C]/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Envoi...' : 'Envoyer'}
                </button>
                {submitMsg && (
                  <p className={`text-sm ${submitMsg.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                    {submitMsg.text}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
