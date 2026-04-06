import { NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── Admin routes — HTTP Basic Auth ─────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    const auth = req.headers.get('authorization')

    if (!auth) {
      return new NextResponse(null, {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Feel The Gap Admin"',
        },
      })
    }

    const [type, credentials] = auth.split(' ')
    if (type !== 'Basic') {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const [user, password] = Buffer.from(credentials, 'base64').toString().split(':')
    const validUser = process.env.ADMIN_USER ?? 'admin'
    const validPass = process.env.ADMIN_PASSWORD ?? 'changeme'

    if (user !== validUser || password !== validPass) {
      return new NextResponse(null, {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="Feel The Gap Admin"' },
      })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
