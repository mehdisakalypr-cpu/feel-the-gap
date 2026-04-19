/**
 * SovereignPitch — 75s @ 30fps = 2250 frames · 1920x1080 (landscape)
 *
 * Pitch gouvernemental paramétrable par pays pilote. Généré automatiquement
 * pour Sénégal, Côte d'Ivoire, Maroc, Rwanda, Tunisie, Bénin (task #24).
 *
 * Timeline:
 *   0-5s   Flag + nom pays · "Dépendance invisible" hook
 *   5-15s  3 chiffres chocs (gap EUR import / jobs perdus / devises sortantes)
 *   15-30s "La plateforme souveraine" — 3 piliers (data / production / marché)
 *   30-50s 3 partenaires pilotes (logos institutionnels, état de signature)
 *   50-65s Projection 36 mois (emplois + devises + souveraineté)
 *   65-75s CTA "Prendre contact" + QR code URL
 */
import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig, Sequence } from 'remotion'

export const SOVEREIGN_PITCH_DURATION = 2250

export type SovereignPitchProps = {
  countryIso: string          // 'SEN', 'CIV', 'MAR', 'RWA', 'TUN', 'BEN'
  countryNameFr: string       // 'Sénégal'
  flag: string                // '🇸🇳'
  gapImportEur: number        // ex. 2_400_000_000 (importations annuelles substitutables)
  jobsLostAnnual: number      // ex. 85_000
  fxOutflowPctGdp: number     // ex. 7.2 (devises sortantes %PIB)
  projectedJobs36m: number    // ex. 12_500
  projectedFxSavingsEur: number // ex. 180_000_000
  partnerHints?: string[]     // ex. ['Ministère du Commerce', 'CCI', 'Ministère de l\'Économie Numérique']
  ctaUrl?: string             // ex. 'feelthegap.world/gov/SEN'
}

const GOLD = '#C9A84C'
const GREEN = '#34D399'
const RED = '#EF4444'
const BG = '#07090F'
const CARD_BG = 'rgba(255,255,255,0.04)'
const CARD_BORDER = 'rgba(255,255,255,0.08)'

function fmtEur(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' Md€'
  if (n >= 1e6) return (n / 1e6).toFixed(0) + ' M€'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' k€'
  return n.toLocaleString('fr-FR') + ' €'
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR')
}

export const SovereignPitch: React.FC<SovereignPitchProps> = ({
  countryIso,
  countryNameFr,
  flag,
  gapImportEur,
  jobsLostAnnual,
  fxOutflowPctGdp,
  projectedJobs36m,
  projectedFxSavingsEur,
  partnerHints = ['Ministère du Commerce', 'Agence de Promotion Export', 'Chambre de Commerce'],
  ctaUrl,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const cta = ctaUrl ?? `feelthegap.world/gov/${countryIso}`

  return (
    <AbsoluteFill style={{
      background: `radial-gradient(ellipse at top, #0D1117 0%, ${BG} 70%, ${BG} 100%)`,
      color: 'white',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Seq 1 · 0-5s — Hook pays + dépendance invisible */}
      <Sequence from={0} durationInFrames={150}>
        <HookScene flag={flag} country={countryNameFr} frame={frame} fps={fps} />
      </Sequence>

      {/* Seq 2 · 5-15s — 3 chiffres chocs */}
      <Sequence from={150} durationInFrames={300}>
        <ShockStats
          frame={frame - 150}
          gapImportEur={gapImportEur}
          jobsLostAnnual={jobsLostAnnual}
          fxOutflowPctGdp={fxOutflowPctGdp}
        />
      </Sequence>

      {/* Seq 3 · 15-30s — 3 piliers plateforme souveraine */}
      <Sequence from={450} durationInFrames={450}>
        <SovereignPillars frame={frame - 450} />
      </Sequence>

      {/* Seq 4 · 30-50s — Partenaires pilotes */}
      <Sequence from={900} durationInFrames={600}>
        <PartnersScene frame={frame - 900} partners={partnerHints} country={countryNameFr} />
      </Sequence>

      {/* Seq 5 · 50-65s — Projection 36 mois */}
      <Sequence from={1500} durationInFrames={450}>
        <Projection36m
          frame={frame - 1500}
          projectedJobs36m={projectedJobs36m}
          projectedFxSavingsEur={projectedFxSavingsEur}
        />
      </Sequence>

      {/* Seq 6 · 65-75s — CTA */}
      <Sequence from={1950} durationInFrames={300}>
        <CtaScene frame={frame - 1950} country={countryNameFr} flag={flag} ctaUrl={cta} />
      </Sequence>
    </AbsoluteFill>
  )
}

// ── Scenes ───────────────────────────────────────────────────────────────────

function HookScene({ flag, country, frame, fps }: { flag: string; country: string; frame: number; fps: number }) {
  const flagScale = spring({ frame, fps, config: { damping: 14, stiffness: 90 } })
  const flagOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })
  const hookOpacity = interpolate(frame, [50, 80], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
  const hookY = interpolate(frame, [50, 80], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 30 }}>
      <div style={{ fontSize: 220, transform: `scale(${flagScale})`, opacity: flagOpacity }}>{flag}</div>
      <div style={{
        fontSize: 80, fontFamily: 'Instrument Serif, Georgia, serif',
        letterSpacing: -1, opacity: flagOpacity,
      }}>{country}</div>
      <div style={{
        marginTop: 20, fontSize: 38, color: 'rgba(255,255,255,.72)',
        transform: `translateY(${hookY}px)`, opacity: hookOpacity,
        fontStyle: 'italic', textAlign: 'center', maxWidth: 1200,
      }}>
        Une dépendance économique invisible — que l'on peut renverser.
      </div>
    </AbsoluteFill>
  )
}

function ShockStats({ frame, gapImportEur, jobsLostAnnual, fxOutflowPctGdp }: {
  frame: number; gapImportEur: number; jobsLostAnnual: number; fxOutflowPctGdp: number
}) {
  const counter = (target: number, delay: number) => interpolate(frame, [delay, delay + 60], [0, target], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  })
  const opacity = (delay: number) => interpolate(frame, [delay, delay + 20], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 80px' }}>
      <div style={{
        fontSize: 26, color: 'rgba(255,255,255,.55)',
        letterSpacing: 4, textTransform: 'uppercase', marginBottom: 50,
        opacity: opacity(0),
      }}>État des lieux — données officielles</div>
      <div style={{ display: 'flex', gap: 40, alignItems: 'stretch' }}>
        <StatCard
          label="Importations substituables"
          value={fmtEur(counter(gapImportEur, 10))}
          sublabel="par an"
          color={RED}
          opacity={opacity(10)}
        />
        <StatCard
          label="Emplois non-créés"
          value={fmtInt(counter(jobsLostAnnual, 60))}
          sublabel="par an — filières agro"
          color={GOLD}
          opacity={opacity(60)}
        />
        <StatCard
          label="Devises sortantes"
          value={counter(fxOutflowPctGdp, 110).toFixed(1) + ' %'}
          sublabel="du PIB annuel"
          color={RED}
          opacity={opacity(110)}
        />
      </div>
    </AbsoluteFill>
  )
}

function StatCard({ label, value, sublabel, color, opacity }: {
  label: string; value: string; sublabel: string; color: string; opacity: number
}) {
  return (
    <div style={{
      padding: '40px 36px', borderRadius: 20,
      background: CARD_BG, border: `1.5px solid ${CARD_BORDER}`,
      minWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      opacity,
    }}>
      <div style={{ fontSize: 18, color: 'rgba(255,255,255,.5)', letterSpacing: 2, textTransform: 'uppercase' }}>{label}</div>
      <div style={{
        fontSize: 76, fontFamily: 'Instrument Serif, Georgia, serif',
        color, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      <div style={{ fontSize: 18, color: 'rgba(255,255,255,.4)' }}>{sublabel}</div>
    </div>
  )
}

function SovereignPillars({ frame }: { frame: number }) {
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
  const pillars = [
    { icon: '📡', title: 'Data souveraine', desc: 'Cartographie en temps réel des opportunités export/import par filière · 211 pays · 323 produits' },
    { icon: '🏭', title: 'Production 3.0', desc: 'Méthodes locales comparées (capex, emplois, impact) — financement orchestré via partenaires bancaires régionaux' },
    { icon: '🎯', title: 'Accès marché B2B', desc: 'Mise en relation directe avec acheteurs B2B étrangers — contrats Incoterms + escrow + transport intégré' },
  ]
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 80px' }}>
      <div style={{
        fontSize: 52, fontFamily: 'Instrument Serif, Georgia, serif',
        opacity: titleOpacity, marginBottom: 60, textAlign: 'center',
      }}>La plateforme souveraine</div>
      <div style={{ display: 'flex', gap: 30 }}>
        {pillars.map((p, i) => {
          const delay = 30 + i * 25
          const op = interpolate(frame, [delay, delay + 30], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
          const y = interpolate(frame, [delay, delay + 30], [30, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
          return (
            <div key={p.title} style={{
              padding: '36px 30px', borderRadius: 20,
              background: CARD_BG, border: `1.5px solid ${CARD_BORDER}`,
              width: 440, opacity: op, transform: `translateY(${y}px)`,
              display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              <div style={{ fontSize: 80 }}>{p.icon}</div>
              <div style={{ fontSize: 32, color: GOLD, fontWeight: 600 }}>{p.title}</div>
              <div style={{ fontSize: 20, color: 'rgba(255,255,255,.7)', lineHeight: 1.5 }}>{p.desc}</div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

function PartnersScene({ frame, partners, country }: { frame: number; partners: string[]; country: string }) {
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 80px' }}>
      <div style={{
        fontSize: 26, color: 'rgba(255,255,255,.55)',
        letterSpacing: 4, textTransform: 'uppercase', marginBottom: 20,
        opacity: titleOpacity,
      }}>Pilotes — {country}</div>
      <div style={{
        fontSize: 48, fontFamily: 'Instrument Serif, Georgia, serif',
        opacity: titleOpacity, marginBottom: 50, textAlign: 'center', maxWidth: 1400,
      }}>Partenariats en cours de cadrage</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: 900 }}>
        {partners.slice(0, 3).map((p, i) => {
          const delay = 40 + i * 30
          const op = interpolate(frame, [delay, delay + 30], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
          const x = interpolate(frame, [delay, delay + 30], [-40, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
          return (
            <div key={p} style={{
              padding: '22px 30px', borderRadius: 14,
              background: CARD_BG, border: `1.5px solid ${CARD_BORDER}`,
              opacity: op, transform: `translateX(${x}px)`,
              display: 'flex', alignItems: 'center', gap: 20,
            }}>
              <div style={{ fontSize: 36 }}>🏛️</div>
              <div style={{ fontSize: 28, color: 'white' }}>{p}</div>
              <div style={{ marginLeft: 'auto', fontSize: 14, color: GREEN, letterSpacing: 2, textTransform: 'uppercase' }}>
                · Cadrage
              </div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

function Projection36m({ frame, projectedJobs36m, projectedFxSavingsEur }: {
  frame: number; projectedJobs36m: number; projectedFxSavingsEur: number
}) {
  const jobsVal = interpolate(frame, [30, 120], [0, projectedJobs36m], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  })
  const fxVal = interpolate(frame, [80, 170], [0, projectedFxSavingsEur], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  })
  const titleOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        fontSize: 26, color: 'rgba(255,255,255,.55)',
        letterSpacing: 4, textTransform: 'uppercase', marginBottom: 50,
        opacity: titleOp,
      }}>Projection 36 mois — scénario central</div>
      <div style={{ display: 'flex', gap: 60, alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 160, fontFamily: 'Instrument Serif, Georgia, serif',
            color: GREEN, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          }}>{fmtInt(jobsVal)}</div>
          <div style={{ fontSize: 22, color: 'rgba(255,255,255,.6)', marginTop: 8, letterSpacing: 2, textTransform: 'uppercase' }}>
            emplois créés
          </div>
        </div>
        <div style={{ width: 2, height: 200, background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 140, fontFamily: 'Instrument Serif, Georgia, serif',
            color: GOLD, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          }}>{fmtEur(fxVal)}</div>
          <div style={{ fontSize: 22, color: 'rgba(255,255,255,.6)', marginTop: 8, letterSpacing: 2, textTransform: 'uppercase' }}>
            devises préservées
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}

function CtaScene({ frame, country, flag, ctaUrl }: { frame: number; country: string; flag: string; ctaUrl: string }) {
  const op = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' })
  const pulse = 1 + Math.sin(frame / 8) * 0.03
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 30, opacity: op }}>
      <div style={{ fontSize: 80 }}>{flag}</div>
      <div style={{
        fontSize: 64, fontFamily: 'Instrument Serif, Georgia, serif',
        maxWidth: 1400, textAlign: 'center', lineHeight: 1.15,
      }}>Engageons ensemble la souveraineté économique du {country}.</div>
      <div style={{
        marginTop: 40,
        transform: `scale(${pulse})`,
        padding: '26px 56px', borderRadius: 999,
        background: `linear-gradient(135deg, ${GREEN} 0%, #10B981 100%)`,
        color: BG, fontSize: 38, fontWeight: 700,
        boxShadow: `0 0 80px ${GREEN}55`,
      }}>
        {ctaUrl} →
      </div>
      <div style={{
        marginTop: 18, fontSize: 20, color: 'rgba(255,255,255,.5)',
        letterSpacing: 3, textTransform: 'uppercase',
      }}>Prendre contact · visioconférence sécurisée · 30 min</div>
    </AbsoluteFill>
  )
}
