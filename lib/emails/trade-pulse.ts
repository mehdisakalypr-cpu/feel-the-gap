import { Resend } from 'resend'

export type Locale = 'fr' | 'en'

const FROM = process.env.EMAIL_FROM || 'Feel The Gap Pulse <pulse@ofaops.xyz>'
const APPURL = process.env.NEXT_PUBLIC_APP_URL || 'https://feel-the-gap.vercel.app'
const POSTAL = process.env.EMAIL_POSTAL_ADDRESS || 'Feel The Gap · Paris, France'
const ACCENT = '#C9A84C'

export type TradePulseSignal = {
  country: string
  countryFlag?: string
  industry: string
  trigger: string
  evidenceUrl?: string
  growthPct?: number
  buyerCount?: number
  recommendedAction: string
}

export type TradePulseDealHighlight = {
  slug: string
  title: string
  hsCode?: string
  geo: string
  marginPct?: number
  url: string
}

export type TradePulseTrend = {
  label: string
  deltaPct: number
  detail: string
}

export type TradePulseVars = {
  email: string
  firstName?: string
  weekOfIso: string
  signals: TradePulseSignal[]
  highlights: TradePulseDealHighlight[]
  trends: TradePulseTrend[]
  dashboardUrl: string
  unsubscribeUrl: string
}

function tr(locale: Locale, fr: string, en: string): string {
  return locale === 'fr' ? fr : en
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtSignedPct(n: number, locale: Locale): string {
  const sign = n > 0 ? '+' : ''
  const formatted = n.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 1 })
  return `${sign}${formatted}%`
}

function signalRow(s: TradePulseSignal, locale: Locale): string {
  const flag = s.countryFlag ? `${s.countryFlag}&nbsp;` : ''
  const growth = typeof s.growthPct === 'number'
    ? `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${s.growthPct >= 0 ? 'rgba(16,185,129,.18)' : 'rgba(239,68,68,.18)'};color:${s.growthPct >= 0 ? '#10B981' : '#EF4444'};font-size:11px;font-weight:600;margin-left:8px">${fmtSignedPct(s.growthPct, locale)}</span>`
    : ''
  const buyers = typeof s.buyerCount === 'number'
    ? `<span style="color:#9BA8B8;font-size:12px;margin-left:8px">${s.buyerCount.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')} ${tr(locale, 'acheteurs', 'buyers')}</span>`
    : ''
  const evidence = s.evidenceUrl
    ? ` <a href="${escapeHtml(s.evidenceUrl)}" style="color:${ACCENT};text-decoration:none;font-size:12px">[${tr(locale, 'source', 'source')}]</a>`
    : ''
  return `<div style="padding:14px 0;border-bottom:1px solid rgba(201,168,76,.08)">
    <div style="font-size:13px;color:#9BA8B8;letter-spacing:.04em">${flag}${escapeHtml(s.country)} · ${escapeHtml(s.industry)}${growth}${buyers}</div>
    <div style="margin-top:4px;font-size:14px;color:#E8E0D0;line-height:1.5">${escapeHtml(s.trigger)}${evidence}</div>
    <div style="margin-top:6px;font-size:13px;color:${ACCENT}"><strong style="color:${ACCENT}">${tr(locale, 'Action', 'Action')} :</strong> ${escapeHtml(s.recommendedAction)}</div>
  </div>`
}

function highlightCard(h: TradePulseDealHighlight, locale: Locale): string {
  const margin = typeof h.marginPct === 'number'
    ? `<div style="margin-top:6px;color:#10B981;font-size:13px;font-weight:600">${tr(locale, 'Marge estimée', 'Est. margin')} ${fmtSignedPct(h.marginPct, locale)}</div>`
    : ''
  const hs = h.hsCode ? `<span style="font-size:11px;color:#9BA8B8;font-family:Menlo,monospace">HS ${escapeHtml(h.hsCode)}</span> · ` : ''
  return `<a href="${escapeHtml(h.url)}" style="display:block;padding:14px 16px;margin-bottom:10px;background:rgba(201,168,76,.05);border:1px solid rgba(201,168,76,.15);border-radius:8px;text-decoration:none">
    <div style="font-size:11px;color:#9BA8B8;letter-spacing:.04em">${hs}${escapeHtml(h.geo)}</div>
    <div style="margin-top:4px;font-size:15px;color:#E8E0D0;font-weight:600;line-height:1.3">${escapeHtml(h.title)}</div>
    ${margin}
  </a>`
}

function trendsList(trends: TradePulseTrend[], locale: Locale): string {
  if (!trends.length) return ''
  const items = trends.slice(0, 6).map(t => {
    const color = t.deltaPct >= 0 ? '#10B981' : '#EF4444'
    return `<div style="padding:8px 0;border-bottom:1px solid rgba(201,168,76,.06);font-size:13px;color:#E8E0D0;display:flex;justify-content:space-between">
      <span>${escapeHtml(t.label)} <span style="color:#9BA8B8;font-size:12px">— ${escapeHtml(t.detail)}</span></span>
      <strong style="color:${color}">${fmtSignedPct(t.deltaPct, locale)}</strong>
    </div>`
  }).join('')
  return `<div style="margin-top:24px"><div style="font-size:11px;color:${ACCENT};letter-spacing:.18em;text-transform:uppercase;margin-bottom:8px">${tr(locale, 'Tendances 7 jours', 'Trends · 7 days')}</div>${items}</div>`
}

export function tradePulseSubject(locale: Locale, v: TradePulseVars): string {
  const date = new Date(v.weekOfIso)
  const dateLabel = isNaN(date.getTime())
    ? v.weekOfIso
    : date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })
  const top = v.signals[0]
  if (top) {
    return tr(
      locale,
      `Trade Pulse · ${dateLabel} — ${top.country} ${top.industry}`,
      `Trade Pulse · ${dateLabel} — ${top.country} ${top.industry}`,
    )
  }
  return tr(locale, `Trade Pulse · ${dateLabel}`, `Trade Pulse · ${dateLabel}`)
}

export function tradePulseHtml(locale: Locale, v: TradePulseVars): string {
  const greet = v.firstName ? `${tr(locale, 'Bonjour', 'Hi')} ${escapeHtml(v.firstName)},` : tr(locale, 'Bonjour,', 'Hi there,')
  const date = new Date(v.weekOfIso)
  const dateLabel = isNaN(date.getTime())
    ? v.weekOfIso
    : date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })

  const intro = tr(
    locale,
    `Voici les signaux d'opportunité import-export détectés cette semaine sur les marchés émergents que tu suis. Synthèse <strong style="color:#E8E0D0">${escapeHtml(dateLabel)}</strong>.`,
    `Here are the import-export opportunity signals detected this week on the emerging markets you track. <strong style="color:#E8E0D0">${escapeHtml(dateLabel)}</strong> snapshot.`,
  )

  const signalsBlock = v.signals.length
    ? `<div style="margin-top:18px"><div style="font-size:11px;color:${ACCENT};letter-spacing:.18em;text-transform:uppercase;margin-bottom:6px">${tr(locale, 'Signaux d\'achat — top 5', 'Buying signals — top 5')}</div>${v.signals.slice(0, 5).map(s => signalRow(s, locale)).join('')}</div>`
    : ''

  const highlightsBlock = v.highlights.length
    ? `<div style="margin-top:24px"><div style="font-size:11px;color:${ACCENT};letter-spacing:.18em;text-transform:uppercase;margin-bottom:8px">${tr(locale, 'Niches en mouvement', 'Niches on the move')}</div>${v.highlights.slice(0, 4).map(h => highlightCard(h, locale)).join('')}</div>`
    : ''

  const cta = `<div style="margin:24px 0 8px"><a href="${escapeHtml(v.dashboardUrl)}" style="display:inline-block;background:${ACCENT};color:#040D1C;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;font-size:14px">${tr(locale, 'Voir le dashboard complet', 'Open the full dashboard')}</a></div>`

  const sourceNote = tr(
    locale,
    `<p style="margin-top:18px;color:#9BA8B8;font-size:12px;line-height:1.6">Données dérivées de sources publiques (douanes UE TARIC, Sirene FR, Companies House UK, OSM, Wikidata) + index propriétaire Feel The Gap. Aucune projection garantie.</p>`,
    `<p style="margin-top:18px;color:#9BA8B8;font-size:12px;line-height:1.6">Data derived from public sources (EU TARIC customs, Sirene FR, Companies House UK, OSM, Wikidata) plus the proprietary Feel The Gap index. No projection is guaranteed.</p>`,
  )

  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Trade Pulse</title></head>
<body style="margin:0;padding:0;background:#040D1C">
<div style="display:none;overflow:hidden;line-height:1px;max-height:0;max-width:0;opacity:0;color:transparent">${escapeHtml(tr(locale, `${v.signals.length} signaux d'achat détectés cette semaine.`, `${v.signals.length} buying signals detected this week.`))}</div>
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#040D1C;color:#E8E0D0;padding:32px 16px">
  <div style="max-width:600px;margin:0 auto;background:#0A1A2E;border:1px solid rgba(201,168,76,.15);border-radius:12px;overflow:hidden">
    <div style="padding:24px 28px 14px;border-bottom:1px solid rgba(201,168,76,.1)">
      <div style="font-size:11px;color:${ACCENT};letter-spacing:.2em;text-transform:uppercase">Trade Pulse</div>
      <div style="margin-top:4px;font-size:18px;color:#E8E0D0;font-weight:700">${escapeHtml(dateLabel)}</div>
    </div>
    <div style="padding:22px 28px 28px;font-size:15px;line-height:1.6">
      <p style="margin:0 0 10px">${greet}</p>
      <p style="margin:0;color:#9BA8B8">${intro}</p>
      ${signalsBlock}
      ${highlightsBlock}
      ${trendsList(v.trends, locale)}
      ${cta}
      ${sourceNote}
    </div>
    <div style="padding:18px 28px;border-top:1px solid rgba(201,168,76,.08);font-size:11px;color:#9BA8B8;line-height:1.7">
      ${escapeHtml(POSTAL)}<br>
      <a href="${escapeHtml(v.unsubscribeUrl)}" style="color:#9BA8B8;text-decoration:underline">${tr(locale, 'Se désabonner du Trade Pulse', 'Unsubscribe from Trade Pulse')}</a>
      &nbsp;·&nbsp;<a href="${escapeHtml(APPURL)}" style="color:${ACCENT};text-decoration:none">${APPURL.replace(/^https?:\/\//, '')}</a>
    </div>
  </div>
</div>
</body></html>`
}

export async function sendTradePulse(locale: Locale, v: TradePulseVars): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, reason: 'RESEND_API_KEY absent' }
  if (!v.email) return { ok: false, reason: 'no recipient' }
  try {
    const resend = new Resend(key)
    const res = await resend.emails.send({
      from: FROM,
      to: v.email,
      subject: tradePulseSubject(locale, v),
      html: tradePulseHtml(locale, v),
      tags: [
        { name: 'template', value: 'trade-pulse' },
        { name: 'week', value: v.weekOfIso.slice(0, 10) },
      ],
    } as any)
    if ((res as any).error) return { ok: false, reason: String((res as any).error.message ?? (res as any).error) }
    return { ok: true, id: String((res as any).data?.id ?? '') }
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? 'send failed' }
  }
}
