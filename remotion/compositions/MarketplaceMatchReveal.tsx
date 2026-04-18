/**
 * MarketplaceMatchReveal — 25s @ 30fps = 750 frames
 *
 * Pitch pivot FTG : l'offre (producteur) rencontre la demande (acheteur),
 * l'IA score, le deal se ferme, la commission tombe. Format 1920×1080.
 *
 * Timeline :
 *   0-2s    Titre "Le Marketplace B2B FTG" + tagline
 *   2-7s    Carte producteur (volume 2500 kg café CIV, fairtrade, 1.85€) apparaît à gauche
 *   4-9s    Carte acheteur (demande 1000-3000 kg, fairtrade requis, 2.20€ max) apparaît à droite
 *   9-13s   Animation "scan IA" : lignes traverseant les 2 cartes
 *   13-17s  Score 89/100 grossit au centre + détail pondération (coût/qualité/certs/qty)
 *   17-20s  Prix final midpoint 2.02€ + total 5 062€ + commission 126€
 *   20-23s  Stats globales : "24 matches · GMV 195 005€ · Commission 4 875€"
 *   23-25s  Logo + URL fade
 */
import React from 'react'
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion'

export const MARKETPLACE_MATCH_REVEAL_DURATION = 750
const FPS = 30

const GOLD = '#C9A84C'
const EMERALD = '#34D399'
const BG = '#07090F'
const CARD_BG = '#0D1117'

type Props = {
  totalMatches?: number
  totalGmvEur?: number
  totalCommissionEur?: number
}

export const MarketplaceMatchReveal: React.FC<Props> = ({
  totalMatches = 24,
  totalGmvEur = 195005,
  totalCommissionEur = 4875,
}) => {
  const f = useCurrentFrame()

  // ── Step 1: header (0-2s) ────────────────────────────────────────
  const headerOpacity = interpolate(f, [0, 20, 60, 90], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const headerY = interpolate(f, [0, 20], [40, 0], { extrapolateRight: 'clamp' })

  // ── Step 2-3: producer card (2s in) & buyer card (4s in) ─────────
  const prodIn = interpolate(f, [60, 110], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const prodX = interpolate(prodIn, [0, 1], [-300, 0])
  const prodOpacity = prodIn
  const buyerIn = interpolate(f, [120, 170], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const buyerX = interpolate(buyerIn, [0, 1], [300, 0])
  const buyerOpacity = buyerIn

  // ── Step 4: IA scan (9-13s) — laser sweeps between cards ─────────
  const scanActive = f >= 270 && f <= 390
  const scanProgress = interpolate(f, [270, 390], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // ── Step 5: score reveal (13-17s) ────────────────────────────────
  const scoreIn = interpolate(f, [390, 450], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const scoreScale = interpolate(scoreIn, [0, 0.6, 1], [0.3, 1.25, 1])
  const scoreOpacity = scoreIn
  const scoreValue = Math.round(interpolate(f, [390, 450], [0, 89], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))

  // ── Step 6: deal numbers (17-20s) ────────────────────────────────
  const dealIn = interpolate(f, [510, 570], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // ── Step 7: totals (20-23s) ──────────────────────────────────────
  const totalsIn = interpolate(f, [600, 660], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const gmvDisplay = Math.round(interpolate(f, [600, 660], [0, totalGmvEur], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))
  const commissionDisplay = Math.round(interpolate(f, [600, 660], [0, totalCommissionEur], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))

  // ── Step 8: outro (23-25s) ───────────────────────────────────────
  const outroIn = interpolate(f, [690, 750], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: 'system-ui, sans-serif', color: 'white' }}>
      {/* Background grid */}
      <AbsoluteFill style={{ opacity: 0.04, backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      {/* Header */}
      <div style={{ position: 'absolute', top: 80, left: 0, right: 0, textAlign: 'center', opacity: headerOpacity, transform: `translateY(${headerY}px)` }}>
        <div style={{ fontSize: 22, letterSpacing: 6, color: GOLD, fontWeight: 600, marginBottom: 12 }}>🌍 MARKETPLACE B2B — PHASE 2</div>
        <div style={{ fontSize: 56, fontWeight: 700 }}>L'offre rencontre la demande. L'IA clôt le deal.</div>
      </div>

      {/* Producer card (left) */}
      <Card
        x={360 + prodX}
        y={340}
        width={520}
        height={360}
        opacity={prodOpacity}
        borderColor={GOLD}
        title="🌾 PRODUCTEUR · CIV"
        lines={[
          ['Produit',      'Café robusta — Coop Yamoussoukro'],
          ['Quantité',     '2 500 kg'],
          ['Qualité',      'standard'],
          ['Certifs',      'fairtrade ✓'],
          ['Prix plancher','1,85 €/kg'],
          ['Incoterm',     'FOB'],
        ]}
      />

      {/* Buyer card (right) */}
      <Card
        x={1040 + buyerX}
        y={340}
        width={520}
        height={360}
        opacity={buyerOpacity}
        borderColor={EMERALD}
        title="🛒 ACHETEUR · FRA"
        lines={[
          ['Produit',      'Café vert robusta'],
          ['Quantité',     '1 000 – 3 000 kg'],
          ['Qualité',      'standard+'],
          ['Certifs req',  'fairtrade ✓'],
          ['Prix plafond', '2,20 €/kg'],
          ['Incoterm',     'FOB'],
        ]}
      />

      {/* Scan lasers */}
      {scanActive && <ScanLasers progress={scanProgress} />}

      {/* Match score center */}
      {f >= 390 && f <= 690 && (
        <div style={{
          position: 'absolute', top: 780, left: 0, right: 0, textAlign: 'center',
          opacity: scoreOpacity, transform: `scale(${scoreScale})`,
        }}>
          <div style={{ fontSize: 14, letterSpacing: 4, color: GOLD, fontWeight: 700, marginBottom: 4 }}>
            MATCH SCORE IA
          </div>
          <div style={{ fontSize: 120, fontWeight: 900, color: GOLD, lineHeight: 1 }}>
            {scoreValue}<span style={{ fontSize: 60, opacity: 0.5 }}> /100</span>
          </div>
          {f >= 450 && (
            <div style={{ fontSize: 16, color: '#9CA3AF', marginTop: 8, display: 'flex', justifyContent: 'center', gap: 24 }}>
              <span>produit <b style={{ color: GOLD }}>+20</b></span>
              <span>qualité <b style={{ color: GOLD }}>+15</b></span>
              <span>certifs <b style={{ color: GOLD }}>+15</b></span>
              <span>qty <b style={{ color: GOLD }}>+15</b></span>
              <span>prix <b style={{ color: GOLD }}>+14</b></span>
              <span>incoterm <b style={{ color: GOLD }}>+10</b></span>
            </div>
          )}
        </div>
      )}

      {/* Deal numbers */}
      {f >= 510 && f <= 690 && (
        <div style={{ position: 'absolute', bottom: 140, left: 0, right: 0, textAlign: 'center', opacity: dealIn }}>
          <div style={{ display: 'inline-flex', gap: 48, padding: '24px 48px', background: CARD_BG, borderRadius: 20, border: `1px solid ${GOLD}40` }}>
            <Stat label="Prix retenu"    value="2,02 €/kg" color={GOLD} />
            <Stat label="Volume retenu"  value="2 500 kg"  color={GOLD} />
            <Stat label="Total"          value="5 062 €"   color={GOLD} />
            <Stat label="Commission 2,5 %" value="126 €"     color={EMERALD} />
          </div>
        </div>
      )}

      {/* Totals (20-23s) */}
      {f >= 600 && f <= 750 && (
        <div style={{ position: 'absolute', bottom: 260, left: 0, right: 0, textAlign: 'center', opacity: totalsIn }}>
          <div style={{ fontSize: 16, color: '#9CA3AF', marginBottom: 8 }}>Pilote café CIV · 10 producteurs × 3 acheteurs</div>
          <div style={{ fontSize: 44, fontWeight: 700 }}>
            {totalMatches} matches · GMV <span style={{ color: GOLD }}>{gmvDisplay.toLocaleString('fr-FR')} €</span> · Commission <span style={{ color: EMERALD }}>{commissionDisplay.toLocaleString('fr-FR')} €</span>
          </div>
        </div>
      )}

      {/* Outro */}
      {f >= 690 && (
        <AbsoluteFill style={{ background: `rgba(7,9,15,${outroIn * 0.9})`, justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ fontSize: 72, fontWeight: 800, color: GOLD, opacity: outroIn }}>Feel The Gap</div>
          <div style={{ fontSize: 24, color: 'white', opacity: outroIn * 0.8, marginTop: 12 }}>feel-the-gap.com/marketplace</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────

const Card: React.FC<{
  x: number; y: number; width: number; height: number
  opacity: number; borderColor: string; title: string
  lines: Array<[string, string]>
}> = ({ x, y, width, height, opacity, borderColor, title, lines }) => (
  <div style={{
    position: 'absolute', left: x, top: y, width, height,
    background: CARD_BG, border: `2px solid ${borderColor}`, borderRadius: 16,
    padding: 28, opacity,
    boxShadow: `0 0 40px ${borderColor}40`,
  }}>
    <div style={{ fontSize: 18, fontWeight: 700, color: borderColor, marginBottom: 20, letterSpacing: 2 }}>{title}</div>
    {lines.map(([k, v]) => (
      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 18 }}>
        <span style={{ color: '#9CA3AF' }}>{k}</span>
        <span style={{ fontWeight: 600 }}>{v}</span>
      </div>
    ))}
  </div>
)

const ScanLasers: React.FC<{ progress: number }> = ({ progress }) => {
  // Horizontal sweep
  const sweepY = 340 + 360 * progress
  return (
    <>
      <div style={{
        position: 'absolute', top: sweepY, left: 360, width: 1200, height: 2,
        background: `linear-gradient(90deg, transparent, ${GOLD}, ${EMERALD}, transparent)`,
        boxShadow: `0 0 20px ${GOLD}, 0 0 40px ${EMERALD}`,
      }} />
      <div style={{
        position: 'absolute', top: sweepY - 40, left: 360, width: 1200, height: 80,
        background: `linear-gradient(180deg, transparent 0%, ${GOLD}10 50%, transparent 100%)`,
      }} />
    </>
  )
}

const Stat: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 13, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 32, fontWeight: 800, color }}>{value}</div>
  </div>
)
