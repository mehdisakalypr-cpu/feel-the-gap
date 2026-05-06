/**
 * Render the FTG-specific Trade Pulse email to a standalone .html file
 * for visual review.
 *
 * Usage:  npx tsx scripts/preview-emails.ts
 * Output: /tmp/email-previews/trade-pulse-{locale}.html
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { tradePulseHtml, tradePulseSubject } from '../lib/emails/trade-pulse'
import type { TradePulseVars } from '../lib/emails/trade-pulse'

const OUT = '/tmp/email-previews'
mkdirSync(OUT, { recursive: true })

const sampleVars: TradePulseVars = {
  email: 'aissata@example.com',
  firstName: 'Aïssata',
  weekOfIso: '2026-05-04',
  signals: [
    {
      country: 'Côte d\'Ivoire',
      countryFlag: '🇨🇮',
      industry: 'Onion import substitution',
      trigger: 'INS announces 12% YoY price spike on Q1 2026 imported onions; new tariff line 0703.10.19 active.',
      evidenceUrl: 'https://www.ins.ci/',
      growthPct: 12.4,
      buyerCount: 837,
      recommendedAction: 'Pitch local cold-storage solution + bulk wholesale to top 50 GMP buyers in Abidjan.',
    },
    {
      country: 'Sénégal',
      countryFlag: '🇸🇳',
      industry: 'Frozen poultry',
      trigger: 'ANSD: import volume +28% YoY in March, 4 large QSR chains expanding into Dakar suburbs.',
      growthPct: 28.0,
      buyerCount: 412,
      recommendedAction: 'Map cold-chain logistics partners; warm intro to top 5 distributors via FTG matchmaking.',
    },
    {
      country: 'Maroc',
      countryFlag: '🇲🇦',
      industry: 'Solar pump components',
      trigger: 'New ONEE rural electrification tender (€48M) closing in 9 weeks; HS 8413.91 imports +41% YTD.',
      evidenceUrl: 'https://www.one.org.ma/',
      growthPct: 41.2,
      buyerCount: 156,
      recommendedAction: 'Reach OEM agencies with lead times <6 weeks; emphasize spare parts availability.',
    },
    {
      country: 'Nigeria',
      countryFlag: '🇳🇬',
      industry: 'Generator parts',
      trigger: 'Naira FX restrictions easing; import licenses for HS 8511 backlog clearing (last 3 weeks).',
      growthPct: 18.7,
      buyerCount: 1208,
      recommendedAction: 'Re-engage paused buyer pipeline; spot offers with USD pricing & 30-day NET.',
    },
    {
      country: 'Kenya',
      countryFlag: '🇰🇪',
      industry: 'Affordable EV scooters',
      trigger: 'Treasury draft: 0% import duty for HS 8711.60 (pure-electric) confirmed for FY26/27.',
      growthPct: 0,
      buyerCount: 92,
      recommendedAction: 'Position now: distribution partners are signing exclusive deals this quarter.',
    },
  ],
  highlights: [
    {
      slug: 'civ-onion-cold-storage-q2',
      title: 'CIV cold-storage onion arbitrage Q2',
      hsCode: '0703.10',
      geo: 'Abidjan + San-Pedro',
      marginPct: 34,
      url: 'https://feel-the-gap.vercel.app/deal/civ-onion-cold-storage-q2',
    },
    {
      slug: 'sen-poultry-distribution',
      title: 'Senegal frozen poultry distribution',
      hsCode: '0207.14',
      geo: 'Dakar',
      marginPct: 22,
      url: 'https://feel-the-gap.vercel.app/deal/sen-poultry-distribution',
    },
    {
      slug: 'mar-solar-pump-onee',
      title: 'ONEE rural solar pump tender',
      hsCode: '8413.91',
      geo: 'Maroc · 7 régions',
      marginPct: 19,
      url: 'https://feel-the-gap.vercel.app/deal/mar-solar-pump-onee',
    },
    {
      slug: 'nga-generator-parts-restock',
      title: 'Nigeria generator parts restock',
      hsCode: '8511',
      geo: 'Lagos + Ibadan',
      marginPct: 27,
      url: 'https://feel-the-gap.vercel.app/deal/nga-generator-parts-restock',
    },
  ],
  trends: [
    { label: 'HS 0703 (alliums)', deltaPct: 12.4, detail: 'imports CIV/SEN/MLI · 7d MA' },
    { label: 'HS 8413.91 (pump parts)', deltaPct: 41.2, detail: 'imports MAR/TUN · 7d MA' },
    { label: 'HS 8711.60 (EV scooters)', deltaPct: 8.1, detail: 'imports KEN/RWA · 7d MA' },
    { label: 'HS 8511 (ignition)', deltaPct: 18.7, detail: 'imports NGA/GHA · 7d MA' },
    { label: 'HS 0207.14 (poultry)', deltaPct: -3.2, detail: 'imports SEN · 7d MA' },
  ],
  dashboardUrl: 'https://feel-the-gap.vercel.app/admin/growth',
  unsubscribeUrl: 'https://feel-the-gap.vercel.app/account/notifications?topic=trade-pulse',
}

for (const locale of ['fr', 'en'] as const) {
  const html = tradePulseHtml(locale, sampleVars)
  const subject = tradePulseSubject(locale, sampleVars)
  const file = `trade-pulse-${locale}.html`
  writeFileSync(`${OUT}/${file}`, html)
  console.log(`✓ ${file}  ·  ${subject}`)
}

console.log(`\nOutput: ${OUT}/trade-pulse-{fr,en}.html`)
