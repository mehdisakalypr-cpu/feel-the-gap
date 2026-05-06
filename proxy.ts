import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { redirectPathForClosedRole } from '@/lib/open-roles'

// ── Hub SSO HMAC verify (Web Crypto, edge-runtime safe) ─────────────────────
function _b64UrlDecode(str: string): string {
  let s = str.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return atob(s)
}
function _bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
async function verifyHubSessionEdge(token: string): Promise<boolean> {
  try {
    const secret = process.env.HUB_SHARED_SECRET
    if (!secret || secret.length < 16) return false
    const decoded = _b64UrlDecode(token)
    const [userId, expStr, sig] = decoded.split('|')
    if (!userId || !expStr || !sig) return false
    if (Date.now() > Number(expStr)) return false
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${userId}|${expStr}`))
    return _bufToHex(sigBuf) === sig
  } catch {
    return false
  }
}

// ── Public pages — no auth required ──────────────────────────────────────────
const PUBLIC_PAGES = new Set([
  '/',
  '/pricing',
  '/demo',
  '/map',
  '/reports',
  '/onboarding',
  '/api-platform',  // Sales page API Platform (public, no auth needed to see tiers)
  '/docs/api',      // Swagger UI interactive docs (public)
  '/influencer/welcome',  // Influencer landing "vendre du rêve" (public)
  '/influencer/catalog',  // Product catalog Apple-style (public browse, save needs auth)
  '/influencer/map',      // Public view of product countries
  '/influencer/waitlist',  // Public waitlist (closed-role gate target)
  '/finance',          // Financeur landing page (public)
  '/finance/signup',   // Financeur signup (public — auth check inside page)
  '/finance/waitlist', // Public waitlist (closed-role gate target)
  '/invest',           // Investisseur landing page (public)
  '/invest/signup',    // Investisseur signup (public — auth check inside page)
  '/invest/waitlist',  // Public waitlist (closed-role gate target)
  '/companies',     // ReviewNest top index — public SEO surface
  '/trade-shows',   // TradeShowGen index — public SEO surface
])

const PUBLIC_PAGE_PREFIXES = [
  '/auth/',         // login, register, forgot, reset-password, callback, biometric-setup
  '/go/',           // affiliate redirect links
  '/reports/',      // country reports (tier-gated in page)
  '/country/',      // country detail pages (tier-gated in page)
  '/demo/',         // demo tour pages (public access)
  '/seller/',       // public seller mini-sites /seller/[slug] (catalogue B2B)
  '/docs/',         // /docs/api (Swagger) + /docs/api/webhooks (verification snippets)
  '/tools/',        // free import/export tools (lead magnets, gated by email not auth)
  '/companies/',    // ReviewNest /companies/[country]/[slug] + /companies/remove (public SEO)
  '/trade-shows/',  // TradeShowGen /trade-shows/[slug] (public SEO)
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
  '/api/features',                    // Public feature flag lookup (anonymous UI needs it)
  '/api/health',                      // Readiness probe (DB + env checks) — consumed by uptime monitors
  '/api/parcours-state',              // Public parcours open/closed state
  '/api/geo',                         // Public geo-pricing resolution
  '/api/companies-sitemap-index',     // Public sitemap index for ReviewNest crawl
  '/api/trade-shows-sitemap',         // Public sitemap for TradeShowGen
  '/api/companies/remove-request',    // Public RGPD removal form POST
])

const PUBLIC_API_READONLY_PREFIXES = [
  '/api/_metrics/',                   // Public web-vitals + client telemetry (POST allowed anonymously)
]

const PUBLIC_API_PREFIXES = [
  '/api/auth/callback',
  '/api/countries',       // Public data
  '/api/opportunities',   // Public data
  '/api/stats',           // Public aggregate stats (map counters)
  '/api/catalog',         // Public catalogue (opt-in products only, enforced by RLS)
  '/api/v1/',             // API Platform (Bearer token auth done in route, not middleware)
  '/api/transport/',      // Transport quotes (public, no auth — just a quote estimator)
  '/api/tools/',          // Free tools (EORI validator etc.) — gated by email, not auth
  '/api/companies-sitemap/', // Public sitemap chunks (50k URLs each)
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
  if (PUBLIC_API_READONLY_PREFIXES.some(p => pathname.startsWith(p))) return true
  return PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p))
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  )
}

function allowedHosts(): string[] {
  const raw = process.env.AUTH_ALLOWED_HOSTS ?? ''
  return raw.split(',').map(h => h.trim().toLowerCase()).filter(Boolean)
}

function hostAllowed(host: string): boolean {
  const h = host.toLowerCase().split(':')[0]
  for (const allowed of allowedHosts()) {
    if (allowed.startsWith('*.')) {
      const suffix = allowed.slice(1)
      if (h.endsWith(suffix)) return true
    } else if (h === allowed) {
      return true
    }
  }
  return false
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const host = request.headers.get('host') ?? ''
  if (host && !hostAllowed(host)) {
    return new NextResponse('Forbidden host', { status: 400 })
  }

  // Static assets — always pass through
  if (isStaticAsset(pathname)) return NextResponse.next()

  // Closed role gating — redirect /finance, /invest, /influencer (or any subpath) to their
  // respective waitlist page when the role isn't listed in NEXT_PUBLIC_OPEN_ROLES.
  // The waitlist routes themselves always stay reachable. APIs aren't redirected here.
  if (!pathname.startsWith('/api/')) {
    const closedRedirect = redirectPathForClosedRole(pathname)
    if (closedRedirect && closedRedirect !== pathname) {
      return NextResponse.redirect(new URL(closedRedirect, request.url))
    }
  }

  // Country detection (used by PaymentBadges + checkout localization)
  const detectedCountry =
    request.headers.get('x-vercel-ip-country') ??
    request.headers.get('cf-ipcountry') ??
    request.cookies.get('country')?.value ??
    'FR'

  // Expose the current pathname to Server Components / layouts. Next.js does
  // not provide usePathname() on the server; layouts that need to branch on
  // the path (eg. bypassing a gate for /waitlist) read this header.
  const forwardHeaders = new Headers(request.headers)
  forwardHeaders.set('x-pathname', pathname)

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
  if (isPublicPage(pathname)) return withCountry(NextResponse.next({ request: { headers: forwardHeaders } }))

  // Public APIs — no auth needed
  if (pathname.startsWith('/api/') && isPublicApi(pathname)) return withCountry(NextResponse.next({ request: { headers: forwardHeaders } }))

  // ── Auth check for all other routes ────────────────────────────────────────

  // Hub SSO short-circuit — recognize `gapup_session` cookie issued by either
  // the hub directly (.gapup.io subdomains) or the local /auth/sso-callback
  // (cross-domain exchange). HMAC verified with HUB_SHARED_SECRET (shared).
  const hubToken = request.cookies.get('gapup_session')?.value
  if (hubToken && (await verifyHubSessionEdge(hubToken))) {
    return withCountry(NextResponse.next({ request: { headers: forwardHeaders } }))
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  let response = NextResponse.next({ request: { headers: forwardHeaders } })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request: { headers: forwardHeaders } })
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
