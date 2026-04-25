import { createClient, SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function vaultClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE env vars missing for vault client')
  cached = createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: 'gapup_leads' },
  })
  return cached
}

export function publicClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE env vars missing for public client')
  return createClient(url, key, { auth: { persistSession: false } })
}
