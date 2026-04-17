/**
 * /auth/register — email + password + display_name.
 *
 * Server shell passes config; the form itself is client-side.
 * Dynamic rendering is mandatory (CSRF cookie is set on entry).
 */

import { getAuthConfig } from '@/lib/auth-v2'
import { RegisterForm } from './form'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: string }>
}) {
  const cfg = getAuthConfig()
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null
  const params = (await searchParams) ?? {}
  const rawRedirect = params.redirect ?? ''
  const postLoginPath = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
    ? rawRedirect
    : cfg.postLoginPath
  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-neutral-100">
      <RegisterForm
        brand={{ name: cfg.appName }}
        turnstileSiteKey={turnstileSiteKey}
        loginPath={cfg.loginPath}
        postLoginPath={postLoginPath}
      />
    </main>
  )
}
