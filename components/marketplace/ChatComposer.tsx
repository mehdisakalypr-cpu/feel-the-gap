'use client'

import { useState, FormEvent } from 'react'

export type ChatComposerProps = {
  onSend: (body: string) => Promise<void> | void
  disabled?: boolean
  placeholder?: string
}

export default function ChatComposer({ onSend, disabled, placeholder }: ChatComposerProps) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || sending || disabled) return
    setSending(true)
    try {
      await onSend(trimmed)
      setBody('')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2 p-3 bg-[#0D1117] border-t border-white/10">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={1}
        disabled={disabled || sending}
        placeholder={placeholder ?? 'Écrire un message…'}
        className="flex-1 resize-none bg-[#07090F] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[#C9A84C]/40 focus:outline-none disabled:opacity-50"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit(e as unknown as FormEvent)
          }
        }}
        maxLength={8000}
      />
      <button
        type="submit"
        disabled={disabled || sending || !body.trim()}
        className="px-4 py-2 bg-[#C9A84C] text-[#07090F] font-bold text-sm rounded-lg hover:bg-[#E8C97A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {sending ? '…' : 'Envoyer'}
      </button>
    </form>
  )
}
