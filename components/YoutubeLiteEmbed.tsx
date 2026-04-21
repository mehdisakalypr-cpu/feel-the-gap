'use client'
import { useState } from 'react'

type Video = {
  videoId: string
  title: string
  channelTitle: string
  thumbnailUrl: string
  publishedAt?: string
  viewCount?: number
  hasCaptions?: boolean
  defaultLanguage?: string
}

// Facade pattern: render thumbnail until user clicks, then swap to iframe.
// Iframe forces captions ON in the user's preferred language via cc_load_policy + cc_lang_pref.
// If the video has captions only in another language, YouTube auto-translates when available.
export default function YoutubeLiteEmbed({ video, userLang = 'fr' }: { video: Video; userLang?: string }) {
  const [playing, setPlaying] = useState(false)

  // Use youtube-nocookie for privacy (no cookies set until user clicks play).
  const embedUrl =
    `https://www.youtube-nocookie.com/embed/${video.videoId}` +
    `?autoplay=1&rel=0&modestbranding=1` +
    `&cc_load_policy=1&cc_lang_pref=${userLang}&hl=${userLang}`

  const needsTranslation = video.defaultLanguage && video.defaultLanguage.split('-')[0] !== userLang
  const canShowCaptions = video.hasCaptions !== false  // treat undefined as possibly yes

  return (
    <div style={{ background: '#0F172A', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', background: '#000' }}>
        {playing ? (
          <iframe
            src={embedUrl}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Lire : ${video.title}`}
            style={{
              position: 'absolute', inset: 0, cursor: 'pointer', border: 0, padding: 0,
              background: `url(${video.thumbnailUrl}) center/cover no-repeat`,
            }}
          >
            <span style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              width: 68, height: 48, background: 'rgba(0,0,0,.75)', borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ width: 0, height: 0, borderLeft: '18px solid white', borderTop: '11px solid transparent', borderBottom: '11px solid transparent', marginLeft: 4 }} />
            </span>
            {canShowCaptions && needsTranslation && (
              <span style={{
                position: 'absolute', top: 8, right: 8,
                background: 'rgba(16,185,129,.9)', color: '#000', fontSize: 11, fontWeight: 700,
                padding: '3px 8px', borderRadius: 4,
              }}>
                ST {userLang.toUpperCase()}
              </span>
            )}
          </button>
        )}
      </div>
      <div style={{ padding: '0.75rem' }}>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, color: '#E2E8F0', minHeight: 40 }}>
          {video.title.slice(0, 90)}
        </div>
        <div style={{ color: '#94A3B8', fontSize: 12, marginTop: '0.5rem' }}>{video.channelTitle}</div>
        {(video.viewCount || video.publishedAt) && (
          <div style={{ color: '#94A3B8', fontSize: 11, marginTop: '0.25rem' }}>
            {video.viewCount ? `${video.viewCount.toLocaleString()} vues` : ''}
            {video.viewCount && video.publishedAt ? ' · ' : ''}
            {video.publishedAt ? new Date(video.publishedAt).toLocaleDateString('fr-FR') : ''}
          </div>
        )}
      </div>
    </div>
  )
}
