/**
 * FarmingLoadingScan — remplace le spinner pendant un scan /api/opportunity-scanner.
 * Durée 6s loop. Montre les 4 étapes séquentielles: SCOUT → ENRICH → SCORE → MATCH
 * avec progress bars individuelles et labels qui "cochent" quand une étape se termine.
 */
import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'

export const FARMING_LOADING_DURATION = 180 // 6s @ 30fps

const STEPS = [
  { label: 'SCOUT',  sub: 'Recherche marchés & acheteurs', color: '#60A5FA', emoji: '🔭' },
  { label: 'ENRICH', sub: 'Enrichit prix, volumes, réglementation', color: '#34D399', emoji: '🌾' },
  { label: 'SCORE',  sub: 'Score risque · marge · time-to-market', color: '#C9A84C', emoji: '⚡' },
  { label: 'MATCH',  sub: 'Sélectionne les canaux recommandés', color: '#A78BFA', emoji: '🤝' },
] as const

const STEP_LEN = FARMING_LOADING_DURATION / STEPS.length // 45 frames par étape

export const FarmingLoadingScan: React.FC = () => {
  const frame = useCurrentFrame()

  return (
    <AbsoluteFill style={{
      background: '#0D1117',
      color: 'white',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '48px 56px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 18,
    }}>
      <div style={{
        fontSize: 12, letterSpacing: 6, textTransform: 'uppercase',
        color: '#C9A84C', marginBottom: 4,
      }}>Scan en cours</div>
      <div style={{
        fontFamily: 'Instrument Serif, Georgia, serif', fontSize: 38, color: 'white', marginBottom: 16,
      }}>
        Les agents cherchent vos meilleures opportunités…
      </div>
      {STEPS.map((s, i) => {
        const startF = i * STEP_LEN
        const endF = startF + STEP_LEN
        const progress = interpolate(frame, [startF, endF], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        })
        const isActive = frame >= startF && frame < endF
        const isDone = frame >= endF
        return (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: isActive || isDone ? 1 : 0.35 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isDone ? s.color + '22' : isActive ? s.color + '15' : 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${isActive ? s.color : isDone ? s.color + '88' : 'rgba(255,255,255,0.08)'}`,
              fontSize: 22,
            }}>
              {isDone ? '✓' : s.emoji}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{
                  fontSize: 13, letterSpacing: 3, textTransform: 'uppercase',
                  color: isActive || isDone ? s.color : 'rgba(255,255,255,0.5)',
                  fontWeight: 700,
                }}>{s.label}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{s.sub}</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${progress * 100}%`, background: s.color,
                  transition: 'none',
                }} />
              </div>
            </div>
          </div>
        )
      })}
    </AbsoluteFill>
  )
}
