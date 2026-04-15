import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

/**
 * Server-side Supabase client for Route Handlers and Server Components.
 * Reads session from cookies automatically.
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    },
  )
}

/**
 * Get the authenticated user or null. Use in API routes to gate access.
 */
export async function getAuthUser() {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  return user
}

/**
 * Check if the authenticated user is an admin (stored in profiles.is_admin or is_delegate_admin).
 */
export async function isAdmin() {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return false
  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail && user.email === adminEmail) return true
  const { data: profile } = await sb.from('profiles').select('is_admin, is_delegate_admin').eq('id', user.id).single()
  return profile?.is_admin === true || profile?.is_delegate_admin === true
}

/**
 * Check if user is a super admin (not delegate).
 */
export async function isSuperAdmin() {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return false
  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail && user.email === adminEmail) return true
  const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin === true
}

/**
 * Gate helper for admin route handlers.
 * Returns a Response (401/403) if caller is not authenticated/not admin, else null.
 * Usage: const gate = await requireAdmin(); if (gate) return gate
 */
export async function requireAdmin(): Promise<Response | null> {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail && user.email === adminEmail) return null
  const { data: profile } = await sb
    .from('profiles')
    .select('is_admin, is_delegate_admin')
    .eq('id', user.id)
    .single()
  if (profile?.is_admin === true || profile?.is_delegate_admin === true) return null
  return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Create a Supabase server client from a middleware request (no cookies() API).
 */
export function createSupabaseMiddleware(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll() { /* middleware cannot set cookies here, handled by response */ },
      },
    },
  )
}
