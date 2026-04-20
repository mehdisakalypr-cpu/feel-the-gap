// © 2025-2026 Feel The Gap — store settings: GET / POST (create) / PATCH

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { compareTiers } from '@/lib/credits/tier-helpers'
import type { PlanTier } from '@/lib/credits/costs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SLUG_RE = /^[a-z0-9-]{3,40}$/

async function requireOwner() {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { resp: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  const { data: profile } = await sb.from('profiles').select('tier').eq('id', user.id).maybeSingle()
  const tier = (profile?.tier as PlanTier) ?? 'free'
  if (compareTiers(tier, 'premium') < 0 && tier !== 'custom') {
    return { resp: NextResponse.json({ error: 'forbidden', message: 'Tier Premium requis' }, { status: 403 }) }
  }
  return { sb, user, tier }
}

export async function GET() {
  const auth = await requireOwner()
  if ('resp' in auth) return auth.resp
  const { sb, user } = auth
  const { data: store } = await sb
    .from('stores')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return NextResponse.json({ store })
}

interface CreateBody {
  create: true
  name: string
  slug: string
  mode_b2b: boolean
  mode_b2c: boolean
  cgv_signed: boolean
  billing_entity?: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner()
  if ('resp' in auth) return auth.resp
  const { sb, user } = auth

  let body: Partial<CreateBody>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body.create) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 })
  }
  if (!body.slug || !SLUG_RE.test(body.slug)) {
    return NextResponse.json({ error: 'invalid_slug', message: 'Slug invalide (3-40 a-z 0-9 -)' }, { status: 400 })
  }
  if (!body.mode_b2b && !body.mode_b2c) {
    return NextResponse.json({ error: 'mode_required' }, { status: 400 })
  }
  if (!body.cgv_signed) {
    return NextResponse.json({ error: 'cgv_required', message: 'Signature CGV requise' }, { status: 400 })
  }

  // Already a store?
  const { data: existing } = await sb
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'store_exists', message: 'Une boutique existe d\u00e9j\u00e0 sur ce compte' }, { status: 409 })
  }

  const { data: created, error } = await sb
    .from('stores')
    .insert({
      owner_id: user.id,
      slug: body.slug,
      name: body.name.trim(),
      mode_b2b: !!body.mode_b2b,
      mode_b2c: !!body.mode_b2c,
      status: 'draft',
      cgv_signed_at: new Date().toISOString(),
      cgv_version: process.env.STORE_CGV_VERSION ?? 'v1.0',
      billing_entity: body.billing_entity ?? {},
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'insert_failed', message: error.message }, { status: 400 })
  }

  return NextResponse.json({ store: created }, { status: 201 })
}

interface PatchBody {
  name?: string
  mode_b2b?: boolean
  mode_b2c?: boolean
  primary_color?: string
  custom_domain?: string | null
  twofa_enabled?: boolean
  billing_entity?: Record<string, unknown>
  logo_url?: string | null
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOwner()
  if ('resp' in auth) return auth.resp
  const { sb, user } = auth

  let body: PatchBody
  try { body = (await req.json()) as PatchBody } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim()
  if (typeof body.mode_b2b === 'boolean') update.mode_b2b = body.mode_b2b
  if (typeof body.mode_b2c === 'boolean') update.mode_b2c = body.mode_b2c
  if (typeof body.primary_color === 'string') update.primary_color = body.primary_color
  if (body.custom_domain !== undefined) update.custom_domain = body.custom_domain
  if (typeof body.twofa_enabled === 'boolean') update.twofa_enabled = body.twofa_enabled
  if (body.billing_entity && typeof body.billing_entity === 'object') update.billing_entity = body.billing_entity
  if (body.logo_url !== undefined) update.logo_url = body.logo_url

  const { data: updated, error } = await sb
    .from('stores')
    .update(update)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 400 })
  }
  return NextResponse.json({ store: updated })
}
