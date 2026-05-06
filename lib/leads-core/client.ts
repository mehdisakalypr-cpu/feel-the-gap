import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// The vault client targets the `gapup_leads` schema which isn't in the
// generated public Database types. Type as <any,any,any> so .from('lv_*')
// calls don't need a per-call (sb.from as any) cast in every connector.
// Schema isolation is enforced at runtime by the `db.schema` option below.
type AnyClient = SupabaseClient<any, any, any>

let cached: AnyClient | null = null

export function vaultClient(): AnyClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE env vars missing for vault client')
  const client = createClient<any, any, any>(url, key, {
    auth: { persistSession: false },
    db: { schema: 'gapup_leads' },
  })
  cached = client
  return client
}

export function publicClient(): AnyClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE env vars missing for public client')
  return createClient<any, any, any>(url, key, { auth: { persistSession: false } })
}
