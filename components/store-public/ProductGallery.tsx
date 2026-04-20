// © 2025-2026 Feel The Gap — product photo + video carousel (client)
'use client'

import { useState } from 'react'

export interface MediaItem {
  id: string
  type: 'photo' | 'video'
  url: string
  caption?: string | null
}

interface Props {
  media: MediaItem[]
  alt: string
}

export function ProductGallery({ media, alt }: Props) {
  const [active, setActive] = useState(0)
  if (media.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-white/5 bg-[#0D1117] text-5xl text-gray-700">
        <span aria-hidden>📦</span>
      </div>
    )
  }
  const current = media[active] ?? media[0]
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#0D1117]">
        {current.type === 'video' ? (
          isYouTubeOrVimeo(current.url) ? (
            <iframe
              key={current.id}
              src={toEmbed(current.url)}
              className="aspect-video w-full"
              allow="autoplay; fullscreen; picture-in-picture"
              title={current.caption || alt}
            />
          ) : (
            <video
              key={current.id}
              src={current.url}
              controls
              playsInline
              className="aspect-video w-full bg-black"
            />
          )
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current.id}
            src={current.url}
            alt={current.caption || alt}
            className="h-auto max-h-[600px] w-full object-contain"
          />
        )}
      </div>
      {media.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {media.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setActive(i)}
              className={`relative aspect-square overflow-hidden rounded-lg border ${
                i === active ? 'border-[#C9A84C]' : 'border-white/10 hover:border-white/20'
              }`}
              aria-label={`Voir média ${i + 1}`}
            >
              {m.type === 'video' ? (
                <div className="flex h-full w-full items-center justify-center bg-black/60 text-xs text-white">▶</div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={m.caption || alt} className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function isYouTubeOrVimeo(url: string): boolean {
  return /youtube\.com|youtu\.be|vimeo\.com/.test(url)
}

function toEmbed(url: string): string {
  // YouTube
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  // Vimeo
  const vm = url.match(/vimeo\.com\/(\d+)/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  return url
}
