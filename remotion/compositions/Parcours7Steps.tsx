/**
 * Parcours7Steps — 20s @ 30fps = 600 frames
 *
 * Le parcours FTG (Fiche pays → Store) en 7 chips animées, avec Production 3.0
 * encadré en or. Chaque chip s'anime à tour de rôle, les flèches relient la
 * séquence, et à la fin la 7e chip glow emerald (complétion).
 * Format 1920×1080.
 *
 * Timeline :
 *   0-2s   Titre "Le parcours entrepreneur · 7 étapes"
 *   2-15s  Chips 1→7 apparaissent une par une (0.7s chacune, 0.3s flèche)
 *   15-18s Zoom sur Production 3.0 (étape 3) — badge "NEW · PHASE 2"
 *   18-20s Outro "Marketplace B2B · Commission 2,5 %" + logo
 */
import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'

export const PARCOURS_7_STEPS_DURATION = 600
const FPS = 30

const GOLD = '#C9A84C'
const EMERALD = '#34D399'
const BG = '#07090F'

type Step = { icon: string; fr: string; highlight?: 'prod3' | 'complete' }
const STEPS: Step[] = [
  { icon: '🌍', fr: 'Fiche pays' },
  { icon: '📊', fr: "Rapport" },
  { icon: '🏭', fr: 'Méthodes de fabrication', highlight: 'prod3' },
  { icon: '💼', fr: 'Business plan' },
  { icon: '🎬', fr: 'Vidéos marché' },
  { icon: '🎯', fr: 'Clients potentiels' },
  { icon: '🎖️', fr: 'Synthèse', highlight: 'complete' },
]

export const Parcours7Steps: React.FC = () => {
  const f = useCurrentFrame()

  // Title 0-2s
  const titleOpacity = interpolate(f, [0, 20, 60, 80], [0, 1, 1, 0.6], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })
  const titleY = interpolate(f, [0, 20], [30, 0], { extrapolateRight: 'clamp' })

  // Each chip animates in at frame startFrame = 60 + i * 30 (so 1s per step)
  const chipStartFrames = STEPS.map((_, i) => 60 + i * 30)

  // Zoom on Production 3.0 starts at f=450 (15s)
  const zoomIn = interpolate(f, [450, 510], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const zoomOut = interpolate(f, [540, 600], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ background: BG, color: 'white', fontFamily: 'system-ui, sans-serif' }}>
      {/* Background grid */}
      <AbsoluteFill style={{ opacity: 0.04, backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      {/* Title */}
      <div style={{ position: 'absolute', top: 140, left: 0, right: 0, textAlign: 'center', opacity: titleOpacity, transform: `translateY(${titleY}px)` }}>
        <div style={{ fontSize: 20, letterSpacing: 6, color: GOLD, fontWeight: 600, marginBottom: 12 }}>FEEL THE GAP</div>
        <div style={{ fontSize: 60, fontWeight: 800 }}>Le parcours entrepreneur · 7 étapes</div>
        <div style={{ fontSize: 20, color: '#9CA3AF', marginTop: 10 }}>Un CTA unique par étape : <span style={{ color: GOLD, fontWeight: 600 }}>Étape suivante →</span></div>
      </div>

      {/* Chips row — horizontal timeline */}
      <div style={{
        position: 'absolute', top: 460, left: 60, right: 60,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
      }}>
        {STEPS.map((step, i) => {
          const start = chipStartFrames[i]
          const visible = f >= start
          const appearProgress = interpolate(f, [start, start + 20], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          })
          const opacity = appearProgress
          const scale = interpolate(appearProgress, [0, 0.6, 1], [0.7, 1.1, 1])
          const isProd3 = step.highlight === 'prod3'
          const isComplete = step.highlight === 'complete' && f >= chipStartFrames[6]
          const border = isProd3 ? GOLD : isComplete ? EMERALD : 'rgba(255,255,255,0.15)'
          const glow = isProd3 ? `0 0 40px ${GOLD}80` : isComplete ? `0 0 40px ${EMERALD}80` : 'none'

          return (
            <React.Fragment key={i}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                opacity, transform: `scale(${scale})`, transition: 'transform 0.3s',
                minWidth: 160,
              }}>
                {/* Step number chip */}
                <div style={{
                  fontSize: 12, letterSpacing: 3, color: isProd3 ? GOLD : isComplete ? EMERALD : '#6B7280',
                  fontWeight: 700, textTransform: 'uppercase',
                }}>
                  ÉTAPE {i + 1}
                </div>
                {/* Chip */}
                <div style={{
                  width: 120, height: 120, borderRadius: 60,
                  background: isProd3 ? `${GOLD}15` : isComplete ? `${EMERALD}15` : 'rgba(255,255,255,0.04)',
                  border: `2px solid ${border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 56, boxShadow: glow,
                }}>
                  {step.icon}
                </div>
                {/* Label */}
                <div style={{
                  fontSize: 14, textAlign: 'center', lineHeight: 1.2, maxWidth: 140,
                  color: isProd3 ? GOLD : isComplete ? EMERALD : 'white',
                  fontWeight: isProd3 || isComplete ? 700 : 500,
                }}>
                  {step.fr}
                </div>
                {isProd3 && visible && (
                  <div style={{
                    fontSize: 9, letterSpacing: 2, color: GOLD, fontWeight: 700,
                    padding: '3px 8px', background: `${GOLD}20`, borderRadius: 10,
                  }}>PRODUCTION 3.0</div>
                )}
              </div>
              {/* Arrow between chips (not after last) */}
              {i < STEPS.length - 1 && (
                <div style={{
                  opacity: f >= start + 18 ? 0.6 : 0,
                  fontSize: 24, color: '#6B7280',
                }}>→</div>
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* "Retour à la carte" button reminder (bottom-left hint) */}
      {f >= 60 && f < 450 && (
        <div style={{
          position: 'absolute', bottom: 120, left: 60,
          fontSize: 14, color: '#6B7280',
          opacity: interpolate(f, [60, 90, 420, 450], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}>
          <div style={{ letterSpacing: 2, color: '#6B7280', marginBottom: 4 }}>ÉTAPE 1 · BOUTON GAUCHE</div>
          <div style={{ fontSize: 18, color: 'white' }}>🗺️ Retour à la carte</div>
        </div>
      )}

      {/* Zoom overlay on Production 3.0 (15-18s) */}
      {f >= 450 && f <= 540 && (
        <AbsoluteFill style={{ background: `rgba(7,9,15,${zoomIn * 0.7})`, justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ opacity: zoomIn, textAlign: 'center' }}>
            <div style={{ fontSize: 14, letterSpacing: 6, color: GOLD, fontWeight: 700, marginBottom: 12 }}>PRODUCTION 3.0</div>
            <div style={{ fontSize: 56, fontWeight: 800, marginBottom: 16 }}>🏭 Méthodes de fabrication</div>
            <div style={{ fontSize: 22, color: '#D1D5DB', maxWidth: 820, lineHeight: 1.4 }}>
              Comparateur multi-critères : coût × temps × qualité × capex × opex. <br />
              Score pondéré <b style={{ color: GOLD }}>0-100</b> en live, édition des cellules,
              gating <b style={{ color: GOLD }}>Premium 149 €</b> et <b style={{ color: GOLD }}>Ultimate 299 €</b>.
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* Outro 18-20s */}
      {f >= 540 && (
        <AbsoluteFill style={{ background: `rgba(7,9,15,${zoomOut})`, justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ opacity: zoomOut, textAlign: 'center' }}>
            <div style={{ fontSize: 72, fontWeight: 900, color: GOLD, lineHeight: 1 }}>Feel The Gap</div>
            <div style={{ fontSize: 24, color: 'white', opacity: 0.8, marginTop: 16 }}>
              Parcours entrepreneur · Marketplace B2B · Commission 2,5 %
            </div>
            <div style={{ fontSize: 16, color: '#9CA3AF', marginTop: 12 }}>feel-the-gap.com</div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}
