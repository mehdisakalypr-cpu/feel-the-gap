import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'

// Server-side client (no cookie handling)
export const supabase = createClient(url, anon)

// Browser client with session persistence (use in 'use client' components)
export function createSupabaseBrowser() {
  return createBrowserClient(url, anon)
}

export function supabaseAdmin() {
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
