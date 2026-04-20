/**
 * Sanctions lists refresh — télécharge et bulk-insert les listes consolidées.
 *
 * Sources :
 * - OFAC SDN (US Treasury) : https://www.treasury.gov/ofac/downloads/sdn.csv
 * - EU consolidated        : XML public (financial sanctions)
 *
 * Parsing minimaliste : on extrait (entity_name, country, type, list_date) puis
 * truncate + bulk insert. À lancer en cron weekly via /api/cron/sanctions-refresh.
 *
 * NB : le format SDN est complexe (CSV non-RFC4180). On parse défensivement,
 * on prend la 2e colonne (SDN_Name) et la 7e colonne (citizenship/country) si présentes.
 */

import { createClient } from '@supabase/supabase-js'

type SanctionRow = {
  list_source: 'ofac_sdn' | 'eu_consolidated' | 'un_security' | 'uk_sanctions'
  entity_name: string
  entity_type: string | null
  country: string | null
  list_date: string | null
  raw_data: Record<string, unknown> | null
}

const OFAC_SDN_URL = 'https://www.treasury.gov/ofac/downloads/sdn.csv'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/** CSV simple (gère les guillemets) — suffit pour le format Treasury */
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') {
        inQ = false
      } else {
        cur += c
      }
    } else {
      if (c === '"') {
        inQ = true
      } else if (c === ',') {
        out.push(cur)
        cur = ''
      } else {
        cur += c
      }
    }
  }
  out.push(cur)
  return out
}

async function fetchOfacSdn(): Promise<SanctionRow[]> {
  const res = await fetch(OFAC_SDN_URL, {
    headers: { 'User-Agent': 'feel-the-gap-sanctions-bot/1.0' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`OFAC SDN HTTP ${res.status}`)
  const text = await res.text()
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const rows: SanctionRow[] = []
  for (const line of lines) {
    const cols = parseCsvLine(line)
    // Format Treasury SDN: ent_num, sdn_name, sdn_type, program, title, call_sign, vess_type,
    //                     tonnage, grt, vess_flag, vess_owner, remarks
    const name = (cols[1] ?? '').trim().replace(/^"|"$/g, '')
    if (!name || name.length < 3 || name.toLowerCase() === 'sdn_name') continue
    const type = (cols[2] ?? '').trim().replace(/^"|"$/g, '') || null
    const flag = (cols[9] ?? '').trim().replace(/^"|"$/g, '') || null
    rows.push({
      list_source: 'ofac_sdn',
      entity_name: name,
      entity_type: type,
      country: flag,
      list_date: null,
      raw_data: { ent_num: cols[0], program: cols[3] },
    })
  }
  return rows
}

/**
 * EU consolidated — l'URL JSON publique change, donc on tente l'endpoint stable
 * du registry FSF (Financial Sanctions Files). Si HTTP fail → no-op.
 */
async function fetchEuConsolidated(): Promise<SanctionRow[]> {
  const url = 'https://webgate.ec.europa.eu/fsd/fsf/public/files/jsonFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw'
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'feel-the-gap-sanctions-bot/1.0', accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn(`[sanctions/refresh] EU list HTTP ${res.status} — skipping`)
      return []
    }
    const json = (await res.json()) as { sanctionEntity?: Array<Record<string, unknown>> }
    const entities = json?.sanctionEntity ?? []
    const rows: SanctionRow[] = []
    for (const e of entities) {
      const namesAlias = (e['nameAlias'] as Array<{ wholeName?: string }> | undefined) ?? []
      const primary = namesAlias.find((n) => n.wholeName)?.wholeName ?? null
      if (!primary) continue
      const subjType = (e['subjectType'] as { code?: string } | undefined)?.code ?? null
      const citizenships = (e['citizenship'] as Array<{ countryDescription?: string }> | undefined) ?? []
      const country = citizenships[0]?.countryDescription ?? null
      rows.push({
        list_source: 'eu_consolidated',
        entity_name: String(primary),
        entity_type: subjType,
        country,
        list_date: null,
        raw_data: { logical_id: e['logicalId'] ?? null },
      })
    }
    return rows
  } catch (err) {
    console.warn('[sanctions/refresh] EU list error', (err as Error).message)
    return []
  }
}

/**
 * Refresh complet : truncate puis bulk insert. Idempotent.
 * Retourne les compteurs par source.
 */
export async function refreshSanctionsLists(): Promise<{
  ok: boolean
  inserted: number
  bySource: Record<string, number>
  errors: string[]
}> {
  const admin = getAdmin()
  const errors: string[] = []
  const bySource: Record<string, number> = {}

  let ofac: SanctionRow[] = []
  let eu: SanctionRow[] = []
  try { ofac = await fetchOfacSdn() } catch (e) { errors.push(`ofac: ${(e as Error).message}`) }
  try { eu = await fetchEuConsolidated() } catch (e) { errors.push(`eu: ${(e as Error).message}`) }

  const all = [...ofac, ...eu]
  bySource.ofac_sdn = ofac.length
  bySource.eu_consolidated = eu.length

  if (all.length === 0) {
    return { ok: false, inserted: 0, bySource, errors: [...errors, 'no rows fetched'] }
  }

  // Truncate (delete all)
  const { error: delErr } = await admin
    .from('sanctions_lists_cache')
    .delete()
    .gte('fetched_at', '1900-01-01')
  if (delErr) errors.push(`truncate: ${delErr.message}`)

  // Bulk insert par chunks de 1000
  let inserted = 0
  const CHUNK = 1000
  for (let i = 0; i < all.length; i += CHUNK) {
    const slice = all.slice(i, i + CHUNK)
    const { error: insErr } = await admin.from('sanctions_lists_cache').insert(slice)
    if (insErr) {
      errors.push(`insert chunk ${i / CHUNK}: ${insErr.message}`)
    } else {
      inserted += slice.length
    }
  }

  return { ok: inserted > 0, inserted, bySource, errors }
}
