/**
 * Resend wrapper — single sender for the current site.
 * Each project sets AUTH_EMAIL_FROM and AUTH_EMAIL_BRAND_NAME.
 */

import { getAuthConfig } from './config'

export async function sendEmail(args: { to: string; subject: string; html: string; text: string }) {
  const cfg = getAuthConfig()
  if (!cfg.secrets.resendKey) {
    if (cfg.env !== 'production') {
      console.warn('[auth-v2] RESEND_API_KEY missing — skipping email in', cfg.env)
      return { ok: true, skipped: true }
    }
    throw new Error('RESEND_API_KEY missing in production')
  }
  const from = process.env.AUTH_EMAIL_FROM || `${cfg.appName} <noreply@${cfg.primaryDomain}>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.secrets.resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [args.to], subject: args.subject, html: args.html, text: args.text }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend failed ${res.status}: ${body.slice(0, 200)}`)
  }
  return { ok: true }
}

export function renderOtpEmail(args: { code: string; purpose: 'reset' | 'verify'; brand: string; ttlMin: number }) {
  const title = args.purpose === 'reset' ? 'Réinitialisation du mot de passe' : 'Vérification de votre email'
  const html = `<!doctype html><html><body style="font-family: system-ui, -apple-system, sans-serif; background:#0b0b0b; color:#fafafa; padding:24px;">
    <div style="max-width:480px; margin:auto; background:#141414; border:1px solid #2a2a2a; border-radius:12px; padding:24px;">
      <h1 style="font-size:18px; margin:0 0 12px;">${args.brand}</h1>
      <h2 style="font-size:16px; margin:0 0 16px;">${title}</h2>
      <p style="color:#c9c9c9; line-height:1.5; margin:0 0 16px;">Votre code de vérification :</p>
      <div style="font-size:28px; font-weight:700; letter-spacing:6px; padding:12px 16px; background:#1f1f1f; border-radius:8px; text-align:center;">${args.code}</div>
      <p style="color:#9a9a9a; font-size:13px; margin:16px 0 0;">Ce code expire dans ${args.ttlMin} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    </div>
  </body></html>`
  const text = `${args.brand}\n${title}\n\nCode : ${args.code}\nExpiration : ${args.ttlMin} minutes.\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`
  return { html, text, subject: `[${args.brand}] ${title} — code ${args.code}` }
}
