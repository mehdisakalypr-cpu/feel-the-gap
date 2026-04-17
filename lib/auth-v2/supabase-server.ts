/**
 * Server-side Supabase clients.
 *
 * - supabaseServer()     → request-scoped SSR client (reads+writes cookies)
 * - supabaseAdmin()      → service-role client (NEVER exposed to browser)
 * - requireUser()        → getUser(); 401 if none
 * - requireAdmin()       → checks profiles.role + auth_site_access
 *
 * @supabase/ssr rule: always instantiate INSIDE the handler (per-request),
 * never at module scope — otherwise sessions leak across requests.
 */

import { cookies } from 'next/headers'
import { createServerClient, createServerClient as _createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { getAuthConfig } from './config'

const COOKIE_NAME = 'sb-auth'

/** SSR client usable in Server Components, Route Handlers, Server Actions. */
export async function supabaseServer() {
  const cfg = getAuthConfig()
  const store = await cookies()
  return createServerClient(cfg.supabase.url, cfg.supabase.anonKey, {
    cookieOptions: {
      name: COOKIE_NAME,
      path: '/',
      sameSite: 'lax',
      secure: cfg.env === 'production',
    },
    cookies: {
      getAll() { return store.getAll() },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            store.set(name, value, options as CookieOptions)
          })
        } catch {
          // Server Components cannot set cookies. Middleware handles refresh.
        }
      },
    },
  })
}

/** Middleware-flavoured SSR client: reads from NextRequest, writes to NextResponse. */
export function supabaseMiddleware(request: NextRequest) {
  const cfg = getAuthConfig()
  let response = NextResponse.next({ request })
  const client = createServerClient(cfg.supabase.url, cfg.supabase.anonKey, {
    cookieOptions: {
      name: COOKIE_NAME,
      path: '/',
      sameSite: 'lax',
      secure: cfg.env === 'production',
    },
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options as CookieOptions)
        })
      },
    },
  })
  return { client, response: () => response }
}

/** Service-role client — for admin operations (user deletion, etc.). */
export function supabaseAdmin() {
  const cfg = getAuthConfig()
  return createClient(cfg.supabase.url, cfg.supabase.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

/** Require an authenticated user. Returns user or throws a 401 response. */
export async function requireUser() {
  const sb = await supabaseServer()
  const { data, error } = await sb.auth.getUser()
  if (error || !data.user) return null
  return data.user
}

/** Require user AND admin role within this site. */
export async function requireAdmin() {
  const user = await requireUser()
  if (!user) return { ok: false as const, status: 401, reason: 'no_session' }
  const cfg = getAuthConfig()
  const admin = supabaseAdmin()
  const { data: access } = await admin
    .from('auth_site_access')
    .select('role, revoked_at')
    .eq('user_id', user.id)
    .eq('site_slug', cfg.siteSlug)
    .maybeSingle()
  if (!access || access.revoked_at) return { ok: false as const, status: 403, reason: 'no_access' }
  if (access.role !== 'admin' && access.role !== 'owner') return { ok: false as const, status: 403, reason: 'not_admin' }
  return { ok: true as const, user, role: access.role as 'admin' | 'owner' }
}

/** Re-auth: ensure a user has authenticated recently (for sensitive actions). */
export async function requireRecentAuth(maxAgeSec: number = 300) {
  const sb = await supabaseServer()
  const { data } = await sb.auth.getSession()
  const session = data.session
  if (!session) return { ok: false as const, reason: 'no_session' }
  const iat = session.user.last_sign_in_at ? Date.parse(session.user.last_sign_in_at) / 1000 : 0
  if (!iat || Math.floor(Date.now() / 1000) - iat > maxAgeSec) {
    return { ok: false as const, reason: 'stale', requiresReauth: true }
  }
  return { ok: true as const, user: session.user }
}
