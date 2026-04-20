// © 2025-2026 Feel The Gap — store owner helpers (server-only)

import { createSupabaseServer } from '@/lib/supabase-server'
import type { PlanTier } from '@/lib/credits/costs'
import { compareTiers } from '@/lib/credits/tier-helpers'

export interface OwnerStore {
  id: string
  owner_id: string
  slug: string
  name: string
  mode_b2b: boolean
  mode_b2c: boolean
  status: 'draft' | 'active' | 'suspended' | 'archived'
  cgv_signed_at: string | null
  cgv_version: string | null
  legal_docs_complete: boolean
  twofa_enabled: boolean
  logo_url: string | null
  primary_color: string | null
  custom_domain: string | null
  billing_entity: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface OwnerContext {
  user: { id: string; email: string | null }
  tier: PlanTier
  store: OwnerStore | null
}

const ELIGIBLE_TIERS: PlanTier[] = ['premium', 'ultimate', 'custom']

/**
 * Returns true if the tier is allowed to operate an FTG store
 * (premium, ultimate, custom). Strategy and below cannot publish.
 */
export function tierCanOwnStore(tier: PlanTier): boolean {
  return ELIGIBLE_TIERS.includes(tier)
}

/**
 * Resolve current owner + their first store (1 default per account).
 * Returns null user if not authenticated.
 */
export async function getOwnerContext(): Promise<OwnerContext | null> {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null

  const { data: profile } = await sb
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .maybeSingle()

  const tier = (profile?.tier as PlanTier) ?? 'free'

  const { data: storeRow } = await sb
    .from('stores')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return {
    user: { id: user.id, email: user.email ?? null },
    tier,
    store: storeRow ? coerceStore(storeRow) : null,
  }
}

/**
 * Server gate for owner-only routes. Returns the owner ctx or a redirect
 * destination string the caller should redirect to.
 */
export async function requireStoreOwner(): Promise<{
  ok: true
  ctx: OwnerContext & { store: OwnerStore }
} | {
  ok: false
  redirectTo: string
}> {
  const ctx = await getOwnerContext()
  if (!ctx) return { ok: false, redirectTo: '/auth/login?redirect=/account/store' }
  if (!tierCanOwnStore(ctx.tier)) return { ok: false, redirectTo: '/account/store' }
  if (!ctx.store) return { ok: false, redirectTo: '/account/store' }
  return { ok: true, ctx: { ...ctx, store: ctx.store } }
}

function coerceStore(r: Record<string, unknown>): OwnerStore {
  return {
    id: String(r.id),
    owner_id: String(r.owner_id),
    slug: String(r.slug),
    name: String(r.name),
    mode_b2b: !!r.mode_b2b,
    mode_b2c: !!r.mode_b2c,
    status: (r.status as OwnerStore['status']) ?? 'draft',
    cgv_signed_at: r.cgv_signed_at ? String(r.cgv_signed_at) : null,
    cgv_version: r.cgv_version ? String(r.cgv_version) : null,
    legal_docs_complete: !!r.legal_docs_complete,
    twofa_enabled: !!r.twofa_enabled,
    logo_url: r.logo_url ? String(r.logo_url) : null,
    primary_color: r.primary_color ? String(r.primary_color) : null,
    custom_domain: r.custom_domain ? String(r.custom_domain) : null,
    billing_entity: (r.billing_entity ?? null) as Record<string, unknown> | null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }
}

/** API gate — returns 401/403 Response or null. */
export async function requireOwnerApi(): Promise<{ resp: Response } | { user: { id: string; email: string | null }; tier: PlanTier; storeId: string }> {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    return { resp: new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } }) }
  }
  const { data: profile } = await sb.from('profiles').select('tier').eq('id', user.id).maybeSingle()
  const tier = (profile?.tier as PlanTier) ?? 'free'
  if (compareTiers(tier, 'premium') < 0 && tier !== 'custom') {
    return { resp: new Response(JSON.stringify({ error: 'forbidden', message: 'Tier Premium requis' }), { status: 403, headers: { 'Content-Type': 'application/json' } }) }
  }
  const { data: store } = await sb
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!store?.id) {
    return { resp: new Response(JSON.stringify({ error: 'no_store', message: 'Boutique non créée' }), { status: 404, headers: { 'Content-Type': 'application/json' } }) }
  }
  return { user: { id: user.id, email: user.email ?? null }, tier, storeId: String(store.id) }
}
