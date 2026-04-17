/**
 * /auth/login — Server Component parent.
 *
 * Reads the auth config server-side (brand, paths, turnstile site key) and
 * hands them down to <LoginForm/>. Dynamic rendering mandatory: we must never
 * cache a page that can set session cookies.
 */

import { getAuthConfig } from '@/lib/auth-v2'
import { LoginForm } from '@/components/auth/LoginForm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default function LoginPage() {
  const cfg = getAuthConfig()
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-neutral-100">
      <LoginForm
        postLoginPath={cfg.postLoginPath}
        brand={{ name: cfg.appName }}
        turnstileSiteKey={turnstileSiteKey}
        registerPath="/auth/register"
        forgotPath="/auth/forgot"
      />
    </main>
  )
}
