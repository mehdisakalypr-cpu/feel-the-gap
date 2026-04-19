/**
 * POST /api/legal/accept
 *
 * Records a re-acceptance of the current TERMS_VERSION by an authenticated user.
 * Used by the /legal/accept gate that appears after login when the user's last
 * signed_agreements row is older than the current pinned version.
 *
 * Body: { typed_name?: string }   (optional, defaults to display_name or email)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { getAuthUser } from '@/lib/supabase-server'
import { TERMS_VERSION, TERMS_HASH, PRODUCT_TAG } from '@/lib/terms-version'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  let body: { typed_name?: string } = {}
  try { body = await req.json() } catch { /* empty body tolerated */ }
  const typedName = (body.typed_name ?? (user.user_metadata?.display_name as string | undefined) ?? user.email ?? '').trim()
  if (typedName.length < 3) {
    return NextResponse.json({ ok: false, error: 'signature_too_short' }, { status: 400 })
  }

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? null
  const ua = hdrs.get('user-agent') ?? null

  const db = admin()
  const { error } = await db.from('signed_agreements').insert({
    user_id: user.id,
    email: user.email ?? '',
    product: PRODUCT_TAG,
    plan: 'account_signup',
    agreement_version: TERMS_VERSION,
    agreement_hash_sha256: TERMS_HASH,
    body_hash_sha256: TERMS_HASH,
    ip,
    user_agent: ua,
    scroll_completed: true,
    signature_text: typedName,
    acceptance_method: 'reaccept_gate',
    purchase_intent: { flow: 'reaccept', scope: ['cgu', 'mentions', 'privacy'] },
    signed_at: new Date().toISOString(),
  })

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_insert_failed', detail: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    version: TERMS_VERSION,
    signed_at: new Date().toISOString(),
  })
}
