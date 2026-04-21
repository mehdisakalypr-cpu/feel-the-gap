// © 2025-2026 Feel The Gap — store buyer account helpers (server-only)

import { createSupabaseServer } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export interface StoreContext {
  id: string
  slug: string
  name: string
  primary_color: string | null
  logo_url: string | null
  status: string
  billing_entity: Record<string, unknown> | null
  mode_b2b: boolean
  mode_b2c: boolean
}

/**
 * Resolve the store record by slug. Public read RLS allows fetching active stores
 * via the anon client; archived/draft stores resolve to null.
 */
export async function getStoreBySlug(slug: string): Promise<StoreContext | null> {
  const sb = await createSupabaseServer()
  const { data } = await sb
    .from('stores')
    .select('id, slug, name, primary_color, logo_url, status, billing_entity, mode_b2b, mode_b2c')
    .eq('slug', slug)
    .maybeSingle()
  if (!data) return null
  return {
    id: String(data.id),
    slug: String(data.slug),
    name: String(data.name),
    primary_color: data.primary_color ? String(data.primary_color) : null,
    logo_url: data.logo_url ? String(data.logo_url) : null,
    status: String(data.status),
    billing_entity: (data.billing_entity ?? null) as Record<string, unknown> | null,
    mode_b2b: Boolean(data.mode_b2b ?? false),
    mode_b2c: Boolean(data.mode_b2c ?? true),
  }
}

/**
 * Require an authenticated buyer for a given store. Redirects to the store login
 * page if no session. Buyers don't need to have ordered yet — auth alone is enough
 * to access /account; per-route handlers enforce ownership of nested resources.
 */
export async function requireBuyer(slug: string): Promise<{
  user: { id: string; email: string | null; created_at: string }
  store: StoreContext
}> {
  const store = await getStoreBySlug(slug)
  if (!store) redirect(`/store/${encodeURIComponent(slug)}`)
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    redirect(`/store/${encodeURIComponent(slug)}/account/login?redirect=${encodeURIComponent(`/store/${slug}/account`)}`)
  }
  return {
    user: { id: user.id, email: user.email ?? null, created_at: user.created_at },
    store: store!,
  }
}

/**
 * Get buyer + store without redirecting. For API routes that should return JSON
 * 401/404 instead of redirecting.
 */
export async function getBuyerOrNull(slug: string): Promise<{
  user: { id: string; email: string | null; created_at: string } | null
  store: StoreContext | null
}> {
  const store = await getStoreBySlug(slug)
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  return {
    user: user ? { id: user.id, email: user.email ?? null, created_at: user.created_at } : null,
    store,
  }
}
