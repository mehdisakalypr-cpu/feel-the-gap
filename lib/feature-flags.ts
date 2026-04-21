import { createSupabaseServer } from './supabase-server'

export type FeatureKey = 'farming' | 'influencer' | 'seller' | 'training' | 'funding' | 'invest'

export type FeatureFlag = {
  key: string
  enabled: boolean
  label: string
  description: string | null
  category: string
  updated_at: string
  updated_by: string | null
}

export async function getAllFlags(): Promise<Record<string, boolean>> {
  try {
    const sb = await createSupabaseServer()
    const { data } = await sb.from('feature_flags').select('key, enabled')
    if (!data) return {}
    return Object.fromEntries(data.map(r => [r.key, r.enabled]))
  } catch {
    return {}
  }
}

export async function getAllFlagsDetailed(): Promise<FeatureFlag[]> {
  const sb = await createSupabaseServer()
  const { data } = await sb.from('feature_flags').select('*').order('category').order('label')
  return (data ?? []) as FeatureFlag[]
}

export async function isFeatureEnabled(key: FeatureKey): Promise<boolean> {
  try {
    const sb = await createSupabaseServer()
    const { data } = await sb.from('feature_flags').select('enabled').eq('key', key).maybeSingle()
    return data?.enabled === true
  } catch {
    return false
  }
}

/**
 * Server-side check of parcours_state for financeur/investisseur/influenceur.
 * Returns true by default for 'entrepreneur' (always-on) or if the row is missing.
 */
export type ParcoursRoleKey = 'entrepreneur' | 'financeur' | 'investisseur' | 'influenceur'

export async function isParcoursEnabled(role: ParcoursRoleKey): Promise<boolean> {
  if (role === 'entrepreneur') return true
  try {
    const sb = await createSupabaseServer()
    const { data } = await sb.from('parcours_state').select('enabled').eq('role_kind', role).maybeSingle()
    return data?.enabled === true
  } catch {
    return false
  }
}
