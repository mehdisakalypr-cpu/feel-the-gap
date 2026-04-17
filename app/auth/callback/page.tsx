/**
 * /auth/callback — OAuth & magic-link landing.
 *
 * Supports two Supabase return shapes:
 *  - ?code=…           (PKCE OAuth flow) → exchangeCodeForSession
 *  - ?token_hash=…&type=magiclink|recovery|email|signup → verifyOtp
 *
 * After a successful exchange, we query /api/auth/me to perform the same
 * site-access gate the middleware would apply — so callback users who belong
 * to Supabase but not to this site are bounced cleanly.
 */

import { getAuthConfig } from '@/lib/auth-v2'
import { CallbackHandler } from './handler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default function CallbackPage() {
  const cfg = getAuthConfig()
  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-neutral-100">
      <CallbackHandler
        postLoginPath={cfg.postLoginPath}
        loginPath={cfg.loginPath}
      />
    </main>
  )
}
