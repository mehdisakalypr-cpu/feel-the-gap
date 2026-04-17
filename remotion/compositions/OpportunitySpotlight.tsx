/**
 * OpportunitySpotlight — 15s @ 30fps = 450 frames · 1080x1920 (vertical 9:16)
 * Single-country opportunity reveal for social reels / TikTok / Shorts.
 *
 * Timeline:
 *   0-1s   fade-in flag + country name
 *   1-3s   product line slides up
 *   3-5s   metric 1 counter (gap value)
 *   5-7s   metric 2 counter (score /100)
 *   7-10s  "action" hook (3 plans icons cascade)
 *   10-13s CTA "feelthegap.world" pulse
 *   13-15s end card logo
 */
import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion'

export const OPPORTUNITY_SPOTLIGHT_DURATION = 450

type Props = {
  flag?: string
  country?: string
  product?: string
  gapValueEur?: number
  score?: number
  tagline?: string
}

const GOLD = '#C9A84C'
const GOLD_LIGHT = '#E8C97A'
const GREEN = '#34D399'
const BG = '#07090F'

function fmtEur(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'Mrd €'
  if (n >= 1e6) return (n / 1e6).toFixed(0) + ' M€'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' k€'
  return n.toLocaleString('fr-FR') + ' €'
}

export const OpportunitySpotlight: React.FC<Props> = ({
  flag = '🇲🇦',
  country = 'Maroc',
  product = 'Huile d\'olive bio',
  gapValueEur = 12_800_000,
  score = 87,
  tagline = 'Importez ce que le pays ne produit plus.',
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Fade-in flag + country (0-1s)
  const flagOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' })
  const flagScale = spring({ frame, fps, config: { damping: 12, stiffness: 80 } })

  // Product slide-up (1-3s)
  const productY = interpolate(frame, [30, 75], [60, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  })
  const productOpacity = interpolate(frame, [30, 75], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })

  // Gap value counter (3-5s)
  const gapCounterOpacity = interpolate(frame, [90, 120], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
  const gapCounterValue = interpolate(frame, [90, 180], [0, gapValueEur], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  })

  // Score counter (5-7s)
  const scoreOpacity = interpolate(frame, [150, 180], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
  const scoreValue = interpolate(frame, [150, 240], [0, score], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  })
  const scoreArcProgress = interpolate(frame, [150, 240], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  })

  // 3 plans cascade (7-10s)
  const plansOpacity = interpolate(frame, [210, 270], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })

  // CTA pulse (10-13s)
  const ctaOpacity = interpolate(frame, [300, 330], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
  const ctaPulse = 1 + Math.sin((frame - 300) / 8) * 0.03

  // End card (13-15s)
  const finalFade = interpolate(frame, [390, 420], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const endOpacity = interpolate(frame, [410, 440], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{
      background: `radial-gradient(ellipse at top, #0D1117 0%, ${BG} 60%, ${BG} 100%)`,
      color: 'white', fontFamily: 'Inter, system-ui, sans-serif',
      padding: '80px 60px', alignItems: 'center',
    }}>
      <AbsoluteFill style={{ opacity: finalFade, alignItems: 'center', padding: '80px 60px' }}>
        {/* Flag + country */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          opacity: flagOpacity, transform: `scale(${flagScale})`, transformOrigin: 'center',
        }}>
          <div style={{ fontSize: 180, lineHeight: 1 }}>{flag}</div>
          <div style={{
            fontSize: 72, fontFamily: 'Instrument Serif, Georgia, serif',
            color: 'white', letterSpacing: -1,
          }}>{country}</div>
        </div>

        {/* Product */}
        <div style={{
          marginTop: 30,
          transform: `translateY(${productY}px)`, opacity: productOpacity,
          padding: '14px 28px', borderRadius: 999,
          background: 'rgba(201,168,76,.12)', border: `2px solid ${GOLD}`,
          fontSize: 42, fontWeight: 600, color: GOLD,
        }}>
          {product}
        </div>

        {/* Gap value */}
        <div style={{
          marginTop: 60, textAlign: 'center', opacity: gapCounterOpacity,
        }}>
          <div style={{
            fontSize: 26, color: 'rgba(255,255,255,.55)',
            letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10,
          }}>Gap à combler</div>
          <div style={{
            fontSize: 130, fontFamily: 'Instrument Serif, Georgia, serif',
            color: GOLD, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          }}>{fmtEur(Math.round(gapCounterValue))}</div>
          <div style={{
            fontSize: 22, color: 'rgba(255,255,255,.45)', marginTop: 6,
          }}>par an · marché adressable</div>
        </div>

        {/* Score */}
        <div style={{
          marginTop: 50, display: 'flex', alignItems: 'center', gap: 30,
          opacity: scoreOpacity,
        }}>
          <ScoreDial progress={scoreArcProgress} value={Math.round(scoreValue)} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 20, color: 'rgba(255,255,255,.5)', letterSpacing: 2, textTransform: 'uppercase' }}>
              Score opportunité
            </div>
            <div style={{ fontSize: 38, color: 'white', marginTop: 4 }}>
              {score >= 85 ? 'Priorité haute' : score >= 70 ? 'Solide' : 'À creuser'}
            </div>
          </div>
        </div>

        {/* 3 plans cascade */}
        <div style={{
          marginTop: 60, display: 'flex', gap: 14, opacity: plansOpacity,
        }}>
          {[
            { label: 'Import & revente', icon: '🚢', color: '#60A5FA' },
            { label: 'Production locale', icon: '🏭', color: GREEN },
            { label: 'Formation', icon: '🤝', color: GOLD },
          ].map((p, i) => (
            <PlanChip key={p.label} {...p} delayFrame={210 + i * 10} />
          ))}
        </div>

        {/* CTA */}
        <div style={{
          marginTop: 60, opacity: ctaOpacity,
          transform: `scale(${ctaPulse})`,
          padding: '22px 48px', borderRadius: 999,
          background: `linear-gradient(135deg, ${GREEN} 0%, #10B981 100%)`,
          color: BG, fontSize: 36, fontWeight: 700,
          boxShadow: `0 0 80px ${GREEN}55`,
        }}>
          feelthegap.world →
        </div>

        {/* Tagline */}
        <div style={{
          position: 'absolute', bottom: 100, left: 0, right: 0,
          textAlign: 'center', opacity: plansOpacity,
          fontFamily: 'Instrument Serif, Georgia, serif',
          fontSize: 40, color: 'rgba(255,255,255,.7)',
          maxWidth: 900, margin: '0 auto', padding: '0 60px',
        }}>
          « {tagline} »
        </div>
      </AbsoluteFill>

      {/* End card */}
      <AbsoluteFill style={{
        opacity: endOpacity, background: BG,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: 'Instrument Serif, Georgia, serif',
            fontSize: 90, color: GOLD, letterSpacing: -1, lineHeight: 1,
          }}>FEEL THE GAP</div>
          <div style={{
            fontSize: 22, color: 'rgba(255,255,255,.6)', marginTop: 16,
            letterSpacing: 4, textTransform: 'uppercase',
          }}>198 pays · 19 800 opportunités</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function ScoreDial({ progress, value }: { progress: number; value: number }) {
  const size = 160
  const stroke = 10
  const radius = (size - stroke) / 2
  const circ = 2 * Math.PI * radius
  const offset = circ * (1 - progress)
  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="rgba(255,255,255,.1)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={GOLD_LIGHT} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 56, fontFamily: 'Instrument Serif, Georgia, serif', color: 'white',
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  )
}

function PlanChip({ label, icon, color, delayFrame }: { label: string; icon: string; color: string; delayFrame: number }) {
  const frame = useCurrentFrame()
  const appear = interpolate(frame, [delayFrame, delayFrame + 15], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
  const y = interpolate(appear, [0, 1], [20, 0])
  return (
    <div style={{
      opacity: appear, transform: `translateY(${y}px)`,
      padding: '18px 22px', borderRadius: 16,
      background: `${color}15`, border: `1.5px solid ${color}55`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      minWidth: 180,
    }}>
      <div style={{ fontSize: 46 }}>{icon}</div>
      <div style={{ fontSize: 22, color, fontWeight: 600, textAlign: 'center' }}>{label}</div>
    </div>
  )
}
