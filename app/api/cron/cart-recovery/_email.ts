/**
 * Cart abandonment recovery — Resend email templates.
 *
 * NOTE EMPLACEMENT : ce fichier devrait idéalement vivre sous
 * `lib/email/cart-recovery.ts` (cf. spec STORE_PLATFORM_SPEC_V2_ADDITIONS §3).
 * Colocalisé ici parce que le sandbox subagent n'a pas accès à `/lib/email/`
 * pour cette session — à déplacer dans un commit suivant. Underscore prefix
 * → ignoré par le router Next.js.
 *
 * Templates :
 *   - sendCartRecovery1 (T+1h) — soft reminder
 *   - sendCartRecovery2 (T+24h) — social proof
 *   - sendCartRecovery3 (T+72h) — discount code 10%
 *
 * Pattern hérité de `lib/email/marketplace.ts::emailBase()` (même charte FTG).
 * Footer obligatoire avec lien unsubscribe (CAN-SPAM / RGPD).
 */

import { Resend } from 'resend'
import type { AbandonedCart } from './_scheduler'

const FROM = process.env.EMAIL_FROM || 'Feel The Gap <outreach@ofaops.xyz>'
const APPURL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.gapup.io'
const POSTAL = process.env.EMAIL_POSTAL_ADDRESS || 'Feel The Gap · Paris, France'

function recoveryUrl(cart: AbandonedCart): string {
  return `${APPURL}/store/${cart.store_slug}/cart?recover=${cart.id}`
}

function unsubscribeUrl(cart: AbandonedCart): string {
  if (!cart.buyer_email) return `${APPURL}/account/notifications`
  return `${APPURL}/account/notifications?email=${encodeURIComponent(cart.buyer_email)}&topic=recovery`
}

function fmtMoney(cents: number, currency: string): string {
  const amount = cents / 100
  try {
    return amount.toLocaleString('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 })
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function itemsHtml(cart: AbandonedCart): string {
  if (!cart.items.length) {
    return '<div style="color:rgba(255,255,255,.55);font-size:13px">—</div>'
  }
  return cart.items
    .slice(0, 6)
    .map((it) => {
      const name = escapeHtml(it.name ?? 'Produit')
      const qty = it.qty ?? 1
      const line = it.price_cents != null ? fmtMoney(it.price_cents * qty, cart.currency) : ''
      const img = it.image_url
        ? `<img src="${escapeHtml(it.image_url)}" alt="" width="48" height="48" style="border-radius:6px;object-fit:cover;margin-right:12px;vertical-align:middle">`
        : ''
      return `<div style="display:flex;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)">
        ${img}
        <div style="flex:1;color:rgba(255,255,255,.85);font-size:14px">
          <strong>${name}</strong> × ${qty}
        </div>
        <div style="color:#fff;font-size:14px;font-weight:600">${line}</div>
      </div>`
    })
    .join('')
}

function emailBase(cart: AbandonedCart, content: string): string {
  return `<div style="font-family:system-ui,sans-serif;background:#07090F;color:#e2e8f0;padding:40px 32px;max-width:600px;margin:0 auto">
  <div style="margin-bottom:24px">
    <span style="color:#C9A84C;font-weight:800;font-size:18px;letter-spacing:.04em">${escapeHtml(cart.store_name)}</span>
  </div>
  ${content}
  <div style="margin-top:32px;padding-top:20px;border-top:1px solid rgba(255,255,255,.08);font-size:12px;color:rgba(255,255,255,.4);line-height:1.6">
    ${escapeHtml(POSTAL)}<br>
    <a href="${unsubscribeUrl(cart)}" style="color:rgba(255,255,255,.5);text-decoration:underline">Se désabonner des relances panier</a>
    · <a href="${APPURL}" style="color:#C9A84C;text-decoration:none">${APPURL.replace(/^https?:\/\//, '')}</a>
  </div>
</div>`
}

async function send(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.log(`[email/cart-recovery] RESEND_API_KEY absent — skip "${subject}" to ${to}`)
    return false
  }
  if (!to) return false
  try {
    const resend = new Resend(key)
    await resend.emails.send({ from: FROM, to, subject, html })
    return true
  } catch (err) {
    console.error('[email/cart-recovery] send error', err)
    return false
  }
}

// ── Vague 1 : T+1h — soft reminder ───────────────────────────────────────
export async function sendCartRecovery1(cart: AbandonedCart): Promise<boolean> {
  if (!cart.buyer_email) return false
  const total = fmtMoney(cart.subtotal_cents, cart.currency)
  const html = emailBase(
    cart,
    `
    <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">🛒 Vous avez oublié quelque chose ?</h2>
    <p style="color:rgba(255,255,255,.7);line-height:1.6;margin-bottom:20px">
      Votre panier chez <strong>${escapeHtml(cart.store_name)}</strong> vous attend. Reprenez là où vous en étiez en un clic.
    </p>
    <div style="margin:20px 0;padding:16px;background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.2);border-radius:10px">
      ${itemsHtml(cart)}
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;font-size:14px">
        <span style="color:rgba(255,255,255,.6)">Total</span>
        <span style="color:#fff;font-weight:700">${total}</span>
      </div>
    </div>
    <a href="${recoveryUrl(cart)}" style="display:inline-block;background:#C9A84C;color:#07090F;padding:12px 24px;text-decoration:none;font-weight:700;border-radius:8px">
      Reprendre mon panier →
    </a>
  `,
  )
  return send(cart.buyer_email, `🛒 Votre panier ${cart.store_name} vous attend`, html)
}

// ── Vague 2 : T+24h — social proof ───────────────────────────────────────
export async function sendCartRecovery2(cart: AbandonedCart): Promise<boolean> {
  if (!cart.buyer_email) return false
  const total = fmtMoney(cart.subtotal_cents, cart.currency)
  const html = emailBase(
    cart,
    `
    <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">⏳ Encore disponible — mais plus pour longtemps</h2>
    <p style="color:rgba(255,255,255,.7);line-height:1.6;margin-bottom:16px">
      Des centaines d'acheteurs ont commandé chez <strong>${escapeHtml(cart.store_name)}</strong> ce mois-ci.
      Votre panier est toujours réservé, mais le stock peut partir vite.
    </p>
    <div style="margin:16px 0;padding:14px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.25);border-radius:10px;color:rgba(255,255,255,.85);font-size:14px">
      ⭐ <strong>4.8/5</strong> · note moyenne des acheteurs récents
    </div>
    <div style="margin:20px 0;padding:16px;background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.2);border-radius:10px">
      ${itemsHtml(cart)}
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;font-size:14px">
        <span style="color:rgba(255,255,255,.6)">Total</span>
        <span style="color:#fff;font-weight:700">${total}</span>
      </div>
    </div>
    <a href="${recoveryUrl(cart)}" style="display:inline-block;background:#C9A84C;color:#07090F;padding:12px 24px;text-decoration:none;font-weight:700;border-radius:8px">
      Finaliser ma commande →
    </a>
    <p style="color:rgba(255,255,255,.45);font-size:12px;margin-top:16px">Paiement sécurisé Stripe · Livraison rapide · Support 7j/7</p>
  `,
  )
  return send(cart.buyer_email, `⏳ ${cart.store_name} — votre panier est encore là`, html)
}

// ── Vague 3 : T+72h — code promo 10% ─────────────────────────────────────
export async function sendCartRecovery3(cart: AbandonedCart, discountCode: string): Promise<boolean> {
  if (!cart.buyer_email) return false
  const total = fmtMoney(cart.subtotal_cents, cart.currency)
  const html = emailBase(
    cart,
    `
    <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">🎁 Un dernier geste : -10 % sur votre panier</h2>
    <p style="color:rgba(255,255,255,.7);line-height:1.6;margin-bottom:16px">
      On vous offre <strong style="color:#C9A84C">10 % de réduction</strong> sur votre panier
      ${escapeHtml(cart.store_name)} pour vous remercier de votre intérêt.
      Code valable 7 jours, applicable au checkout.
    </p>
    <div style="margin:20px 0;padding:20px;background:rgba(16,185,129,.08);border:2px dashed rgba(16,185,129,.45);border-radius:12px;text-align:center">
      <div style="font-size:11px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Votre code</div>
      <div style="font-size:24px;font-weight:800;color:#10B981;letter-spacing:.1em;font-family:ui-monospace,monospace">${escapeHtml(discountCode)}</div>
      <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:6px">-10 % · 1 utilisation · 7 jours</div>
    </div>
    <div style="margin:20px 0;padding:16px;background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.2);border-radius:10px">
      ${itemsHtml(cart)}
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;font-size:14px">
        <span style="color:rgba(255,255,255,.6)">Total avant remise</span>
        <span style="color:#fff;font-weight:700">${total}</span>
      </div>
    </div>
    <a href="${recoveryUrl(cart)}&code=${encodeURIComponent(discountCode)}" style="display:inline-block;background:#10B981;color:#07090F;padding:12px 24px;text-decoration:none;font-weight:700;border-radius:8px">
      Utiliser ma remise →
    </a>
    <p style="color:rgba(255,255,255,.45);font-size:12px;margin-top:16px">⚡ Stock limité — premier arrivé, premier servi.</p>
  `,
  )
  return send(cart.buyer_email, `🎁 -10 % sur votre panier ${cart.store_name} (7j)`, html)
}
