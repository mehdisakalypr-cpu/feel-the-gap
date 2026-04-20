'use client'

import Link from 'next/link'

export type Thread = {
  thread_id: string
  other_user_id: string
  rfq_id: string | null
  last_body: string
  last_at: string
  unread_count: number
}

export default function ThreadList({ threads }: { threads: Thread[] }) {
  if (threads.length === 0) {
    return (
      <div className="p-8 text-center bg-white/[.02] border border-white/5 rounded-xl">
        <p className="text-sm text-gray-400">Aucune conversation pour l'instant.</p>
      </div>
    )
  }
  return (
    <div className="divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden">
      {threads.map((t) => (
        <Link
          key={t.thread_id}
          href={`/marketplace/messages/${t.thread_id}`}
          className="flex items-center justify-between gap-4 p-4 bg-[#0D1117] hover:bg-white/5 transition-colors"
        >
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="truncate">{t.other_user_id.slice(0, 8)}…</span>
              {t.rfq_id && (
                <span className="text-[10px] uppercase tracking-wider text-[#C9A84C] bg-[#C9A84C]/10 px-1.5 py-0.5 rounded">
                  RFQ
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 truncate mt-0.5">{t.last_body}</div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="text-[11px] text-gray-500 whitespace-nowrap">
              {new Date(t.last_at).toLocaleDateString('fr-FR')}
            </div>
            {t.unread_count > 0 && (
              <span className="text-[10px] font-bold bg-[#C9A84C] text-[#07090F] rounded-full px-2 py-0.5">
                {t.unread_count}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
