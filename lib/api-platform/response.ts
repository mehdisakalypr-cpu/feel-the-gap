/**
 * lib/api-platform/response — Vague 3 #7 extension · 2026-04-18
 *
 * Helpers pour construire une NextResponse JSON standardisée pour /api/v1/*
 * avec headers X-RateLimit-* + CORS (permissif — lecture publique).
 */

import { NextResponse } from 'next/server'
import type { AuthedRequest } from './auth'

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Requested-With',
  'Access-Control-Expose-Headers': 'X-RateLimit-Tier, X-RateLimit-Limit-Minute, X-RateLimit-Limit-Day, X-RateLimit-Remaining-Minute, X-RateLimit-Remaining-Day, X-Total-Count, Retry-After',
  'Access-Control-Max-Age': '86400',
}

export function v1Json(body: unknown, auth: AuthedRequest, extra?: {
  status?: number
  remainingMin?: number
  remainingDay?: number
}): NextResponse {
  const headers: Record<string, string> = {
    ...CORS,
    'X-RateLimit-Tier': auth.token.tier,
    'X-RateLimit-Limit-Minute': String(auth.token.rate_limit_per_min),
    'X-RateLimit-Limit-Day': String(auth.token.rate_limit_per_day),
  }
  if (extra?.remainingMin !== undefined) headers['X-RateLimit-Remaining-Minute'] = String(extra.remainingMin)
  if (extra?.remainingDay !== undefined) headers['X-RateLimit-Remaining-Day'] = String(extra.remainingDay)
  return NextResponse.json(body, { status: extra?.status ?? 200, headers })
}

export function v1Error(message: string, status = 400, retryAfter?: number): NextResponse {
  const headers: Record<string, string> = { ...CORS }
  if (retryAfter) headers['Retry-After'] = String(retryAfter)
  return NextResponse.json({ error: message }, { status, headers })
}

/** Handler OPTIONS préflight CORS — à exporter depuis chaque route /v1/*. */
export function v1Options(): Response {
  return new Response(null, { status: 204, headers: CORS })
}
