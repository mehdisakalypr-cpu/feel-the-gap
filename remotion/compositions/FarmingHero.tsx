/**
 * FarmingHero — bannière vivante pour /farming (loop 8s @ 30fps = 240 frames).
 * Montre l'essence: pins qui pulsent sur la carte + 4 agents qui orbitent
 * (scout / enrich / score / match), connectés par des arcs lumineux.
 *
 * Embed via <Player> avec autoPlay+loop sur la page farming.
 */
import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'

export const FARMING_HERO_DURATION = 240 // 8s @ 30fps

const BRAND = '#C9A84C'
const BG_DARK = '#07090F'

// 16 pins répartis sur 3 continents (Afrique, Asie, Amériques) — coords [0-1]
const PINS: Array<[number, number]> = [
  [0.22, 0.50], [0.28, 0.55], [0.25, 0.62], [0.30, 0.70],
  [0.52, 0.48], [0.49, 0.55], [0.52, 0.62], [0.54, 0.68], [0.50, 0.72],
  [0.72, 0.45], [0.68, 0.50], [0.74, 0.55], [0.70, 0.58],
  [0.76, 0.48], [0.78, 0.62], [0.66, 0.60],
]

// 4 agents tournant autour d'un pin central
const AGENTS = [
  { label: 'SCOUT',   emoji: '🔭', color: '#60A5FA' },
  { label: 'ENRICH',  emoji: '🌾', color: '#34D399' },
  { label: 'SCORE',   emoji: '⚡', color: '#C9A84C' },
  { label: 'MATCH',   emoji: '🤝', color: '#A78BFA' },
]

export const FarmingHero: React.FC = () => {
  const frame = useCurrentFrame()
  const W = 1600
  const H = 600

  return (
    <AbsoluteFill style={{
      background: `radial-gradient(ellipse at 70% 50%, rgba(201,168,76,0.12) 0%, ${BG_DARK} 70%)`,
      color: 'white',
      fontFamily: 'Inter, system-ui, sans-serif',
      overflow: 'hidden',
    }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0 }}>
        {/* Pins pulsants */}
        {PINS.map(([x, y], i) => {
          const appearAt = (i * 240) / PINS.length * 0.5
          const progress = interpolate(frame, [appearAt, appearAt + 20], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          })
          const phase = (frame - appearAt) / 30
          const pulse = 0.85 + Math.sin(phase * Math.PI) * 0.15
          const cx = x * W, cy = y * H
          return (
            <g key={i} opacity={progress}>
              <circle cx={cx} cy={cy} r={24 * pulse} fill={BRAND} opacity={0.12 * pulse} />
              <circle cx={cx} cy={cy} r={14 * pulse} fill={BRAND} opacity={0.22 * pulse} />
              <circle cx={cx} cy={cy} r={5} fill={BRAND} />
            </g>
          )
        })}

        {/* Pin "focus" + 4 agents orbitants */}
        <g transform={`translate(${W * 0.85} ${H * 0.5})`}>
          <circle r={60} fill={BRAND} opacity={0.08} />
          <circle r={30} fill={BRAND} opacity={0.15} />
          <circle r={8} fill={BRAND} />
          {AGENTS.map((a, i) => {
            const angle = (frame / 60) * Math.PI + (i * Math.PI) / 2
            const r = 130
            const ax = Math.cos(angle) * r
            const ay = Math.sin(angle) * r
            return (
              <g key={a.label} transform={`translate(${ax} ${ay})`}>
                <circle r={26} fill={BG_DARK} stroke={a.color} strokeWidth={1.5} />
                <text x={0} y={8} textAnchor="middle" fontSize={22}>{a.emoji}</text>
              </g>
            )
          })}
        </g>
      </svg>

      {/* Texte gauche */}
      <div style={{
        position: 'absolute', left: 64, top: '50%', transform: 'translateY(-50%)', maxWidth: 560,
      }}>
        <div style={{
          fontSize: 13, letterSpacing: 6, textTransform: 'uppercase',
          color: BRAND, marginBottom: 16,
        }}>
          Intelligence agricole · 198 pays
        </div>
        <h1 style={{
          fontFamily: 'Instrument Serif, Georgia, serif', fontSize: 68, lineHeight: 1.05,
          color: 'white', margin: 0, fontWeight: 400,
        }}>
          Du champ au <span style={{ color: BRAND }}>contrat export</span>
        </h1>
        <p style={{ fontSize: 19, color: 'rgba(255,255,255,0.7)', marginTop: 20, lineHeight: 1.5 }}>
          4 agents IA scannent en continu les marchés qui achètent votre filière.
          On vous montre le canal, le prix, les marges, les prochaines étapes.
        </p>
      </div>
    </AbsoluteFill>
  )
}
