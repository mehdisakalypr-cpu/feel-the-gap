'use client'
import { useEffect, useState } from 'react'

/**
 * 🍴 Eishi — "Synthèse en cours" waiting screen.
 *
 * Replaces empty / thin sections for paid users. Polls /api/content/status
 * every 5s until the requested section flips to `ready`, then calls onReady
 * so the parent can render the fresh content.
 */

type SectionState = 'ready' | 'thin' | 'missing' | 'generating'

interface StatusResponse {
  sections: Record<string, { key: string; state: SectionState; enqueued: boolean }>
}

export default function SectionSynthesizing({
  oppId,
  country,
  lang = 'fr',
  section,
  label,
  icon = '🍴',
  onReady,
  compact = false,
}: {
  oppId: string
  country: string
  lang?: string
  section: string       // 'production_methods' | 'business_plans' | 'potential_clients' | 'youtube_videos'
  label: string         // "Vos vidéos" | "Votre business plan premium" etc.
  icon?: string
  onReady: () => void
  compact?: boolean
}) {
  const [elapsed, setElapsed] = useState(0)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    let interval: any = null

    const tick = async () => {
      setAttempt((n) => n + 1)
      try {
        const params = new URLSearchParams({ opp_id: oppId, country, lang, enqueue: attempt === 0 ? '1' : '0' })
        // Cookie-based auth: cookies are sent automatically. The API reads
        // the session via @supabase/ssr and only enqueues for paid tiers.
        const res = await fetch(`/api/content/status?${params.toString()}`, { credentials: 'include', cache: 'no-store' })
        if (!res.ok || cancelled) return
        const json: StatusResponse = await res.json()
        const state = json.sections?.[section]?.state
        if (state === 'ready' && !cancelled) {
          onReady()
        }
      } catch {
        // Network hiccup — keep polling
      }
    }

    // First poll immediately so Eishi enqueues ASAP
    tick()
    interval = setInterval(() => {
      setElapsed((s) => s + 5)
      tick()
    }, 5000)

    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oppId, country, lang, section])

  const etaLabel = elapsed < 30 ? '< 30s' : elapsed < 90 ? '~ 1 min' : elapsed < 180 ? '~ 2 min' : 'synthèse longue…'

  const box = compact ? { padding: '1.5rem' } : { padding: '3rem 2rem' }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(201,168,76,.08), rgba(201,168,76,.02))',
      border: '1px solid rgba(201,168,76,.25)',
      borderRadius: 12,
      textAlign: 'center',
      color: '#E2E8F0',
      ...box,
    }}>
      <div style={{ fontSize: compact ? 28 : 42, marginBottom: '0.75rem' }}>{icon}</div>
      <div style={{ fontSize: compact ? 14 : 17, fontWeight: 700, color: '#C9A84C', marginBottom: '0.5rem' }}>
        Synthèse en cours — {label}
      </div>
      <div style={{ fontSize: 13, color: '#94A3B8', maxWidth: 480, margin: '0 auto 1rem', lineHeight: 1.5 }}>
        Nous adaptons les données spécifiquement à votre projet. Cette section se remplira automatiquement.
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94A3B8' }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: '#10B981',
          animation: 'pulse 1.4s ease-in-out infinite',
        }} />
        <span>ETA {etaLabel}</span>
      </div>
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }
      `}</style>
    </div>
  )
}
