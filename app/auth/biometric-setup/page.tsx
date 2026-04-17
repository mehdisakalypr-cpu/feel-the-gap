/**
 * /auth/biometric-setup — post-login passkey enrollment.
 *
 * Proposes the user to register a platform passkey right after first login.
 * If user already has a passkey on this RP, shows a "Vous êtes déjà configuré"
 * message (the API returns credentials when known — but for this page we just
 * kick off register/start and let the server reject gracefully).
 */

import { getAuthConfig } from '@/lib/auth-v2'
import { BiometricSetupFlow } from './flow'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default function BiometricSetupPage() {
  const cfg = getAuthConfig()
  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-neutral-100">
      <BiometricSetupFlow
        brand={{ name: cfg.appName }}
        postLoginPath={cfg.postLoginPath}
      />
    </main>
  )
}
