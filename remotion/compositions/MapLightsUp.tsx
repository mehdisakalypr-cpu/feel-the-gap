/**
 * MapLightsUp — 30s @ 30fps = 900 frames
 * Concept FTG : la carte du monde s'éclaire, compteurs de pays et d'opportunités
 * qui grimpent, tagline, logo. Format 1920×1080.
 *
 * Timeline:
 *   0-1s   fond noir + FTG logo fade-in centré
 *   1-3s   logo glisse en haut, sous-titre apparaît
 *   3-16s  ~80 dots s'allument progressivement (waves Afrique → Europe →
 *          Amériques → Asie → Océanie), pulse continu une fois allumés
 *   16-24s compteurs 198 pays + 19800 opportunités interpolés
 *   24-28s tagline
 *   28-30s fade to logo + URL final
 */
import React from 'react'
import {
  AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig,
} from 'remotion'

export const MAP_LIGHTS_UP_DURATION_FRAMES = 900

type Props = {
  countriesCount?: number
  opportunitiesCount?: number
  tagline?: string
}

/* ═══════════════ world dots layout (normalisé 0-1) ═══════════════ */
type Dot = { x: number; y: number; region: 'afr' | 'eur' | 'ame_n' | 'ame_s' | 'asi' | 'oce' }

const DOTS: Dot[] = [
  // Afrique (22) — x ~ 0.46-0.58, y ~ 0.42-0.78
  ...toDots('afr', [
    [0.51,0.44],[0.53,0.46],[0.49,0.47],[0.48,0.50],[0.50,0.52],[0.52,0.52],[0.54,0.50],
    [0.47,0.55],[0.49,0.57],[0.51,0.58],[0.53,0.59],[0.55,0.56],[0.50,0.62],[0.52,0.64],
    [0.54,0.65],[0.48,0.67],[0.51,0.70],[0.53,0.72],[0.55,0.71],[0.57,0.68],[0.50,0.74],[0.52,0.76],
  ]),
  // Europe (18) — x 0.45-0.60, y 0.28-0.40
  ...toDots('eur', [
    [0.47,0.30],[0.49,0.29],[0.51,0.30],[0.52,0.31],[0.53,0.32],[0.48,0.33],[0.50,0.33],
    [0.52,0.34],[0.54,0.33],[0.56,0.32],[0.58,0.31],[0.46,0.35],[0.48,0.36],[0.50,0.36],
    [0.52,0.37],[0.54,0.36],[0.56,0.35],[0.58,0.36],
  ]),
  // Amérique du Nord (16) — x 0.10-0.30, y 0.22-0.42
  ...toDots('ame_n', [
    [0.13,0.25],[0.16,0.26],[0.19,0.25],[0.22,0.27],[0.25,0.28],[0.12,0.30],[0.15,0.31],
    [0.18,0.30],[0.21,0.32],[0.24,0.33],[0.27,0.33],[0.15,0.35],[0.18,0.36],[0.21,0.37],
    [0.24,0.38],[0.20,0.40],
  ]),
  // Amérique du Sud (12) — x 0.25-0.38, y 0.55-0.85
  ...toDots('ame_s', [
    [0.30,0.55],[0.32,0.57],[0.33,0.60],[0.31,0.62],[0.32,0.65],[0.33,0.68],[0.30,0.70],
    [0.31,0.73],[0.32,0.76],[0.31,0.79],[0.30,0.82],[0.29,0.85],
  ]),
  // Asie (22) — x 0.58-0.85, y 0.25-0.55
  ...toDots('asi', [
    [0.60,0.30],[0.62,0.28],[0.64,0.27],[0.66,0.29],[0.68,0.28],[0.70,0.30],[0.72,0.29],
    [0.74,0.31],[0.76,0.30],[0.78,0.32],[0.80,0.31],[0.62,0.34],[0.65,0.35],[0.68,0.35],
    [0.70,0.36],[0.73,0.37],[0.76,0.36],[0.79,0.38],[0.65,0.40],[0.69,0.42],[0.73,0.44],[0.77,0.47],
  ]),
  // Océanie (6) — x 0.78-0.88, y 0.65-0.78
  ...toDots('oce', [
    [0.80,0.68],[0.82,0.70],[0.84,0.69],[0.86,0.72],[0.79,0.74],[0.83,0.76],
  ]),
]

function toDots(region: Dot['region'], coords: Array<[number, number]>): Dot[] {
  return coords.map(([x, y]) => ({ x, y, region }))
}

const REGION_ORDER: Dot['region'][] = ['afr', 'eur', 'ame_n', 'ame_s', 'asi', 'oce']

/** Retourne le frame d'apparition d'un dot selon son ordre régional (wave effect). */
function dotAppearFrame(index: number, total: number): number {
  const startFrame = 90 // 3s
  const endFrame = 480  // 16s
  const range = endFrame - startFrame
  return Math.round(startFrame + (index / total) * range)
}

/* ═══════════════ sub-components ═══════════════ */

const BrandColor = '#C9A84C'
const BgDark = '#07090F'
const BgMid = '#0D1117'

function Dots({ count }: { count: number }) {
  const frame = useCurrentFrame()
  const sortedDots = React.useMemo(() => {
    const byRegion: Dot[] = []
    for (const r of REGION_ORDER) byRegion.push(...DOTS.filter((d) => d.region === r))
    return byRegion.slice(0, count)
  }, [count])

  return (
    <svg
      width="100%" height="100%" viewBox="0 0 1920 1080"
      style={{ position: 'absolute', inset: 0 }}
    >
      {sortedDots.map((d, i) => {
        const appear = dotAppearFrame(i, sortedDots.length)
        const progress = interpolate(frame, [appear, appear + 20], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        })
        const pulsePhase = Math.max(0, frame - appear) / 30
        const pulse = 0.85 + Math.sin(pulsePhase * Math.PI) * 0.15
        const cx = d.x * 1920
        const cy = d.y * 1080
        const r = 6 * progress
        const glowR = 22 * progress * pulse
        return (
          <g key={i} opacity={progress}>
            <circle cx={cx} cy={cy} r={glowR} fill={BrandColor} opacity={0.15 * pulse} />
            <circle cx={cx} cy={cy} r={r} fill={BrandColor} />
          </g>
        )
      })}
    </svg>
  )
}

function ContinentBackdrop() {
  // Silhouette très discrète des masses continentales — des polygones approximatifs
  // pour donner un repère visuel sous les dots (subtil, pas focal).
  return (
    <svg
      width="100%" height="100%" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', inset: 0, opacity: 0.06 }}
    >
      {/* Afrique */}
      <path d="M880,450 Q960,430 1000,470 L1060,540 L1080,640 L1040,780 L960,830 L880,800 L840,720 L860,620 Z"
        fill={BrandColor} />
      {/* Europe */}
      <path d="M850,320 L1080,300 L1120,360 L1060,400 L920,410 L840,380 Z" fill={BrandColor} />
      {/* Amérique du Nord */}
      <path d="M220,260 Q380,220 520,260 L560,360 L520,440 L400,460 L280,420 L200,340 Z" fill={BrandColor} />
      {/* Amérique du Sud */}
      <path d="M540,560 Q620,560 640,620 L660,740 L620,860 L560,900 L520,820 L520,680 Z" fill={BrandColor} />
      {/* Asie */}
      <path d="M1120,280 L1500,260 L1620,320 L1640,440 L1520,560 L1320,540 L1200,440 L1140,360 Z"
        fill={BrandColor} />
      {/* Océanie */}
      <path d="M1480,720 L1620,700 L1680,760 L1640,820 L1520,820 Z" fill={BrandColor} />
    </svg>
  )
}

function BrandLogo({ scale = 1, opacity = 1 }: { scale?: number; opacity?: number }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      transform: `scale(${scale})`, opacity, transformOrigin: 'center',
    }}>
      <div style={{
        fontFamily: 'Instrument Serif, Georgia, serif',
        fontSize: 92, color: BrandColor, letterSpacing: -2, lineHeight: 1,
      }}>FEEL THE GAP</div>
      <div style={{
        fontFamily: 'Inter, system-ui, sans-serif', fontSize: 18,
        color: 'rgba(255,255,255,.6)', letterSpacing: 6, textTransform: 'uppercase',
      }}>Trade Intelligence · 198 pays</div>
    </div>
  )
}

function Counter({ from, to, durationFrames, startFrame, suffix = '', prefix = '' }: {
  from: number; to: number; durationFrames: number; startFrame: number; suffix?: string; prefix?: string
}) {
  const frame = useCurrentFrame()
  const v = interpolate(
    frame,
    [startFrame, startFrame + durationFrames],
    [from, to],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (t) => 1 - Math.pow(1 - t, 3) },
  )
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {prefix}{Math.round(v).toLocaleString('fr-FR')}{suffix}
    </span>
  )
}

/* ═══════════════ main composition ═══════════════ */

export const MapLightsUp: React.FC<Props> = ({
  countriesCount = 198, opportunitiesCount = 19800, tagline = 'Chaque pays cache des gisements invisibles. On les révèle.',
}) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  // Logo : gros centré frames 30-90, puis glisse vers le haut frames 90-120, reste en haut
  const logoCentralOpacity = interpolate(frame, [15, 45], [0, 1], { extrapolateRight: 'clamp' })
  const logoShift = interpolate(frame, [90, 120], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const logoY = interpolate(logoShift, [0, 1], [0, -360]) // pixels
  const logoScale = interpolate(logoShift, [0, 1], [1, 0.38])

  // Counters & tagline & fade final
  const countersOpacity = interpolate(frame, [480, 540], [0, 1], { extrapolateRight: 'clamp' })
  const taglineOpacity = interpolate(frame, [720, 780], [0, 1], { extrapolateRight: 'clamp' })
  const finalFade = interpolate(frame, [840, 880], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const endCardOpacity = interpolate(frame, [860, 900], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{
      background: `radial-gradient(ellipse at center, ${BgMid} 0%, ${BgDark} 70%)`,
      color: 'white', fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Carte (continents + dots) — visible dès les premières frames */}
      <AbsoluteFill style={{ opacity: finalFade }}>
        <ContinentBackdrop />
        <Dots count={DOTS.length} />
      </AbsoluteFill>

      {/* Logo central qui glisse vers le haut */}
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: logoCentralOpacity * finalFade,
        transform: `translateY(${logoY}px)`,
      }}>
        <BrandLogo scale={logoScale} />
      </AbsoluteFill>

      {/* Counters bas-centrés 16s-24s */}
      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        alignItems: 'center', paddingBottom: 220, gap: 20,
        opacity: countersOpacity * finalFade,
      }}>
        <div style={{ display: 'flex', gap: 80 }}>
          <Metric label="Pays couverts"
            value={<Counter from={0} to={countriesCount} durationFrames={90} startFrame={510} />} />
          <Metric label="Opportunités qualifiées"
            value={<Counter from={0} to={opportunitiesCount} durationFrames={120} startFrame={540} />} />
        </div>
      </AbsoluteFill>

      {/* Tagline 24s-28s */}
      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        alignItems: 'center', paddingBottom: 120,
        opacity: taglineOpacity * finalFade,
      }}>
        <p style={{
          fontFamily: 'Instrument Serif, Georgia, serif', fontSize: 52, color: 'white',
          maxWidth: 1400, textAlign: 'center', lineHeight: 1.2, margin: 0,
        }}>
          {tagline}
        </p>
      </AbsoluteFill>

      {/* End card 28s-30s */}
      <Sequence from={840}>
        <AbsoluteFill style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: BgDark, opacity: endCardOpacity,
        }}>
          <div style={{ textAlign: 'center' }}>
            <BrandLogo />
            <div style={{
              marginTop: 32, fontSize: 22, color: BrandColor,
              fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: 2,
            }}>
              feelthegap.app
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  )
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: 88, color: BrandColor, fontFamily: 'Instrument Serif, Georgia, serif', lineHeight: 1,
      }}>{value}</div>
      <div style={{
        marginTop: 8, fontSize: 16, color: 'rgba(255,255,255,.6)', letterSpacing: 3, textTransform: 'uppercase',
      }}>{label}</div>
    </div>
  )
}
