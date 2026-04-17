/**
 * /auth/forgot — 3-step password reset.
 *
 *   Step 1 — email (+ Turnstile) → POST /api/auth/forgot
 *            Always advance to step 2 regardless of whether the email exists
 *            (anti-enumeration).
 *   Step 2 — OTP 6 digits + new password + confirm → POST /api/auth/reset
 *   Step 3 — success → redirect to /auth/login after 2s (no auto-login).
 *
 * A "renvoyer le code" link is shown in step 2 (server-side rate limit handles
 * abuse; we do not need a client-side cooldown here).
 */

import { getAuthConfig } from '@/lib/auth-v2'
import { ForgotFlow } from './flow'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default function ForgotPage() {
  const cfg = getAuthConfig()
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null
  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-neutral-100">
      <ForgotFlow
        brand={{ name: cfg.appName }}
        loginPath={cfg.loginPath}
        turnstileSiteKey={turnstileSiteKey}
      />
    </main>
  )
}
