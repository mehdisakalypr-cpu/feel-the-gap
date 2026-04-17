/**
 * POST /api/auth/magic-link/start
 *
 * - CSRF + Turnstile + rate-limit (IP 5/15min, email 5/15min)
 * - Generates a Supabase magic link (type='magiclink')
 * - Sends a branded email containing the link (redirectTo=/auth/callback)
 * - Optionally stores a digest in `auth_magic_links` for audit/revocation (best-effort)
 * - Always returns 200 (anti-enumeration)
 */

import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  assertCsrf,
  getAuthConfig,
  supabaseAdmin,
  rateLimit,
  getClientIp,
  verifyTurnstile,
  sendEmail,
  logEvent,
} from '@/lib/auth-v2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY = 2 * 1024
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TTL_MIN = 15

function jsonError(status: number, error: string, extra: Record<string, unknown> = {}) {
  const res = NextResponse.json({ ok: false, error, ...extra }, { status })
  res.headers.set('Cache-Control', 'no-store')
  return res
}

function genericOk() {
  const res = NextResponse.json({ ok: true })
  res.headers.set('Cache-Control', 'no-store')
  return res
}

function sanitizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const e = raw.trim().toLowerCase()
  if (!EMAIL_RE.test(e) || e.length > 254) return null
  return e
}

function renderMagicLinkEmail(args: { brand: string; link: string; ttlMin: number }) {
  const subject = `[${args.brand}] Votre lien de connexion`
  const html = `<!doctype html><html><body style="font-family: system-ui, -apple-system, sans-serif; background:#0b0b0b; color:#fafafa; padding:24px;">
    <div style="max-width:480px; margin:auto; background:#141414; border:1px solid #2a2a2a; border-radius:12px; padding:24px;">
      <h1 style="font-size:18px; margin:0 0 12px;">${args.brand}</h1>
      <h2 style="font-size:16px; margin:0 0 16px;">Connexion par lien magique</h2>
      <p style="color:#c9c9c9; line-height:1.5; margin:0 0 16px;">Cliquez sur le bouton ci-dessous pour vous connecter :</p>
      <p style="text-align:center; margin:16px 0;">
        <a href="${args.link}" style="display:inline-block; padding:12px 20px; background:#fafafa; color:#0b0b0b; border-radius:8px; text-decoration:none; font-weight:600;">Se connecter</a>
      </p>
      <p style="color:#9a9a9a; font-size:13px; margin:16px 0 0;">Ce lien expire dans ${args.ttlMin} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    </div>
  </body></html>`
  const text = `${args.brand}\nLien de connexion\n\n${args.link}\n\nExpiration : ${args.ttlMin} minutes.`
  return { subject, html, text }
}

export async function POST(req: NextRequest) {
  const csrf = assertCsrf(req)
  if (csrf !== true) return jsonError(csrf.status, csrf.error)

  const ip = getClientIp(req)
  const ua = req.headers.get('user-agent')
  const cfg = getAuthConfig()

  const raw = await req.text()
  if (raw.length > MAX_BODY) return jsonError(413, 'payload_too_large')
  let body: { email?: unknown; captchaToken?: unknown }
  try { body = JSON.parse(raw) } catch { return jsonError(400, 'invalid_json') }

  const email = sanitizeEmail(body?.email)
  const captchaToken = typeof body?.captchaToken === 'string' ? body!.captchaToken : null

  if (!email) return genericOk()

  const [ipRl, emailRl] = await Promise.all([
    rateLimit({ key: `magic:ip:${ip}`, limit: 5, windowSec: 900 }),
    rateLimit({ key: `magic:email:${email}`, limit: 5, windowSec: 900 }),
  ])
  if (!ipRl.ok || !emailRl.ok) {
    const retryAfter = Math.max(ipRl.retryAfter, emailRl.retryAfter) || 60
    const res = jsonError(429, 'Trop de tentatives.', { retry_after: retryAfter })
    res.headers.set('Retry-After', String(retryAfter))
    return res
  }

  const t = await verifyTurnstile(captchaToken, ip)
  if (!t.ok) return jsonError(400, 'Vérification anti-bot échouée')

  try {
    const admin = supabaseAdmin()
    const scheme = cfg.primaryDomain === 'localhost' ? 'http' : 'https'
    const redirectTo = `${scheme}://${cfg.primaryDomain}/auth/callback`

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    })

    if (!linkErr && link?.properties?.action_link) {
      // Best-effort digest audit log (ignored if table missing in older schemas).
      try {
        const digest = crypto.createHash('sha256').update(link.properties.action_link).digest()
        await admin.from('auth_magic_links').insert({
          email_hash: crypto.createHash('sha256').update(email).digest(),
          site_slug: cfg.siteSlug,
          link_digest: digest,
          expires_at: new Date(Date.now() + TTL_MIN * 60 * 1000).toISOString(),
          ip: ip ?? null,
        })
      } catch { /* table optional */ }

      const tpl = renderMagicLinkEmail({ brand: cfg.appName, link: link.properties.action_link, ttlMin: TTL_MIN })
      await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text })
      // Fetch userId for audit (best-effort)
      const { data: profile } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
      await logEvent({ userId: profile?.id ?? null, event: 'magic_link_sent', ip, ua })
    }
  } catch {
    // Swallow — anti-enumeration.
  }

  return genericOk()
}
