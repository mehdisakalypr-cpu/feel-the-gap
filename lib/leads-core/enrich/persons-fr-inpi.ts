/**
 * Phase A2 — FR Persons enrichment via INPI RNE (Registre National des Entreprises)
 *
 * Source : https://registre-national-entreprises.inpi.fr/api/companies/{siren}
 * Auth   : Bearer JWT obtenu via POST /api/sso/login (email/password OAuth)
 * Rate   : conservative 1 req/sec (non-documenté officiellement)
 * License: Etalab 2.0 — réutilisation libre y compris commerciale
 *
 * Structure réponse :
 *   formality.content.personneMorale.composition.pouvoirs[] (PM = SAS, SA, SARL...)
 *   formality.content.personnePhysique.identite.{...}        (PP = EI, EURL...)
 *
 * Pour chaque pouvoir :
 *   - typeDePersonne: "INDIVIDU" ou "ENTREPRISE"
 *   - roleEntreprise: code numérique (51=Pres, 53=DG, 65=Admin, 70=Gérant, ...)
 *   - secondRoleEntreprise: code secondaire optionnel
 *   - individu.descriptionPersonne.{nom, prenoms[], role}
 *
 * Codes roles INPI (RNE) → seniority mapping :
 *   51 Président                          → c-level (95)
 *   52 Vice-président                     → c-level (90)
 *   53 Directeur général                  → c-level (95)
 *   54 Directeur général délégué          → c-level (88)
 *   55 Président-directeur général        → c-level (98)
 *   60 Co-gérant                          → c-level (85)
 *   65 Administrateur (membre du CA)      → director (65)
 *   70 Gérant                             → c-level (90)
 *   71 Gérant non associé                 → c-level (85)
 *   72 Co-gérant                          → c-level (85)
 *   73 Gérant majoritaire                 → c-level (92)
 *   80 Membre du directoire               → vp (80)
 *   81 Président du directoire            → c-level (95)
 *   82 Vice-président du directoire       → vp (80)
 *   90 Membre du conseil de surveillance  → director (60)
 *   91 Président du conseil de surveillance → director (75)
 *   30 Commissaire aux comptes (skip)
 *   31 Commissaire aux comptes suppléant (skip)
 */

import { vaultClient } from '../client'
import { logSync } from '../log'
import type { LvPersonInsert, ConnectorOptions, SyncResult } from '../types'

const API_BASE = 'https://registre-national-entreprises.inpi.fr/api'
const LOGIN_URL = `${API_BASE}/sso/login`
const SLEEP_MS = 1000
const BATCH_SIZE = 100

// Skip auditors (pas des dirigeants commerciaux)
const SKIP_ROLE_CODES = new Set(['30', '31'])

// Map role code → label + seniority + score
const ROLE_MAP: Record<string, { label: string; seniority: 'c-level' | 'vp' | 'director' | 'manager' | 'individual'; score: number }> = {
  '51': { label: 'Président', seniority: 'c-level', score: 95 },
  '52': { label: 'Vice-président', seniority: 'c-level', score: 90 },
  '53': { label: 'Directeur général', seniority: 'c-level', score: 95 },
  '54': { label: 'Directeur général délégué', seniority: 'c-level', score: 88 },
  '55': { label: 'Président-directeur général', seniority: 'c-level', score: 98 },
  '56': { label: 'Directeur général unique', seniority: 'c-level', score: 96 },
  '60': { label: 'Co-gérant', seniority: 'c-level', score: 85 },
  '65': { label: 'Administrateur', seniority: 'director', score: 65 },
  '66': { label: 'Administrateur unique', seniority: 'c-level', score: 85 },
  '70': { label: 'Gérant', seniority: 'c-level', score: 90 },
  '71': { label: 'Gérant non associé', seniority: 'c-level', score: 85 },
  '72': { label: 'Co-gérant', seniority: 'c-level', score: 85 },
  '73': { label: 'Gérant majoritaire', seniority: 'c-level', score: 92 },
  '74': { label: 'Gérant unique', seniority: 'c-level', score: 90 },
  '80': { label: 'Membre du directoire', seniority: 'vp', score: 80 },
  '81': { label: 'Président du directoire', seniority: 'c-level', score: 95 },
  '82': { label: 'Vice-président du directoire', seniority: 'vp', score: 82 },
  '90': { label: 'Membre du conseil de surveillance', seniority: 'director', score: 60 },
  '91': { label: 'Président du conseil de surveillance', seniority: 'director', score: 78 },
  '92': { label: 'Vice-président du conseil de surveillance', seniority: 'director', score: 70 },
  '40': { label: 'Représentant légal', seniority: 'c-level', score: 85 },
  '41': { label: 'Mandataire social', seniority: 'c-level', score: 80 },
}

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
  cachedToken = { value: j.token, exp: now + 50 * 60_000 }
  return j.token
}

type InpiPouvoir = {
  roleEntreprise?: string
  secondRoleEntreprise?: string
  typeDePersonne?: 'INDIVIDU' | 'ENTREPRISE'
  individu?: {
    descriptionPersonne?: {
      nom?: string
      prenoms?: string[]
      role?: string
    }
  }
}

type InpiCompany = {
  formality?: {
    content?: {
      personneMorale?: {
        composition?: {
          pouvoirs?: InpiPouvoir[]
        }
      }
      personnePhysique?: {
        identite?: {
          entrepreneur?: {
            descriptionPersonne?: {
              nom?: string
              prenoms?: string[]
            }
          }
        }
      }
    }
  }
}

async function fetchCompany(siren: string): Promise<InpiCompany | null> {
  const token = await loginInpi()
  const url = `${API_BASE}/companies/${encodeURIComponent(siren)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 404) return null
  if (res.status === 401) {
    cachedToken = null
    return fetchCompany(siren)
  }
  if (res.status === 429) {
    const body = await res.text().catch(() => '')
    if (body.includes('quota_exceeded') || body.includes('QUOTA_SERVICE')) {
      throw new Error('INPI_QUOTA_EXHAUSTED')
    }
    await new Promise((r) => setTimeout(r, 10_000))
    return fetchCompany(siren)
  }
  if (!res.ok) throw new Error(`INPI HTTP ${res.status} for ${siren}`)
  return (await res.json()) as InpiCompany
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/(\s|-)/)
    .map((w) => (w === ' ' || w === '-' ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('')
}

function pouvoirToPerson(p: InpiPouvoir, companyId: string): LvPersonInsert | null {
  if (p.typeDePersonne !== 'INDIVIDU') return null // skip personnes morales (ex: holding officer of subsidiary)
  const desc = p.individu?.descriptionPersonne
  if (!desc) return null
  const last = (desc.nom ?? '').trim()
  const firstArr = desc.prenoms ?? []
  const first = firstArr.length > 0 ? firstArr.join(' ').trim() : ''
  if (!last && !first) return null

  const code = String(p.roleEntreprise ?? desc.role ?? '').trim()
  if (SKIP_ROLE_CODES.has(code)) return null

  const mapped = ROLE_MAP[code]
  const roleLabel = mapped?.label ?? `Rôle ${code}`
  const seniority = mapped?.seniority ?? 'individual'
  const score = mapped?.score ?? 30

  // Pretty case the name (INPI returns mixed case)
  const fLast = titleCase(last)
  const fFirst = titleCase(first)
  const full = [fFirst, fLast].filter(Boolean).join(' ')

  return {
    company_id: companyId,
    full_name: full,
    first_name: fFirst || null,
    last_name: fLast || null,
    role: roleLabel,
    role_seniority: seniority,
    decision_maker_score: score,
    primary_source: 'inpi' as const,
  }
}

function entrepreneurToPerson(
  ent: NonNullable<NonNullable<InpiCompany['formality']>['content']>['personnePhysique'],
  companyId: string,
): LvPersonInsert | null {
  const desc = ent?.identite?.entrepreneur?.descriptionPersonne
  if (!desc) return null
  const last = (desc.nom ?? '').trim()
  const firstArr = desc.prenoms ?? []
  const first = firstArr.length > 0 ? firstArr.join(' ').trim() : ''
  if (!last && !first) return null
  const fLast = titleCase(last)
  const fFirst = titleCase(first)
  return {
    company_id: companyId,
    full_name: [fFirst, fLast].filter(Boolean).join(' '),
    first_name: fFirst || null,
    last_name: fLast || null,
    role: 'Entrepreneur individuel',
    role_seniority: 'c-level',
    decision_maker_score: 100,
    primary_source: 'inpi' as const,
  }
}

export async function runPersonsFrInpi(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const totalLimit = opts.limit ?? 500
  const client = vaultClient()

  type Row = { id: string; siren: string }
  // Priority cursor: domain-bearing companies first, exclude already-covered by INPI.
  // RPC: gapup_leads.lv_pick_fr_companies_for_dirigeants(p_limit)
  const { data: picked, error: rpcErr } = await client.rpc('lv_pick_fr_companies_for_dirigeants', {
    p_limit: totalLimit,
  })
  if (rpcErr) {
    return {
      rows_processed: 0,
      rows_inserted: 0,
      rows_updated: 0,
      rows_skipped: 0,
      duration_ms: Date.now() - t0,
      error: rpcErr.message,
    }
  }
  const list: Row[] = (picked ?? []) as Row[]

  let processed = 0
  let inserted = 0
  let skipped = 0
  let notFound = 0
  const batch: LvPersonInsert[] = []

  for (const row of list) {
    processed++
    try {
      const company = await fetchCompany(row.siren)
      if (!company) {
        notFound++
        continue
      }
      const content = company.formality?.content
      // Personnes morales (SAS/SA/SARL...)
      const pouvoirs = content?.personneMorale?.composition?.pouvoirs ?? []
      for (const p of pouvoirs) {
        const person = pouvoirToPerson(p, row.id)
        if (person) batch.push(person)
        else skipped++
      }
      // Personne physique (EI/EIRL/EURL avec entrepreneur unique)
      if (content?.personnePhysique) {
        const ent = entrepreneurToPerson(content.personnePhysique, row.id)
        if (ent) batch.push(ent)
      }
    } catch (e) {
      const msg = (e as Error).message
      console.error(`[persons-fr-inpi] ${row.siren}:`, msg)
      if (msg === 'INPI_QUOTA_EXHAUSTED') {
        console.error('[persons-fr-inpi] quota exhausted — bailing out, will retry next cycle after reset')
        break
      }
    }

    if (batch.length >= BATCH_SIZE) {
      if (!opts.dryRun) {
        const { error: upErr } = await client.from('lv_persons').insert(batch)
        if (upErr && !upErr.message.includes('duplicate')) console.error('insert err:', upErr.message)
      }
      inserted += batch.length
      batch.length = 0
    }

    await new Promise((r) => setTimeout(r, SLEEP_MS))

    if (processed % 25 === 0) {
      console.log(
        `[persons-fr-inpi] ${processed}/${list.length} processed, ${inserted} batched, ${notFound} 404, ${skipped} skipped`,
      )
    }
  }

  if (batch.length > 0 && !opts.dryRun) {
    const { error: flushErr } = await client.from('lv_persons').insert(batch)
    if (flushErr && !flushErr.message.includes('duplicate')) {
      console.error('flush err:', flushErr.message)
    } else {
      inserted += batch.length
    }
  }

  const result: SyncResult = {
    rows_processed: processed,
    rows_inserted: inserted,
    rows_updated: 0,
    rows_skipped: skipped,
    duration_ms: Date.now() - t0,
    metadata: { not_found: notFound },
  }

  if (!opts.dryRun) {
    try {
      await logSync({ source_id: 'opencorporates', operation: 'sync', result })
    } catch (e) {
      console.error('logSync err:', (e as Error).message)
    }
  }

  return result
}
