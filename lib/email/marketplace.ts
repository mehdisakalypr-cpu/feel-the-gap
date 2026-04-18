/**
 * Emails transactionnels marketplace — Vague 1 #2 · 2026-04-18
 * Fail-silent si RESEND_API_KEY absent (log + no-op, jamais de throw).
 *
 * Templates :
 * - new_match         → producer + buyer (match scoré ≥ floor généré par matcher cron)
 * - match_confirmed   → les deux parties ont accepté (CTA initier escrow)
 * - escrow_released   → POD validé, fonds transférés (thank-you + invoice)
 */

import { Resend } from 'resend'

const FROM   = process.env.EMAIL_FROM     || 'Feel The Gap <outreach@ofaops.xyz>'
const APPURL = process.env.NEXT_PUBLIC_APP_URL || 'https://feel-the-gap.vercel.app'

function emailBase(content: string): string {
  return `<div style="font-family:system-ui,sans-serif;background:#07090F;color:#e2e8f0;padding:40px 32px;max-width:600px;margin:0 auto">
  <div style="margin-bottom:24px">
    <span style="color:#C9A84C;font-weight:800;font-size:18px;letter-spacing:.04em">Feel The Gap · Marketplace B2B</span>
  </div>
  ${content}
  <div style="margin-top:32px;padding-top:20px;border-top:1px solid rgba(255,255,255,.08);font-size:12px;color:rgba(255,255,255,.3)">
    Feel The Gap · <a href="${APPURL}" style="color:#C9A84C;text-decoration:none">${APPURL.replace(/^https?:\/\//, '')}</a>
  </div>
</div>`
}

async function send(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.log(`[email/marketplace] RESEND_API_KEY absent — skip "${subject}" to ${to}`)
    return false
  }
  if (!to) return false
  try {
    const resend = new Resend(key)
    await resend.emails.send({ from: FROM, to, subject, html })
    return true
  } catch (err) {
    console.error('[email/marketplace] send error', err)
    return false
  }
}

function fmtEur(v: number | null | undefined, digits = 2): string {
  if (v == null) return '—'
  return v.toLocaleString('fr-FR', { maximumFractionDigits: digits }) + ' €'
}

function fmtKg(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1000) return (v / 1000).toFixed(1) + ' t'
  return v.toLocaleString('fr-FR') + ' kg'
}

// ── new_match ─────────────────────────────────────────────────────────────
export async function emailNewMatch(args: {
  to: string
  role: 'producer' | 'buyer'
  matchId: string
  productLabel: string
  countryIso: string | null
  quantityKg: number
  pricePerKg: number
  totalEur: number
  score: number
}): Promise<boolean> {
  const { to, role, matchId, productLabel, countryIso, quantityKg, pricePerKg, totalEur, score } = args
  const roleLabel = role === 'producer' ? 'Acheteur intéressé' : 'Volume producteur disponible'
  const intro = role === 'producer'
    ? 'Un acheteur correspond à votre volume déclaré. Acceptez le match pour démarrer la discussion.'
    : 'Un producteur correspond à votre demande. Acceptez le match pour démarrer la discussion.'

  const html = emailBase(`
    <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">🎯 Nouveau match — ${productLabel}${countryIso ? ` · ${countryIso}` : ''}</h2>
    <p style="color:rgba(255,255,255,.7);line-height:1.6;margin-bottom:20px">${intro}</p>
    <div style="margin:20px 0;padding:16px;background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.25);border-radius:10px">
      <div style="font-size:12px;color:rgba(255,255,255,.5);margin-bottom:4px">${roleLabel} · Score de compatibilité ${score}/100</div>
      <div style="font-size:16px;font-weight:700;color:#C9A84C;margin-bottom:8px">${productLabel}${countryIso ? ` — ${countryIso}` : ''}</div>
      <div style="font-size:14px;color:rgba(255,255,255,.85);line-height:1.7">
        Quantité : <strong>${fmtKg(quantityKg)}</strong><br>
        Prix proposé : <strong>${fmtEur(pricePerKg)} / kg</strong><br>
        Total : <strong style="color:#fff">${fmtEur(totalEur, 0)}</strong>
      </div>
    </div>
    <a href="${APPURL}/marketplace/${matchId}" style="display:inline-block;background:#C9A84C;color:#07090F;padding:12px 24px;text-decoration:none;font-weight:700;border-radius:8px">
      Voir le match →
    </a>
  `)
  return send(to, `🎯 Nouveau match FTG — ${productLabel}`, html)
}

// ── match_confirmed ───────────────────────────────────────────────────────
export async function emailMatchConfirmed(args: {
  to: string
  role: 'producer' | 'buyer'
  matchId: string
  productLabel: string
  countryIso: string | null
  totalEur: number
  commissionEur: number
}): Promise<boolean> {
  const { to, role, matchId, productLabel, countryIso, totalEur, commissionEur } = args
  const cta = role === 'buyer'
    ? `Prochaine étape : initier l'escrow Stripe pour sécuriser le paiement (fonds en séquestre jusqu'à livraison).`
    : `Prochaine étape : l'acheteur va initier l'escrow Stripe. Assurez-vous que votre compte Stripe Connect est activé pour recevoir les fonds.`
  const btn = role === 'buyer' ? `Initier l'escrow →` : `Voir le match →`

  const html = emailBase(`
    <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">🎉 Match confirmé — ${productLabel}${countryIso ? ` · ${countryIso}` : ''}</h2>
    <p style="color:rgba(255,255,255,.7);line-height:1.6;margin-bottom:16px">
      Producteur et acheteur ont accepté. Le match passe en statut <strong>confirmé</strong>.
    </p>
    <p style="color:rgba(255,255,255,.7);line-height:1.6;margin-bottom:20px">${cta}</p>
    <div style="margin:20px 0;padding:16px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:10px">
      <div style="font-size:14px;color:rgba(255,255,255,.85);line-height:1.7">
        Total transaction : <strong style="color:#fff">${fmtEur(totalEur, 0)}</strong><br>
        Commission plateforme : <strong style="color:#10B981">${fmtEur(commissionEur, 0)}</strong>
      </div>
    </div>
    <a href="${APPURL}/marketplace/${matchId}" style="display:inline-block;background:#10B981;color:#07090F;padding:12px 24px;text-decoration:none;font-weight:700;border-radius:8px">
      ${btn}
    </a>
  `)
  return send(to, `🎉 Match confirmé FTG — ${productLabel}`, html)
}

// ── escrow_released ───────────────────────────────────────────────────────
export async function emailEscrowReleased(args: {
  to: string
  role: 'producer' | 'buyer'
  matchId: string
  productLabel: string
  amountEur: number
  commissionEur: number
  paymentIntentId: string
}): Promise<boolean> {
  const { to, role, matchId, productLabel, amountEur, commissionEur, paymentIntentId } = args
  const intro = role === 'producer'
    ? `Bonne nouvelle : la livraison est confirmée. Les fonds ont été transférés sur votre compte Stripe Connect.`
    : `Merci d'avoir confirmé la livraison. Les fonds ont été libérés au producteur.`

  const html = emailBase(`
    <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">✅ Escrow libéré — ${productLabel}</h2>
    <p style="color:rgba(255,255,255,.7);line-height:1.6;margin-bottom:16px">${intro}</p>
    <div style="margin:20px 0;padding:16px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.25);border-radius:10px">
      <div style="font-size:14px;color:rgba(255,255,255,.85);line-height:1.7">
        ${role === 'producer'
          ? `Reçu (net) : <strong style="color:#fff">${fmtEur(amountEur - commissionEur, 0)}</strong><br>`
          : `Total payé : <strong style="color:#fff">${fmtEur(amountEur, 0)}</strong><br>`}
        Commission plateforme : <strong style="color:#3B82F6">${fmtEur(commissionEur, 0)}</strong><br>
        Référence Stripe : <code style="color:rgba(255,255,255,.5);font-size:11px">${paymentIntentId}</code>
      </div>
    </div>
    <a href="${APPURL}/marketplace/${matchId}" style="display:inline-block;background:#3B82F6;color:#07090F;padding:12px 24px;text-decoration:none;font-weight:700;border-radius:8px">
      Voir le récapitulatif →
    </a>
    <p style="color:rgba(255,255,255,.4);font-size:12px;margin-top:20px;line-height:1.6">
      Cet email sert de preuve de transaction. Conservez-le pour vos archives comptables.
    </p>
  `)
  return send(to, `✅ FTG — Transaction ${productLabel} complétée`, html)
}
