/**
 * Welcome email (transactional post-signup).
 * Wired by app/api/auth/register/route.ts.
 *
 * Intentionally minimal: composes a plain HTML + text body and dispatches
 * through Resend. Failure is non-fatal — the caller logs it and continues.
 */
import { Resend } from 'resend'

export type WelcomeProduct = {
  productName: string
  productUrl: string
  fromAddress?: string
  supportEmail?: string
}

export type WelcomePayload = {
  firstName?: string
  email: string
  loginUrl: string
  pricingUrl: string
  demoUrl: string
  unsubscribeUrl: string
}

export type WelcomeResult = { ok: true; id?: string } | { ok: false; reason: string }

const SUBJECTS: Record<'fr' | 'en', (productName: string) => string> = {
  fr: (p) => `Bienvenue sur ${p} — premiers pas`,
  en: (p) => `Welcome to ${p} — getting started`,
}

function renderHtml(product: WelcomeProduct, payload: WelcomePayload, locale: 'fr' | 'en'): string {
  const greet = locale === 'fr' ? `Bonjour ${payload.firstName ?? ''}` : `Hi ${payload.firstName ?? 'there'}`
  const intro = locale === 'fr'
    ? `Ton compte ${product.productName} est actif.`
    : `Your ${product.productName} account is active.`
  const ctaPricing = locale === 'fr' ? 'Voir les offres' : 'See pricing'
  const ctaDemo = locale === 'fr' ? 'Voir la démo live' : 'See the live demo'
  const ctaLogin = locale === 'fr' ? 'Se connecter' : 'Sign in'
  const supportLine = product.supportEmail
    ? (locale === 'fr'
        ? `Une question ? <a href="mailto:${product.supportEmail}">${product.supportEmail}</a>`
        : `Questions? <a href="mailto:${product.supportEmail}">${product.supportEmail}</a>`)
    : ''

  return `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;color:#1F2937;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:22px;margin:0 0 12px;">${greet}</h1>
  <p>${intro}</p>
  <p style="margin:24px 0;">
    <a href="${payload.loginUrl}" style="display:inline-block;padding:10px 18px;background:#0EA5E9;color:#FFF;text-decoration:none;border-radius:8px;font-weight:600;">${ctaLogin}</a>
    &nbsp;
    <a href="${payload.pricingUrl}" style="display:inline-block;padding:10px 18px;background:#F97316;color:#FFF;text-decoration:none;border-radius:8px;font-weight:600;">${ctaPricing}</a>
    &nbsp;
    <a href="${payload.demoUrl}" style="display:inline-block;padding:10px 18px;background:transparent;color:#1F2937;text-decoration:none;border:1px solid #1F2937;border-radius:8px;font-weight:500;">${ctaDemo}</a>
  </p>
  <p style="font-size:13px;color:#6B7280;margin-top:32px;">${supportLine}</p>
  <p style="font-size:11px;color:#9CA3AF;margin-top:18px;">
    <a href="${payload.unsubscribeUrl}" style="color:#9CA3AF;">${locale === 'fr' ? 'Se désinscrire des emails transactionnels' : 'Unsubscribe transactional emails'}</a>
  </p>
</body></html>`
}

function renderText(product: WelcomeProduct, payload: WelcomePayload, locale: 'fr' | 'en'): string {
  const greet = locale === 'fr' ? `Bonjour ${payload.firstName ?? ''}` : `Hi ${payload.firstName ?? 'there'}`
  const intro = locale === 'fr'
    ? `Ton compte ${product.productName} est actif.`
    : `Your ${product.productName} account is active.`
  return `${greet}

${intro}

- ${locale === 'fr' ? 'Se connecter' : 'Sign in'} : ${payload.loginUrl}
- ${locale === 'fr' ? 'Voir les offres' : 'See pricing'} : ${payload.pricingUrl}
- ${locale === 'fr' ? 'Voir la démo' : 'See the demo'} : ${payload.demoUrl}

${product.supportEmail ? `${locale === 'fr' ? 'Une question' : 'Questions'} : ${product.supportEmail}` : ''}

${locale === 'fr' ? 'Se désinscrire' : 'Unsubscribe'}: ${payload.unsubscribeUrl}
`
}

export async function sendWelcome(
  product: WelcomeProduct,
  locale: 'fr' | 'en',
  payload: WelcomePayload,
): Promise<WelcomeResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, reason: 'RESEND_API_KEY missing' }

  const from = product.fromAddress ?? process.env.AUTH_EMAIL_FROM ?? 'noreply@gapup.io'
  const subject = SUBJECTS[locale](product.productName)

  try {
    const resend = new Resend(apiKey)
    const r = await resend.emails.send({
      from,
      to: payload.email,
      subject,
      html: renderHtml(product, payload, locale),
      text: renderText(product, payload, locale),
    })
    if ((r as any)?.error) return { ok: false, reason: String((r as any).error?.message ?? (r as any).error) }
    return { ok: true, id: (r as any)?.data?.id }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'unknown error' }
  }
}
