/**
 * CSRF — double-submit cookie pattern.
 * - Server issues a token in a non-HttpOnly cookie `csrf`.
 * - Client sends the same value in header `x-csrf-token` on unsafe methods.
 * - Server compares request header to cookie in constant time.
 *
 * Tokens are HMAC-signed with secrets.challenge so we can validate without DB.
 * Rotate on login.
 */

import crypto from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getAuthConfig } from './config'

const COOKIE_NAME = 'csrf'
const HEADER_NAME = 'x-csrf-token'
const TTL_MS = 24 * 60 * 60 * 1000

function sign(payload: string): string {
  const { secrets } = getAuthConfig()
  return crypto.createHmac('sha256', secrets.challenge).update(payload).digest('base64url')
}

export function issueCsrfToken(): string {
  const nonce = crypto.randomBytes(16).toString('base64url')
  const expires = Date.now() + TTL_MS
  const payload = `${nonce}:${expires}`
  const hmac = sign(payload)
  return `${Buffer.from(payload).toString('base64url')}.${hmac}`
}

export function verifyCsrfToken(token: string): boolean {
  if (!token) return false
  const [payloadB64, hmac] = token.split('.')
  if (!payloadB64 || !hmac) return false
  const payload = Buffer.from(payloadB64, 'base64url').toString()
  const expected = sign(payload)
  if (!safeEq(hmac, expected)) return false
  const [, expiresStr] = payload.split(':')
  if (Number(expiresStr) < Date.now()) return false
  return true
}

export function attachCsrfCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE_NAME, token, {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,   // JS must read it to echo back in header
    maxAge: TTL_MS / 1000,
  })
}

export function assertCsrf(req: NextRequest): true | { status: 403; error: string } {
  // GET/HEAD/OPTIONS are safe
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true
  const headerToken = req.headers.get(HEADER_NAME) ?? ''
  const cookieToken = req.cookies.get(COOKIE_NAME)?.value ?? ''
  if (!headerToken || !cookieToken) return { status: 403, error: 'csrf_missing' }
  if (!safeEq(headerToken, cookieToken)) return { status: 403, error: 'csrf_mismatch' }
  if (!verifyCsrfToken(cookieToken)) return { status: 403, error: 'csrf_invalid' }
  return true
}

function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
