import { NextRequest, NextResponse } from 'next/server'
import { unsubscribeByToken } from '@/lib/email/sequences'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.redirect(new URL('/email/unsubscribed?error=missing', req.url))
  }
  const ok = await unsubscribeByToken(token)
  const dest = ok ? '/email/unsubscribed' : '/email/unsubscribed?error=invalid'
  return NextResponse.redirect(new URL(dest, req.url))
}
