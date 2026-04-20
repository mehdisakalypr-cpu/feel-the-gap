/**
 * Sanctions screening — vérifie une entité contre les listes consolidées
 * (OFAC SDN, EU consolidated, UN Security Council, UK sanctions) en cache local.
 *
 * NB : aurait dû vivre dans `lib/sanctions/` mais le sandbox bloque la création
 * de nouveaux dossiers sous `lib/`. Co-localisé sous `app/api/marketplace/sanctions/_lib/`
 * (les `_*` ne sont pas routés par Next.js).
 *
 * Recherche fuzzy via PG ILIKE (entity_name_normalized généré en lowercase).
 * Hook attendu : appelé avant l'acceptation d'une RFQ response et avant
 * le démarrage d'un escrow Stripe Connect.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type SanctionMatch = {
  list_source: 'ofac_sdn' | 'eu_consolidated' | 'un_security' | 'uk_sanctions'
  entity_name: string
  entity_type: string | null
  country: string | null
  list_date: string | null
}

export type SanctionsCheckResult = {
  matched: boolean
  matches: SanctionMatch[]
  checked_at: string
}

function getAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/**
 * Normalise un nom d'entité pour matching :
 * - lowercase
 * - retire ponctuation
 * - retire suffixes corporatifs courants (LLC, Ltd, S.A., GmbH, etc.)
 * - collapse whitespace
 */
export function normalizeEntityName(name: string): string {
  let s = (name ?? '').toLowerCase().trim()
  s = s.replace(/[.,;:!?'"()[\]{}]/g, ' ')
  s = s.replace(/&/g, ' and ')
  s = s.replace(
    /\b(llc|inc|incorporated|ltd|limited|gmbh|s\.?a\.?|s\.?a\.?r\.?l\.?|sas|sasu|sarl|bv|nv|ag|plc|co|corp|corporation|company|trading|holdings?)\b/g,
    ' ',
  )
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/**
 * Vérifie si une entité (nom + pays optionnel) figure dans le cache des sanctions.
 * Tokenize le nom normalisé en mots de >= 3 lettres puis cherche les rows dont
 * `entity_name_normalized` contient au moins un token significatif.
 *
 * Retourne `matched=true` si au moins un match passe le filtre fort (>= 60%
 * des tokens >=4 lettres présents dans la chaîne match).
 */
export async function checkEntity(
  name: string,
  country?: string | null,
): Promise<SanctionsCheckResult> {
  const checkedAt = new Date().toISOString()
  const normalized = normalizeEntityName(name)
  if (!normalized || normalized.length < 3) {
    return { matched: false, matches: [], checked_at: checkedAt }
  }

  const tokens = normalized.split(' ').filter((t) => t.length >= 3)
  if (tokens.length === 0) {
    return { matched: false, matches: [], checked_at: checkedAt }
  }

  const admin = getAdmin()

  const orFilter = tokens
    .slice(0, 8)
    .map((t) => `entity_name_normalized.ilike.%${t.replace(/[%_]/g, '')}%`)
    .join(',')

  let q = admin
    .from('sanctions_lists_cache')
    .select('list_source, entity_name, entity_type, country, list_date')
    .or(orFilter)
    .limit(50)

  if (country) {
    const c = country.trim()
    if (c.length > 0) {
      q = q.or(`country.ilike.%${c}%,country.is.null`)
    }
  }

  const { data, error } = await q
  if (error) {
    console.error('[sanctions/check] query error', error.message)
    return { matched: false, matches: [], checked_at: checkedAt }
  }

  const strongTokens = tokens.filter((t) => t.length >= 4)
  const matches: SanctionMatch[] = (data ?? [])
    .filter((row) => {
      const en = String(row.entity_name ?? '').toLowerCase()
      if (strongTokens.length === 0) return true
      const hits = strongTokens.filter((t) => en.includes(t)).length
      return hits / strongTokens.length >= 0.6
    })
    .map((row) => ({
      list_source: row.list_source as SanctionMatch['list_source'],
      entity_name: String(row.entity_name),
      entity_type: row.entity_type ?? null,
      country: row.country ?? null,
      list_date: row.list_date ?? null,
    }))

  return {
    matched: matches.length > 0,
    matches,
    checked_at: checkedAt,
  }
}
