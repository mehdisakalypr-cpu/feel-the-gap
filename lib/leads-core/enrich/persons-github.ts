/**
 * GitHub Persons enrichment
 *
 * Source : GitHub REST API v3
 * Auth   : GH_PAT (personal access token, 5000 req/h authenticated)
 * Rate   : 600ms between calls → ~1.6 req/s, well under 5000/h
 * License: public profile data (GitHub ToS 5B — programmatic use OK for enrichment)
 *
 * Strategy:
 *   1. Cursor lv_companies WHERE domain IS NOT NULL ORDER BY id
 *   2. For each domain, search GitHub orgs matching that domain
 *   3. Extract org members + top repo contributors + commit author emails
 *   4. Insert lv_persons + lv_contacts (email if domain-matching)
 */

import { vaultClient } from '../client'
import { logSync } from '../log'
import { classifyRole, splitFullName } from './role-classifier'
import type { LvPersonInsert, LvContactInsert, ConnectorOptions, SyncResult } from '../types'

const API_BASE = 'https://api.github.com'
const SLEEP_MS = 600
// GitHub search API limit = 30 req/min auth (separate from 5000/h main quota).
// Run du 27/04 spammait des `rate limited, waiting 33s` car 600ms × 100 calls/min
// dépassait largement les 30/min. 2200ms = 27 req/min, safe.
const SEARCH_SLEEP_MS = 2200
const BATCH_SIZE = 100
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function ghHeaders(): Record<string, string> {
  const pat = process.env.GH_PAT
  if (!pat) throw new Error('GH_PAT not set')
  return {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'feel-the-gap-leadsvault/1.0 (mehdi.sakalypr@gmail.com)',
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function ghGet<T>(path: string): Promise<T | null> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, { headers: ghHeaders() })
  if (res.status === 404 || res.status === 204) return null
  if (res.status === 422) return null
  if (res.status === 403 || res.status === 429) {
    const retryAfter = res.headers.get('retry-after') ?? res.headers.get('x-ratelimit-reset')
    const waitMs = retryAfter ? Math.max(Number(retryAfter) * 1000 - Date.now(), 10_000) : 60_000
    console.warn(`[persons-github] rate limited, waiting ${waitMs}ms`)
    await sleep(waitMs)
    return ghGet<T>(path)
  }
  if (!res.ok) {
    console.error(`[persons-github] HTTP ${res.status} ${url}`)
    return null
  }
  return (await res.json()) as T
}

type GhSearchUser = { login: string; html_url?: string }
type GhSearchUsersResult = { items?: GhSearchUser[] }
type GhOrg = { login: string; blog?: string; html_url?: string }
type GhUser = {
  login: string
  name?: string | null
  bio?: string | null
  company?: string | null
  blog?: string | null
  email?: string | null
  location?: string | null
}
type GhCommit = { commit?: { author?: { name?: string; email?: string } } }
type GhContributor = { login?: string; type?: string }

function stripDomain(domain: string): string {
  return domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split(':')[0]
    .toLowerCase()
    .trim()
}

function bioMatchesCLevel(bio: string | null | undefined): boolean {
  if (!bio) return false
  return /\b(CEO|CTO|Founder|Co-Founder|COO|CFO|VP|President|Owner)\b/i.test(bio)
}

function isEmailForDomain(email: string, domain: string): boolean {
  if (!EMAIL_RX.test(email)) return false
  const emailDomain = email.split('@')[1]?.toLowerCase() ?? ''
  return emailDomain === domain || emailDomain.endsWith('.' + domain)
}

async function findOrgForDomain(domain: string): Promise<string | null> {
  const stripped = stripDomain(domain)
  // Search API limit 30/min — pace before EVERY call
  await sleep(SEARCH_SLEEP_MS)
  const result = await ghGet<GhSearchUsersResult>(
    `/search/users?q=type:org+${encodeURIComponent(stripped)}&per_page=5`,
  )
  if (!result?.items?.length) return null

  for (const item of result.items) {
    // Verify org website matches our domain
    const org = await ghGet<GhOrg>(`/orgs/${item.login}`)
    await sleep(SLEEP_MS)
    if (!org) continue
    const blog = stripDomain(org.blog ?? '')
    if (blog === stripped || blog.endsWith('.' + stripped)) {
      return org.login
    }
  }
  return null
}

export async function runPersonsGithub(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const totalLimit = opts.limit ?? 500
  const client = vaultClient()

  type Row = { id: string; domain: string }

  // Cursor pagination by id
  let lastId: string | null = null
  const list: Row[] = []
  while (list.length < totalLimit) {
    const remain = Math.min(1000, totalLimit - list.length)
    let q = client
      .from('lv_companies')
      .select('id, domain')
      .not('domain', 'is', null)
      .order('id', { ascending: true })
      .limit(remain)
    if (lastId) q = q.gt('id', lastId)
    const { data: page, error } = await q
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
    const rows = (page ?? []) as Row[]
    if (!rows.length) break
    list.push(...rows)
    lastId = rows[rows.length - 1].id
    if (rows.length < remain) break
  }

  let processed = 0
  let inserted = 0
  let skipped = 0
  const personBatch: LvPersonInsert[] = []
  const contactBatch: LvContactInsert[] = []

  const flushBatches = async () => {
    if (personBatch.length > 0 && !opts.dryRun) {
      const { error } = await client.from('lv_persons').insert(personBatch)
      if (error && !error.message.includes('duplicate')) console.error('[persons-github] insert persons err:', error.message)
    }
    inserted += personBatch.length
    personBatch.length = 0

    if (contactBatch.length > 0 && !opts.dryRun) {
      const { error } = await client.from('lv_contacts').insert(contactBatch)
      if (error && !error.message.includes('duplicate')) console.error('[persons-github] insert contacts err:', error.message)
    }
    contactBatch.length = 0
  }

  for (const row of list) {
    processed++
    const domain = stripDomain(row.domain)
    if (!domain) { skipped++; continue }

    try {
      const orgLogin = await findOrgForDomain(domain)
      await sleep(SLEEP_MS)
      if (!orgLogin) { skipped++; continue }

      // Fetch org members (public)
      const members = await ghGet<GhSearchUser[]>(`/orgs/${orgLogin}/members?per_page=100`)
      await sleep(SLEEP_MS)

      const logins = new Set<string>()
      if (members) {
        for (const m of members.slice(0, 50)) {
          logins.add(m.login)
        }
      }

      // Top 5 repos — contributors + commit emails
      const repos = await ghGet<Array<{ name: string }>>(`/orgs/${orgLogin}/repos?per_page=20&sort=updated`)
      await sleep(SLEEP_MS)
      if (repos) {
        for (const repo of repos.slice(0, 5)) {
          const contributors = await ghGet<GhContributor[]>(`/repos/${orgLogin}/${repo.name}/contributors?per_page=10`)
          await sleep(SLEEP_MS)
          if (contributors) {
            for (const c of contributors) {
              if (c.login && c.type === 'User') logins.add(c.login)
            }
          }

          const commits = await ghGet<GhCommit[]>(`/repos/${orgLogin}/${repo.name}/commits?per_page=20`)
          await sleep(SLEEP_MS)
          if (commits) {
            for (const commit of commits) {
              const email = commit.commit?.author?.email
              const name = commit.commit?.author?.name
              if (email && name && isEmailForDomain(email, domain)) {
                const { seniority, score } = classifyRole(null)
                const { first, last } = splitFullName(name)
                personBatch.push({
                  company_id: row.id,
                  full_name: name,
                  first_name: first,
                  last_name: last,
                  role: 'Tech contributor',
                  role_seniority: seniority,
                  decision_maker_score: score,
                  primary_source: 'github',
                })
                contactBatch.push({
                  company_id: row.id,
                  contact_type: 'email',
                  contact_value: email,
                  verify_status: 'unverified',
                  primary_source: 'github',
                })
              }
            }
          }
        }
      }

      // Enrich each unique login
      for (const login of Array.from(logins).slice(0, 30)) {
        const user = await ghGet<GhUser>(`/users/${login}`)
        await sleep(SLEEP_MS)
        if (!user) continue

        const displayName = user.name?.trim() || login
        const bio = user.bio?.trim() || null
        const email = user.email?.trim() || null

        const rawRole = bioMatchesCLevel(bio) ? (bio ?? 'Tech contributor') : 'Tech contributor'
        const { seniority, score } = classifyRole(rawRole)
        const { first, last } = splitFullName(displayName)

        personBatch.push({
          company_id: row.id,
          full_name: displayName,
          first_name: first,
          last_name: last,
          role: bio ?? 'Tech contributor',
          role_seniority: seniority,
          decision_maker_score: score,
          primary_source: 'github',
        })

        if (email && isEmailForDomain(email, domain)) {
          contactBatch.push({
            company_id: row.id,
            contact_type: 'email',
            contact_value: email,
            verify_status: 'unverified',
            primary_source: 'github',
          })
        }
      }
    } catch (e) {
      console.error(`[persons-github] ${row.domain}:`, (e as Error).message)
    }

    if (personBatch.length >= BATCH_SIZE) {
      await flushBatches()
    }

    if (processed % 10 === 0) {
      console.log(`[persons-github] ${processed}/${list.length} processed, ${inserted} persons inserted`)
    }
  }

  await flushBatches()

  const result: SyncResult = {
    rows_processed: processed,
    rows_inserted: inserted,
    rows_updated: 0,
    rows_skipped: skipped,
    duration_ms: Date.now() - t0,
  }

  if (!opts.dryRun) {
    try {
      await logSync({ source_id: 'opencorporates', operation: 'sync', result })
    } catch (e) {
      console.error('[persons-github] logSync err:', (e as Error).message)
    }
  }

  return result
}
