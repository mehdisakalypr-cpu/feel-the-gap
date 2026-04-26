/**
 * Phase A2 — FR Persons enrichment via INPI RNE (Registre National des Entreprises)
 *
 * Source : https://registre-national-entreprises.inpi.fr/api/companies/{siren}/representants
 * Auth   : Bearer JWT obtained from POST /api/sso/login (email/password OAuth)
 * Rate   : not officially documented; conservative 1 req/sec
 * License: free for non-commercial bulk; commercial requires INPI agreement (declared via the user's account)
 *
 * Roles INPI typiques (champ 'qualite') :
 *   "Président", "Directeur Général", "Directeur Général Délégué",
 *   "Gérant", "Gérant non associé", "Gérant majoritaire",
 *   "Administrateur", "Membre du directoire", "Président du directoire",
 *   "Commissaire aux comptes" (skip — auditor not decision-maker for our use),
 *   "Co-gérant", "Trésorier" (assoc), "Secrétaire" (assoc)
 */

import { vaultClient } from '../client'
import { logSync } from '../log'
import { classifyRole, splitFullName } from './role-classifier'
import type { LvPersonInsert, ConnectorOptions, SyncResult } from '../types'

const API_BASE = 'https://registre-national-entreprises.inpi.fr/api'
const LOGIN_URL = `${API_BASE}/sso/login`
const SLEEP_MS = 1000 // 1 req/s — conservative
const BATCH_SIZE = 100
const SKIP_ROLES = /^(commissaire\s*aux\s*comptes|tr[eé]sorier|secr[eé]taire|membre\s*(?:du\s*conseil|élu))$/i

let cachedToken: { value: string; exp: number } | null = null

async function loginInpi(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.exp > now + 60_000) return cachedToken.value

  const username = process.env.INPI_USERNAME
  const password = process.env.INPI_PASSWORD
  if (!username || !password) throw new Error('INPI_USERNAME / INPI_PASSWORD not set')

  const res = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error(`INPI login failed: HTTP ${res.status}`)
  const j = (await res.json()) as { token?: string }
  if (!j.token) throw new Error('INPI login: no token in response')
  cachedToken = { value: j.token, exp: now + 50 * 60_000 } // 50 min cache
  return j.token
}

type InpiRepresentant = {
  qualite?: string
  qualites?: string[]
  pouvoir?: string
  prenoms?: string[]
  prenom?: string
  nom?: string
  denomination?: string // for legal-person reps
  dateNaissance?: string
  nationalite?: string
}

async function fetchRepresentants(siren: string): Promise<InpiRepresentant[]> {
  const token = await loginInpi()
  const url = `${API_BASE}/companies/${encodeURIComponent(siren)}/representants`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 404) return []
  if (res.status === 401) {
    cachedToken = null // force relogin
    return fetchRepresentants(siren)
  }
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 10_000))
    return fetchRepresentants(siren)
  }
  if (!res.ok) throw new Error(`INPI HTTP ${res.status} for ${siren}`)
  const j = (await res.json()) as InpiRepresentant[] | { representants?: InpiRepresentant[] }
  if (Array.isArray(j)) return j
  return j.representants ?? []
}

function repToPerson(r: InpiRepresentant, companyId: string): LvPersonInsert | null {
  // Skip legal-person representatives (one company being officer of another) — we want humans
  if (!r.nom && r.denomination) return null

  const role = (r.qualite ?? r.qualites?.[0] ?? '').trim()
  if (!role) return null
  if (SKIP_ROLES.test(role)) return null

  const last = (r.nom ?? '').trim()
  const first = (r.prenom ?? r.prenoms?.[0] ?? '').trim()
  if (!last && !first) return null

  const full = [first, last].filter(Boolean).join(' ')
  const { seniority, score } = classifyRole(role)

  return {
    company_id: companyId,
    full_name: full,
    first_name: first || null,
    last_name: last || null,
    role,
    role_seniority: seniority,
    decision_maker_score: score,
    primary_source: 'opencorporates' as const, // reuse source slot; true source 'inpi_rne' to be added to enum migration
  }
}

export async function runPersonsFrInpi(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const limit = opts.limit ?? 500
  const client = vaultClient()

  const { data: rows, error } = await client
    .from('lv_companies')
    .select('id, siren')
    .eq('country_iso', 'FRA')
    .not('siren', 'is', null)
    .order('id', { ascending: true })
    .limit(limit)

  if (error) {
    return {
      rows_processed: 0,
      rows_inserted: 0,
      rows_updated: 0,
      rows_skipped: 0,
      duration_ms: Date.now() - t0,
      error: error.message,
    }
  }

  const list = (rows ?? []) as Array<{ id: string; siren: string }>
  let processed = 0
  let inserted = 0
  let skipped = 0
  const batch: LvPersonInsert[] = []

  for (const row of list) {
    processed++
    try {
      const reps = await fetchRepresentants(row.siren)
      for (const r of reps) {
        const p = repToPerson(r, row.id)
        if (!p) {
          skipped++
          continue
        }
        batch.push(p)
      }
    } catch (e) {
      console.error(`[persons-fr-inpi] ${row.siren}:`, (e as Error).message)
    }

    if (batch.length >= BATCH_SIZE) {
      if (!opts.dryRun) {
        const { error: upErr } = await client.from('lv_persons').upsert(batch, {
          onConflict: 'company_id,full_name,role',
          ignoreDuplicates: true,
        })
        if (upErr) console.error('upsert err:', upErr.message)
      }
      inserted += batch.length
      batch.length = 0
    }

    await new Promise((r) => setTimeout(r, SLEEP_MS))

    if (processed % 50 === 0) {
      console.log(`[persons-fr-inpi] ${processed}/${list.length} processed, ${inserted} batched`)
    }
  }

  if (batch.length > 0 && !opts.dryRun) {
    const { error: flushErr } = await client.from('lv_persons').upsert(batch, {
      onConflict: 'company_id,full_name,role',
      ignoreDuplicates: true,
    })
    if (flushErr) console.error('flush err:', flushErr.message)
    inserted += batch.length
  }

  const result: SyncResult = {
    rows_processed: processed,
    rows_inserted: inserted,
    rows_updated: 0,
    rows_skipped: skipped,
    duration_ms: Date.now() - t0,
  }

  if (!opts.dryRun) {
    await logSync('opencorporates', 'persons_enrich_fr', result)
  }

  return result
}
