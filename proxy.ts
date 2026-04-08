import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ── Public pages — no auth required ──────────────────────────────────────────
const PUBLIC_PAGES = new Set([
  '/',
  '/pricing',
  '/demo',
])

const PUBLIC_PAGE_PREFIXES = [
  '/auth/',    // login, register, forgot, reset-password, callback, biometric-setup
  '/go/',      // affiliate redirect links
]

// ── Public API routes — no auth required ─────────────────────────────────────
const PUBLIC_API = new Set([
  '/api/auth/webauthn/authenticate',  // WebAuthn login flow (creates session)
  '/api/auth/webauthn/check',         // Check biometric availability
  '/api/auth/reset-password',         // Password reset (token-verified internally)
  '/api/stripe/webhook',              // Stripe signature-verified
  '/api/track',                       // Lightweight analytics
  '/api/cron/collect',                // Cron secret-verified internally
])

const PUBLIC_API_PREFIXES = [
  '/api/auth/callback',
  '/api/countries',       // Public data
  '/api/opportunities',   // Public data
]

// ── Admin routes — require admin role ────────────────────────────────────────
function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname.startsWith('/api/admin')
}

function isPublicPage(pathname: string): boolean {
  if (PUBLIC_PAGES.has(pathname)) return true
  return PUBLIC_PAGE_PREFIXES.some(p => pathname.startsWith(p))
}

function isPublicApi(pathname: string): boolean {
  if (PUBLIC_API.has(pathname)) return true
  return PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p))
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static assets — always pass through
  if (isStaticAsset(pathname)) return NextResponse.next()

  // Public pages — no auth needed
  if (isPublicPage(pathname)) return NextResponse.next()

  // Public APIs — no auth needed
  if (pathname.startsWith('/api/') && isPublicApi(pathname)) return NextResponse.next()

  // ── Auth check for all other routes ────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  // Not authenticated
  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Admin routes — verify admin privileges
  if (isAdminRoute(pathname)) {
    const adminEmail = process.env.ADMIN_EMAIL
    let authorized = adminEmail ? user.email === adminEmail : false

    if (!authorized) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()
      authorized = profile?.is_admin === true
    }

    if (!authorized) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/map', request.url))
    }
  }

  return response
}

export const proxyConfig = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
