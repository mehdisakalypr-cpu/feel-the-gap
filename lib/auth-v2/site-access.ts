/**
 * Per-site access isolation.
 * Supabase project may be shared, but `auth_site_access(user_id, site_slug)`
 * is the authoritative grant for a user on a given site.
 *
 * Register flow grants user-level access automatically.
 * Admin role must be granted out-of-band (by another admin or via DB migration).
 */

import { getAuthConfig } from './config'
import { supabaseAdmin } from './supabase-server'

export async function userHasAccess(userId: string, siteSlug?: string): Promise<boolean> {
  const slug = siteSlug ?? getAuthConfig().siteSlug
  const sb = supabaseAdmin()
  const { data } = await sb.from('auth_site_access')
    .select('user_id, revoked_at')
    .eq('user_id', userId)
    .eq('site_slug', slug)
    .is('revoked_at', null)
    .maybeSingle()
  return !!data
}

export async function grantAccess(userId: string, role: 'user' | 'admin' | 'owner' = 'user', siteSlug?: string) {
  const slug = siteSlug ?? getAuthConfig().siteSlug
  const sb = supabaseAdmin()
  await sb.from('auth_site_access').upsert(
    { user_id: userId, site_slug: slug, role, revoked_at: null },
    { onConflict: 'user_id,site_slug' },
  )
}

export async function revokeAccess(userId: string, siteSlug?: string) {
  const slug = siteSlug ?? getAuthConfig().siteSlug
  const sb = supabaseAdmin()
  await sb.from('auth_site_access')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('site_slug', slug)
}

export async function getUserRole(userId: string, siteSlug?: string): Promise<'user' | 'admin' | 'owner' | null> {
  const slug = siteSlug ?? getAuthConfig().siteSlug
  const sb = supabaseAdmin()
  const { data } = await sb.from('auth_site_access')
    .select('role, revoked_at')
    .eq('user_id', userId)
    .eq('site_slug', slug)
    .maybeSingle()
  if (!data || data.revoked_at) return null
  return data.role as 'user' | 'admin' | 'owner'
}
