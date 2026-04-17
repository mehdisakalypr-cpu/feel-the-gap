/**
 * PlansReveal — 12s @ 30fps = 360 frames · 1080x1080 (square, Instagram/LinkedIn feed)
 * Value-prop video showing the 3 FTG plans with geo-pricing hint.
 *
 * Timeline:
 *   0-1s   brand logo
 *   1-2s   "Choisissez votre offre" appears
 *   2-7s   3 plans cascade in (Data → Strategy → Premium)
 *   7-9s   geo-pricing footer reveal
 *   9-11s  CTA "feelthegap.world/pricing"
 *   11-12s end card
 */
import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion'

export const PLANS_REVEAL_DURATION = 360

const BG = '#07090F'
const GOLD = '#C9A84C'
const GREEN = '#34D399'
const BLUE = '#60A5FA'
const PURPLE = '#A78BFA'

type Plan = {
  label: string
  price: string
  sub: string
  perks: string[]
  color: string
  featured?: boolean
}

const PLANS: Plan[] = [
  {
    label: 'Data',
    price: '29€',
    sub: 'par mois',
    color: BLUE,
    perks: ['Carte 198 pays', 'Rapports PDF', '50 recherches/mo'],
  },
  {
    label: 'Strategy',
    price: '99€',
    sub: 'par mois',
    color: GOLD,
    featured: true,
    perks: ['Tout Data +', '3 dossiers financement / mo', 'Business plans IA'],
  },
  {
    label: 'Premium',
    price: '149€',
    sub: 'par mois',
    color: PURPLE,
    perks: ['Tout Strategy +', 'Illimité dossiers', 'Matching investisseurs'],
  },
]

export const PlansReveal: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const logoOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })
  const logoScale = spring({ frame, fps, config: { damping: 14, stiffness: 90 } })

  const titleOpacity = interpolate(frame, [30, 60], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
  const titleY = interpolate(frame, [30, 60], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  const geoOpacity = interpolate(frame, [210, 270], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
  const ctaOpacity = interpolate(frame, [270, 300], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
  const ctaPulse = 1 + Math.sin((frame - 270) / 8) * 0.03

  const finalFade = interpolate(frame, [320, 350], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const endOpacity = interpolate(frame, [340, 360], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{
      background: `radial-gradient(ellipse at top, #0D1117 0%, ${BG} 70%)`,
      color: 'white', fontFamily: 'Inter, system-ui, sans-serif',
      padding: 60, alignItems: 'center',
    }}>
      <AbsoluteFill style={{ opacity: finalFade, alignItems: 'center', padding: 60 }}>
        {/* Brand logo */}
        <div style={{
          opacity: logoOpacity, transform: `scale(${logoScale})`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          marginTop: 20,
        }}>
          <div style={{
            fontFamily: 'Instrument Serif, Georgia, serif',
            fontSize: 54, color: GOLD, letterSpacing: -1, lineHeight: 1,
          }}>FEEL THE GAP</div>
        </div>

        {/* Title */}
        <div style={{
          marginTop: 30, opacity: titleOpacity, transform: `translateY(${titleY}px)`,
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 48, fontFamily: 'Instrument Serif, Georgia, serif',
            color: 'white', lineHeight: 1.1, letterSpacing: -1,
          }}>Choisissez votre offre</div>
          <div style={{
            fontSize: 20, color: 'rgba(255,255,255,.55)', marginTop: 8,
            letterSpacing: 3, textTransform: 'uppercase',
          }}>Trade Intelligence · 198 pays</div>
        </div>

        {/* 3 plans cascade */}
        <div style={{
          marginTop: 50, display: 'flex', gap: 14, alignItems: 'stretch',
        }}>
          {PLANS.map((p, i) => (
            <PlanCard key={p.label} plan={p} delayFrame={70 + i * 30} />
          ))}
        </div>

        {/* Geo-pricing notice */}
        <div style={{
          marginTop: 30, opacity: geoOpacity,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 20px', borderRadius: 999,
          background: 'rgba(52,211,153,.1)', border: `1px solid ${GREEN}44`,
          fontSize: 18, color: GREEN, fontWeight: 600,
        }}>
          <span>🌍</span>
          <span>Prix adaptés à votre pays · jusqu'à -60%</span>
        </div>

        {/* CTA */}
        <div style={{
          marginTop: 24, opacity: ctaOpacity, transform: `scale(${ctaPulse})`,
          padding: '18px 38px', borderRadius: 999,
          background: `linear-gradient(135deg, ${GREEN}, #10B981)`,
          color: BG, fontSize: 28, fontWeight: 700,
          boxShadow: `0 0 60px ${GREEN}55`,
        }}>
          feelthegap.world/pricing →
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
            fontSize: 76, color: GOLD, letterSpacing: -1, lineHeight: 1,
          }}>FEEL THE GAP</div>
          <div style={{
            fontSize: 20, color: 'rgba(255,255,255,.55)', marginTop: 14,
            letterSpacing: 3, textTransform: 'uppercase',
          }}>feelthegap.world</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function PlanCard({ plan, delayFrame }: { plan: Plan; delayFrame: number }) {
  const frame = useCurrentFrame()
  const appear = interpolate(frame, [delayFrame, delayFrame + 20], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
  const y = interpolate(appear, [0, 1], [40, 0])
  return (
    <div style={{
      opacity: appear, transform: `translateY(${y}px)`,
      padding: 20, borderRadius: 18,
      background: plan.featured
        ? `linear-gradient(180deg, ${plan.color}18, transparent)`
        : '#0D1117',
      border: `${plan.featured ? '2px' : '1px'} solid ${plan.color}${plan.featured ? 'cc' : '30'}`,
      display: 'flex', flexDirection: 'column',
      minWidth: 240, boxShadow: plan.featured ? `0 0 40px ${plan.color}33` : 'none',
    }}>
      {plan.featured && (
        <div style={{
          fontSize: 12, color: plan.color, fontWeight: 700,
          letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6,
        }}>★ Populaire</div>
      )}
      <div style={{ fontSize: 22, color: 'white', fontWeight: 700 }}>{plan.label}</div>
      <div style={{
        fontSize: 42, fontFamily: 'Instrument Serif, Georgia, serif',
        color: plan.color, marginTop: 4, lineHeight: 1,
      }}>{plan.price}</div>
      <div style={{
        fontSize: 13, color: 'rgba(255,255,255,.45)', marginBottom: 12,
      }}>{plan.sub}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {plan.perks.map((pk) => (
          <div key={pk} style={{
            display: 'flex', alignItems: 'flex-start', gap: 6,
            fontSize: 14, color: 'rgba(255,255,255,.85)', lineHeight: 1.3,
          }}>
            <span style={{ color: plan.color, fontSize: 14, marginTop: 1 }}>✓</span>
            <span>{pk}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
