'use client'

/**
 * /marketplace/messages/[thread_id] — chat UI temps réel via Supabase Realtime
 */

import { useEffect, useState, useRef, use } from 'react'
import Link from 'next/link'
import ChatBubble from '@/components/marketplace/ChatBubble'
import ChatComposer from '@/components/marketplace/ChatComposer'
import { createSupabaseBrowser } from '@/lib/supabase'

type Message = {
  id: string
  thread_id: string
  sender_user_id: string
  recipient_user_id: string
  rfq_id: string | null
  body: string
  read_at: string | null
  created_at: string
}

export default function ThreadPage({ params }: { params: Promise<{ thread_id: string }> }) {
  const { thread_id } = use(params)
  const [messages, setMessages] = useState<Message[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [otherUserId, setOtherUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    })
  }

  useEffect(() => {
    const sb = createSupabaseBrowser()
    let active = true
    let channel: ReturnType<typeof sb.channel> | null = null

    ;(async () => {
      const { data: u } = await sb.auth.getUser()
      if (!active) return
      const uid = u?.user?.id ?? null
      setUserId(uid)

      const res = await fetch(`/api/marketplace/messages/${thread_id}`, { credentials: 'include' })
      const json = res.ok ? await res.json() : { messages: [] }
      if (!active) return

      const msgs = (json.messages ?? []) as Message[]
      setMessages(msgs)

      // Détermine l'autre user
      if (uid && msgs.length > 0) {
        const m0 = msgs[0]
        setOtherUserId(m0.sender_user_id === uid ? m0.recipient_user_id : m0.sender_user_id)
      }

      // Mark as read
      await fetch(`/api/marketplace/messages/${thread_id}/read`, { method: 'PATCH', credentials: 'include' })

      setLoading(false)
      scrollToBottom()

      // Realtime subscription
      channel = sb
        .channel(`thread:${thread_id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'marketplace_messages',
          filter: `thread_id=eq.${thread_id}`,
        }, (payload) => {
          const newMsg = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          scrollToBottom()
          // Mark as read si c'est pour moi
          if (uid && newMsg.recipient_user_id === uid) {
            fetch(`/api/marketplace/messages/${thread_id}/read`, { method: 'PATCH', credentials: 'include' }).catch(() => {})
          }
        })
        .subscribe()
    })()

    return () => {
      active = false
      if (channel) sb.removeChannel(channel)
    }
  }, [thread_id])

  async function send(body: string) {
    if (!otherUserId) return
    const res = await fetch('/api/marketplace/messages', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient_user_id: otherUserId,
        thread_id,
        body,
      }),
    })
    if (!res.ok) {
      console.error('[chat] send failed', await res.text())
    }
    // Pas besoin d'optimistic update : la realtime subscription le récupèrera.
  }

  return (
    <div className="min-h-screen bg-[#07090F] text-white flex flex-col">
      <div className="max-w-3xl w-full mx-auto px-4 py-6 flex flex-col flex-1 min-h-0">
        <Link href="/marketplace/messages" className="text-xs text-[#C9A84C] hover:underline mb-3">
          ← Inbox
        </Link>

        <div className="bg-[#0D1117] border border-white/10 rounded-2xl flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <div className="text-xs uppercase tracking-wider text-[#C9A84C]">Conversation</div>
            {otherUserId && (
              <div className="text-sm font-semibold mt-0.5">avec {otherUserId.slice(0, 8)}…</div>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
            {loading && (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!loading && messages.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Aucun message. Lance la conversation.</p>
            )}
            {!loading && messages.map((m) => (
              <ChatBubble
                key={m.id}
                body={m.body}
                mine={m.sender_user_id === userId}
                createdAt={m.created_at}
                read={!!m.read_at}
              />
            ))}
          </div>

          <ChatComposer onSend={send} disabled={!otherUserId} />
        </div>
      </div>
    </div>
  )
}
