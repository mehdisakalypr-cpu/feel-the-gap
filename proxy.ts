import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ── Public pages — no auth required ──────────────────────────────────────────
const PUBLIC_PAGES = new Set([
  '/',
  '/pricing',
  '/demo',
  '/map',
  '/reports',
  '/onboarding',
  '/influencer/welcome',  // Influencer landing "vendre du rêve" (public)
  '/influencer/catalog',  // Product catalog Apple-style (public browse, save needs auth)
  '/influencer/map',      // Public view of product countries
  '/finance',          // Financeur landing page (public)
  '/finance/signup',   // Financeur signup (public — auth check inside page)
  '/invest',           // Investisseur landing page (public)
  '/invest/signup',    // Investisseur signup (public — auth check inside page)
])

const PUBLIC_PAGE_PREFIXES = [
  '/auth/',      // login, register, forgot, reset-password, callback, biometric-setup
  '/go/',        // affiliate redirect links
  '/reports/',   // country reports (tier-gated in page)
  '/country/',   // country detail pages (tier-gated in page)
  '/demo/',      // demo tour pages (public access)
  '/seller/',    // public seller mini-sites /seller/[slug] (catalogue B2B)
]

// ── Public API routes — no auth required ─────────────────────────────────────
const PUBLIC_API = new Set([
  '/api/auth/login',                  // Rate-limited login proxy (server-side signInWithPassword)
  '/api/auth/register',               // Server-side signup (rate-limited + Turnstile + HIBP)
  '/api/auth/logout',                 // Clear session
  '/api/auth/csrf',                   // CSRF token mint (no auth required)
  '/api/auth/forgot',                 // Request reset OTP
  '/api/auth/reset',                  // Consume reset OTP
  '/api/auth/reset-password/send',    // Custom reset flow — send OTP via Resend
  '/api/auth/reset-password/verify',  // Custom reset flow — verify OTP + update password
  '/api/auth/magic-link/start',       // Request magic link email
  '/api/auth/magic-link/verify',      // Verify magic link token
  '/api/auth/mfa/verify',             // Consume mfa_token during login
  '/api/auth/webauthn/authenticate',  // WebAuthn login flow (creates session)
  '/api/auth/webauthn/check',         // Check biometric availability
  '/api/stripe/webhook',              // Stripe signature-verified
  '/api/track',                       // Lightweight analytics
  '/api/cron/collect',                // Cron secret-verified internally
  '/api/cron/research',               // Cron secret-verified internally
  '/api/admin/refresh-all',           // Dual-gated: admin cookie OR x-cron-secret — route handler enforces
  '/api/reports/enriched-plan',       // Public consumer of /country/[iso]/enriched-plan
  '/api/demo/request',                // Public demo request (create + check status)
  '/api/demo/tour',                   // Public tour steps
  '/api/seller/quote-request',        // Public quote request from /seller/[slug]
])

const PUBLIC_API_PREFIXES = [
  '/api/auth/callback',
  '/api/countries',       // Public data
  '/api/opportunities',   // Public data
  '/api/stats',           // Public aggregate stats (map counters)
  '/api/catalog',         // Public catalogue (opt-in products only, enforced by RLS)
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

  // Country detection (used by PaymentBadges + checkout localization)
  const detectedCountry =
    request.headers.get('x-vercel-ip-country') ??
    request.headers.get('cf-ipcountry') ??
    request.cookies.get('country')?.value ??
    'FR'

  const withCountry = (res: NextResponse) => {
    res.headers.set('x-country', detectedCountry)
    if (!request.cookies.get('country')) {
      res.cookies.set('country', detectedCountry, {
        path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax',
      })
    }
    return res
  }

  // Public pages — no auth needed
  if (isPublicPage(pathname)) return withCountry(NextResponse.next())

  // Public APIs — no auth needed
  if (pathname.startsWith('/api/') && isPublicApi(pathname)) return withCountry(NextResponse.next())

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
        .select('is_admin, is_delegate_admin')
        .eq('id', user.id)
        .single()
      authorized = profile?.is_admin === true || profile?.is_delegate_admin === true
    }

    if (!authorized) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/map', request.url))
    }
  }

  return withCountry(response)
}

export const proxyConfig = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
