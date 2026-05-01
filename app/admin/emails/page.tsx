import Link from 'next/link'
import { tradePulseHtml, tradePulseSubject } from '@/lib/emails/trade-pulse'
import type { TradePulseVars } from '@/lib/emails/trade-pulse'

export const metadata = { title: 'Emails — Feel The Gap' }
export const dynamic = 'force-dynamic'

const C = {
  bg: '#040D1C', card: '#0A1A2E', border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C', text: '#E8E0D0', muted: '#9BA8B8',
  green: '#10B981', blue: '#3B82F6', purple: '#A78BFA',
}

const SAMPLE: TradePulseVars = {
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
    { slug: 'civ-onion', title: 'CIV cold-storage onion arbitrage Q2', hsCode: '0703.10', geo: 'Abidjan + San-Pedro', marginPct: 34, url: 'https://feel-the-gap.vercel.app/deal/civ-onion' },
    { slug: 'sen-poultry', title: 'Senegal frozen poultry distribution', hsCode: '0207.14', geo: 'Dakar', marginPct: 22, url: 'https://feel-the-gap.vercel.app/deal/sen-poultry' },
    { slug: 'mar-solar', title: 'ONEE rural solar pump tender', hsCode: '8413.91', geo: 'Maroc · 7 régions', marginPct: 19, url: 'https://feel-the-gap.vercel.app/deal/mar-solar' },
    { slug: 'nga-generator', title: 'Nigeria generator parts restock', hsCode: '8511', geo: 'Lagos + Ibadan', marginPct: 27, url: 'https://feel-the-gap.vercel.app/deal/nga-generator' },
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

type Locale = 'fr' | 'en'

export default async function EmailsHubPage({ searchParams }: { searchParams: Promise<{ locale?: string }> }) {
  const sp = await searchParams
  const locale: Locale = sp.locale === 'en' ? 'en' : 'fr'
  const subject = tradePulseSubject(locale, SAMPLE)
  const html = tradePulseHtml(locale, SAMPLE)

  return (
    <div style={{ color: C.text, padding: '20px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ fontSize: 11, color: C.accent, letterSpacing: '.2em', textTransform: 'uppercase' }}>Comms · Feel The Gap</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: '6px 0 8px' }}>📧 Emails</h1>
      <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 20, maxWidth: 760 }}>
        Templates Resend FTG-spécifiques. Le hub cross-portfolio (welcome + launch-bonus) vit sur{' '}
        <a href="https://cc-dashboard.vercel.app/admin/emails" style={{ color: C.accent, textDecoration: 'none' }}>cc-dashboard.vercel.app/admin/emails ↗</a>.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: C.muted, letterSpacing: '.1em', textTransform: 'uppercase' }}>Locale preview</span>
        <Link href={{ pathname: '/admin/emails', query: { locale: 'fr' } }}
          style={{
            fontSize: 12, padding: '5px 12px', borderRadius: 6,
            background: locale === 'fr' ? C.accent : 'transparent',
            color: locale === 'fr' ? C.bg : C.text,
            border: `1px solid ${C.border}`, textDecoration: 'none', fontWeight: 600,
          }}>🇫🇷 FR</Link>
        <Link href={{ pathname: '/admin/emails', query: { locale: 'en' } }}
          style={{
            fontSize: 12, padding: '5px 12px', borderRadius: 6,
            background: locale === 'en' ? C.accent : 'transparent',
            color: locale === 'en' ? C.bg : C.text,
            border: `1px solid ${C.border}`, textDecoration: 'none', fontWeight: 600,
          }}>🇬🇧 EN</Link>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Trade Pulse</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.55 }}>
              Newsletter hebdo : top 5 buying signals, niches en mouvement, 7-day trends.
              Sources : TARIC / Sirene FR / Companies House / Wikidata + index FTG propriétaire.
            </div>
            <div style={{ fontSize: 11, color: C.accent, marginTop: 6, fontFamily: 'Menlo, monospace' }}>Cron: Lundi 08:00 Europe/Paris</div>
          </div>
          <span style={{
            fontSize: 9, padding: '3px 8px', borderRadius: 999, letterSpacing: '.1em', textTransform: 'uppercase',
            background: 'rgba(167,139,250,.15)', color: C.purple,
          }}>○ Draft</span>
        </div>
        <div style={{ fontSize: 12, color: C.text, marginTop: 8, padding: '6px 10px', background: 'rgba(255,255,255,.03)', borderRadius: 6 }}>
          <span style={{ color: C.muted, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase' }}>Subject ({locale})</span><br />
          {subject}
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '.1em', textTransform: 'uppercase' }}>Preview · {locale.toUpperCase()}</div>
        </div>
        <iframe
          srcDoc={html}
          sandbox=""
          title={`Trade Pulse preview ${locale}`}
          style={{ width: '100%', height: 800, border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff' }}
        />
      </div>

      <div style={{ marginTop: 18, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 10 }}>🔌 Wiring restant</div>
        <ul style={{ fontSize: 13, lineHeight: 1.9, color: C.text, margin: 0, paddingLeft: 20 }}>
          <li><code style={{ color: C.accent }}>sendTradePulse()</code> → <code style={{ color: C.muted }}>app/api/cron/trade-pulse-weekly/route.ts</code> (à créer)</li>
          <li>Cron Vercel : <code style={{ color: C.muted }}>0 8 * * 1</code> avec TZ Europe/Paris</li>
          <li>Source data : query <code style={{ color: C.muted }}>buyer_demands</code> + <code style={{ color: C.muted }}>commerce_leads</code> filtrées sur les 7 derniers jours</li>
        </ul>
      </div>
    </div>
  )
}
