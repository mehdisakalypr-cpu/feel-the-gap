/**
 * /auth/reset-password — legacy path kept for compatibility.
 *
 * The v2 flow performs OTP verification + new-password submission in a single
 * step under /auth/forgot (step 2). We don't render anything here — just
 * redirect so external links keep working.
 */

import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default function ResetPasswordPage() {
  redirect('/auth/forgot')
}
