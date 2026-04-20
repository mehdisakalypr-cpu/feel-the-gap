// © 2025-2026 Feel The Gap — store activation gate

import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { compareTiers } from '@/lib/credits/tier-helpers'
import type { PlanTier } from '@/lib/credits/costs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TWOFA_QUOTA_THRESHOLD = Number(process.env.STORE_TWOFA_THRESHOLD ?? '50')

export async function POST() {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await sb.from('profiles').select('tier').eq('id', user.id).maybeSingle()
  const tier = (profile?.tier as PlanTier) ?? 'free'
  if (compareTiers(tier, 'premium') < 0 && tier !== 'custom') {
    return NextResponse.json({ error: 'forbidden', message: 'Tier Premium requis' }, { status: 403 })
  }

  const { data: store } = await sb
    .from('stores')
    .select('id, status, cgv_signed_at, legal_docs_complete, twofa_enabled')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!store) return NextResponse.json({ error: 'no_store' }, { status: 404 })
  if (store.status === 'active') return NextResponse.json({ ok: true, status: 'active' })

  const missing: string[] = []
  if (!store.cgv_signed_at) missing.push('cgv')

  // Check legal docs : at least cgv + mentions in fr active OR legal_docs_complete already true
  const { data: legalDocs } = await sb
    .from('store_legal_docs')
    .select('doc_type, language, active')
    .eq('store_id', store.id)
    .eq('active', true)

  const hasMandatory =
    !!legalDocs?.some(d => d.doc_type === 'cgv') &&
    !!legalDocs?.some(d => d.doc_type === 'mentions')
  const legalReady = store.legal_docs_complete || hasMandatory
  if (!legalReady) missing.push('legal_docs')

  // 2FA gate based on past order volume
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const { count: ordersCount } = await sb
    .from('store_orders')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', store.id)
    .gte('created_at', since)
  if ((ordersCount ?? 0) >= TWOFA_QUOTA_THRESHOLD && !store.twofa_enabled) {
    missing.push('twofa')
  }

  if (missing.length) {
    return NextResponse.json({ error: 'requirements_missing', missing }, { status: 400 })
  }

  // Mark legal_docs_complete if mandatory present
  const update: Record<string, unknown> = {
    status: 'active',
    updated_at: new Date().toISOString(),
  }
  if (hasMandatory && !store.legal_docs_complete) update.legal_docs_complete = true

  const { error } = await sb.from('stores').update(update).eq('id', store.id)
  if (error) return NextResponse.json({ error: 'activation_failed', message: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, status: 'active' })
}
