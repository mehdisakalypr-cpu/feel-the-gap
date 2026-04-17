/**
 * Next.js App Router middleware — auth brick v2.
 *
 * Responsibilities (ordered):
 *  1. Refresh Supabase tokens via supabaseMiddleware(req) — MANDATORY before any
 *     Server Component reads the session. Without this refresh, expired cookies
 *     leak through and getUser() returns stale/undefined.
 *  2. Resolve the current user with client.auth.getUser() (never trust the cookie
 *     directly per @supabase/ssr rules).
 *  3. If the request targets a protected path, enforce:
 *       a. user must be authenticated → else redirect to AUTH_LOGIN_PATH with ?next=
 *       b. user must have auth_site_access for this site → else redirect with
 *          ?reason=no_access (and sign the user out at the Supabase level is
 *          the API layer's job; we only block the nav here).
 *  4. Apply security headers on every response (DENY frames, HSTS, etc.).
 *
 * Config:
 *  - AUTH_PROTECTED_PATHS : CSV of path prefixes to protect (defaults below).
 *  - AUTH_LOGIN_PATH      : relative login path (resolved via getAuthConfig()).
 *
 * Static files are excluded by the matcher below.
 */

import { NextResponse, type NextRequest } from 'next/server'
import {
  getAuthConfig,
  supabaseMiddleware,
  supabaseAdmin,
  applySecurityHeaders,
} from '@/lib/auth-v2'

const DEFAULT_PROTECTED = ['/admin', '/dashboard', '/account', '/settings']

function getProtectedPrefixes(): string[] {
  const raw = process.env.AUTH_PROTECTED_PATHS?.trim()
  if (!raw) return DEFAULT_PROTECTED
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

function isProtected(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  // 1) Refresh tokens — ALWAYS, for every request in the matcher.
  const { client, response } = supabaseMiddleware(req)

  // 2) Resolve user (works whether route is protected or not; cheap call).
  const { data: userData } = await client.auth.getUser()
  const user = userData?.user ?? null

  const prefixes = getProtectedPrefixes()
  const loginPath = getAuthConfig().loginPath

  if (isProtected(pathname, prefixes)) {
    if (!user) {
      const url = req.nextUrl.clone()
      url.pathname = loginPath
      url.search = ''
      url.searchParams.set('next', pathname + (search || ''))
      const redirect = NextResponse.redirect(url)
      return applySecurityHeaders(redirect)
    }

    // 3) Site-access check via service role (bypass RLS).
    try {
      const admin = supabaseAdmin()
      const { data: access } = await admin
        .from('auth_site_access')
        .select('user_id, revoked_at')
        .eq('user_id', user.id)
        .eq('site_slug', getAuthConfig().siteSlug)
        .maybeSingle()

      if (!access || access.revoked_at) {
        const url = req.nextUrl.clone()
        url.pathname = loginPath
        url.search = ''
        url.searchParams.set('reason', 'no_access')
        const redirect = NextResponse.redirect(url)
        return applySecurityHeaders(redirect)
      }
    } catch {
      // If the check fails (network, DB down), fail closed — redirect to login.
      const url = req.nextUrl.clone()
      url.pathname = loginPath
      url.search = ''
      url.searchParams.set('reason', 'access_check_failed')
      const redirect = NextResponse.redirect(url)
      return applySecurityHeaders(redirect)
    }
  }

  // 4) Always apply security headers on the (possibly cookie-updated) response.
  return applySecurityHeaders(response())
}

/**
 * Matcher — exclude:
 *  - _next/static, _next/image
 *  - favicon, robots, sitemap, common static extensions
 *  - /api/* (API routes handle their own auth; the middleware cost is skipped)
 *
 * Note: keep this broad enough to cover protected paths AND cookie refresh on
 * all app pages (so session stays warm while browsing public pages).
 */
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|css|js|map|txt|woff|woff2|ttf|eot)$).*)',
  ],
}
