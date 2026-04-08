import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = new Set([
  '/',
  '/auth/login',
  '/auth/register',
  '/auth/callback',
  '/auth/biometric-setup',
  '/auth/forgot',
  '/auth/reset-password',
  '/pricing',
  '/onboarding',
  '/demo',
  '/map',
  '/gemini',
])

const PUBLIC_PREFIXES = ['/go/', '/country/', '/reports/']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/_next') || pathname.startsWith('/api/') || pathname.includes('.'))
    return NextResponse.next()

  if (PUBLIC_ROUTES.has(pathname)) return NextResponse.next()
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next()

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

  if (!user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const proxyConfig = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
