// © 2025-2026 Feel The Gap — store API helpers (server-only)

import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export interface StoreCtx {
  id: string
  slug: string
  name: string
  status: string
  billing_entity: Record<string, unknown> | null
}

export interface BuyerCtx {
  id: string
  email: string | null
  created_at: string
}

/**
 * Resolve store + authenticated buyer for an API route handler.
 * Returns either { ok: true, store, user, sb } or { ok: false, response: NextResponse }.
 */
export async function authBuyerForStore(slug: string): Promise<
  | { ok: true; store: StoreCtx; user: BuyerCtx; sb: Awaited<ReturnType<typeof createSupabaseServer>> }
  | { ok: false; response: NextResponse }
> {
  const sb = await createSupabaseServer()
  const { data: storeRow } = await sb
    .from('stores')
    .select('id, slug, name, status, billing_entity')
    .eq('slug', slug)
    .maybeSingle()
  if (!storeRow) {
    return { ok: false, response: NextResponse.json({ error: 'store_not_found' }, { status: 404 }) }
  }
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }
  return {
    ok: true,
    sb,
    store: {
      id: String(storeRow.id),
      slug: String(storeRow.slug),
      name: String(storeRow.name),
      status: String(storeRow.status),
      billing_entity: (storeRow.billing_entity ?? null) as Record<string, unknown> | null,
    },
    user: { id: user.id, email: user.email ?? null, created_at: user.created_at },
  }
}

export { supabaseAdmin }
