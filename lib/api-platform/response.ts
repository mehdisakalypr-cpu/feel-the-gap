/**
 * lib/api-platform/response — Vague 3 #7 extension · 2026-04-18
 *
 * Helpers pour construire une NextResponse JSON standardisée pour /api/v1/*
 * avec headers X-RateLimit-* + ratelimit snapshot depuis authenticateApiRequest.
 */

import { NextResponse } from 'next/server'
import type { AuthedRequest } from './auth'

export function v1Json(body: unknown, auth: AuthedRequest, extra?: {
  status?: number
  remainingMin?: number
  remainingDay?: number
}): NextResponse {
  const headers: Record<string, string> = {
    'X-RateLimit-Tier': auth.token.tier,
    'X-RateLimit-Limit-Minute': String(auth.token.rate_limit_per_min),
    'X-RateLimit-Limit-Day': String(auth.token.rate_limit_per_day),
  }
  if (extra?.remainingMin !== undefined) headers['X-RateLimit-Remaining-Minute'] = String(extra.remainingMin)
  if (extra?.remainingDay !== undefined) headers['X-RateLimit-Remaining-Day'] = String(extra.remainingDay)
  return NextResponse.json(body, { status: extra?.status ?? 200, headers })
}

export function v1Error(message: string, status = 400, retryAfter?: number): NextResponse {
  const headers: Record<string, string> = {}
  if (retryAfter) headers['Retry-After'] = String(retryAfter)
  return NextResponse.json({ error: message }, { status, headers })
}
