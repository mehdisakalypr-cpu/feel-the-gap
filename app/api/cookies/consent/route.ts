/**
 * POST /api/cookies/consent
 *
 * Log immuable du consentement cookie (RGPD art. 7) dans `store_cookie_consents`.
 * Body :
 * {
 *   visitor_uuid: string (généré côté client via crypto.randomUUID, persisté localStorage)
 *   consent_data: { essential, analytics, marketing, personalization, timestamp, version }
 *   user_agent?: string
 *   store_id?: string  (optionnel — sinon on tente de matcher par hôte/slug, fallback NULL via "platform")
 * }
 *
 * IP : on hash l'IP avec sha256 (jamais stockée en clair) — équivalent
 * pseudo-anonymisation CNIL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLATFORM_STORE_ID = process.env.PLATFORM_STORE_ID || null

interface ConsentBody {
  visitor_uuid?: string
  consent_data?: Record<string, unknown>
  user_agent?: string | null
  store_id?: string | null
}

function hashIp(ip: string | null): string {
  const salt = process.env.IP_HASH_SALT || 'ftg_consent_v1'
  return createHash('sha256').update(`${salt}:${ip ?? 'unknown'}`).digest('hex')
}

function extractIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() ?? null
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return null
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: ConsentBody
  try {
    body = (await req.json()) as ConsentBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body.visitor_uuid || typeof body.visitor_uuid !== 'string' || body.visitor_uuid.length < 8) {
    return NextResponse.json({ error: 'invalid_visitor_uuid' }, { status: 400 })
  }
  if (!body.consent_data || typeof body.consent_data !== 'object') {
    return NextResponse.json({ error: 'invalid_consent_data' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    // Pas bloquant : on a déjà persisté côté client, on log et on retourne 204.
    console.warn('[cookies/consent] Supabase env missing — skip insert')
    return new NextResponse(null, { status: 204 })
  }

  // store_id : optionnel. Sinon, on tente PLATFORM_STORE_ID. Si toujours null,
  // on skip l'insert (la table store_cookie_consents.store_id est NOT NULL,
  // donc impossible de logger un consent "platform" sans une row stores dédiée).
  const storeId = body.store_id || PLATFORM_STORE_ID
  if (!storeId) {
    return new NextResponse(null, { status: 204 })
  }

  const ip = extractIp(req)
  const ipHash = hashIp(ip)
  const userAgent =
    body.user_agent ?? req.headers.get('user-agent') ?? null

  try {
    const db = createClient(url, key, { auth: { persistSession: false } })
    const { error } = await db.from('store_cookie_consents').insert({
      store_id: storeId,
      visitor_uuid: body.visitor_uuid,
      consent_data: body.consent_data,
      ip_hash: ipHash,
      user_agent: userAgent,
    })
    if (error) {
      console.error('[cookies/consent] insert error', error.message)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }
  } catch (err) {
    console.error('[cookies/consent] unexpected', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
