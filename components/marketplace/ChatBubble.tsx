'use client'

/**
 * ChatBubble — affichage d'un message in-app marketplace.
 * Couleur or si moi (#C9A84C), gris si l'autre.
 */
export type ChatBubbleProps = {
  body: string
  mine: boolean
  createdAt: string
  read?: boolean
}

export default function ChatBubble({ body, mine, createdAt, read }: ChatBubbleProps) {
  const ts = new Date(createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm border ${
          mine
            ? 'bg-[#C9A84C]/15 border-[#C9A84C]/30 text-white'
            : 'bg-white/5 border-white/10 text-gray-100'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{body}</div>
        <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-1 justify-end">
          <span>{ts}</span>
          {mine && <span>{read ? 'lu' : 'envoyé'}</span>}
        </div>
      </div>
    </div>
  )
}
