'use client'

/**
 * /marketplace/messages — inbox des threads chat in-app marketplace
 */

import { useEffect, useState } from 'react'
import ThreadList, { Thread } from '@/components/marketplace/ThreadList'
import { supabase } from '@/lib/supabase'

export default function MessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      if (cancelled) return
      const isAuth = !!u?.user
      setAuthed(isAuth)
      if (!isAuth) { setLoading(false); return }
      const res = await fetch('/api/marketplace/messages', { credentials: 'include' })
      const json = res.ok ? await res.json() : { threads: [] }
      if (cancelled) return
      setThreads(json.threads ?? [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const unreadTotal = threads.reduce((s, t) => s + t.unread_count, 0)

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div>
          <div className="text-xs uppercase tracking-wider text-[#C9A84C]">Marketplace · Messages</div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Inbox
            {unreadTotal > 0 && (
              <span className="text-xs bg-[#C9A84C] text-[#07090F] rounded-full px-2 py-0.5">{unreadTotal} non lu</span>
            )}
          </h1>
        </div>

        {!authed && !loading && (
          <div className="p-6 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm text-amber-200">
            Connecte-toi pour voir tes messages.
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && authed && <ThreadList threads={threads} />}
      </div>
    </div>
  )
}
