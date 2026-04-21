// Server-side helpers + types for the parcours_state feature flag.

export type ParcoursRole = 'entrepreneur' | 'financeur' | 'investisseur' | 'influenceur'

export interface ParcoursStateRow {
  role_kind: ParcoursRole
  enabled: boolean
  auto_enable_threshold: number | null
  enabled_at: string | null
  disabled_at: string | null
  updated_by: string | null
  reason: string | null
  updated_at: string
}

export const PARCOURS_LABEL: Record<ParcoursRole, string> = {
  entrepreneur: 'Entrepreneur',
  financeur:    'Financeur',
  investisseur: 'Investisseur',
  influenceur:  'Influenceur',
}

export const PARCOURS_EMOJI: Record<ParcoursRole, string> = {
  entrepreneur: '🧭',
  financeur:    '🏦',
  investisseur: '📈',
  influenceur:  '🎤',
}

/**
 * Fetch all parcours_state rows as a lookup map.
 * Caller should pass any Supabase client (browser or server, anon is fine —
 * the table is public-readable by policy).
 */
export async function fetchParcoursState(sb: {
  from: (t: string) => {
    select: (cols: string) => Promise<{ data: ParcoursStateRow[] | null; error: unknown }>
  }
}): Promise<Partial<Record<ParcoursRole, ParcoursStateRow>>> {
  const { data } = await sb.from('parcours_state').select('*')
  const map: Partial<Record<ParcoursRole, ParcoursStateRow>> = {}
  for (const row of data ?? []) map[row.role_kind] = row
  return map
}
