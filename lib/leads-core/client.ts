import { createClient } from '@supabase/supabase-js'

type AnyClient = ReturnType<typeof createClient>

let cached: AnyClient | null = null

export function vaultClient(): AnyClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE env vars missing for vault client')
  const client = createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: 'gapup_leads' as never },
  }) as unknown as AnyClient
  cached = client
  return client
}

export function publicClient(): AnyClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE env vars missing for public client')
  return createClient(url, key, { auth: { persistSession: false } })
}
