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
 * Check if the authenticated user is an admin (stored in profiles.is_admin).
 */
export async function isAdmin() {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return false
  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail && user.email === adminEmail) return true
  const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin === true
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
