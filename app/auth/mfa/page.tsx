/**
 * /auth/mfa — 2FA prompt after a password-authenticated login.
 *
 * Reads ?token=<mfa_token> from the URL (HMAC-signed, 5min TTL, issued by
 * /api/auth/login). User enters a TOTP or recovery code; on success, the
 * server returns Supabase session tokens which we set via the browser client
 * so the middleware picks them up.
 */

import { getAuthConfig } from '@/lib/auth-v2'
import { MfaFlow } from './flow'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default function MfaPage() {
  const cfg = getAuthConfig()
  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-neutral-100">
      <MfaFlow
        brand={{ name: cfg.appName }}
        postLoginPath={cfg.postLoginPath}
        loginPath={cfg.loginPath}
      />
    </main>
  )
}
