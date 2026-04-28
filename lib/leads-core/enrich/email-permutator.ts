/**
 * Email Permutator + SMTP RCPT TO probe
 *
 * Strategy:
 *   1. Cursor lv_persons (first_name + last_name) JOIN lv_companies (domain)
 *      where no email contact exists yet.
 *   2. Group persons by domain to amortise MX lookups + catch-all probes.
 *   3. For each domain:
 *      a. MX lookup (in-memory cache, TTL 24h)
 *      b. Catch-all detection via random sentinel probe
 *      c. For each person, generate 15 canonical candidates and SMTP-probe
 *         them in priority order — stop after 2 accepted
 *   4. Persist results in lv_contacts (contact_type='email')
 *
 * Port 25 outbound note:
 *   Hetzner/GCP/Azure commonly block outbound port 25.
 *   The connector detects this at startup and falls back to
 *   MX-only validation (verify_status='unverified') so candidates
 *   still land in lv_contacts for later mailscout verification.
 *
 * Anti-abuse:
 *   - 200ms between probes to same MX
 *   - 1s between different MX hosts
 *   - Max 100 SMTP probes per run (configurable)
 *   - Logs to gapup_leads.smtp_probe_log
 */

import * as net from 'net'
import { promises as dns } from 'dns'
import { vaultClient } from '../client'
import { logSync } from '../log'
import type { ConnectorOptions, SyncResult } from '../types'

// ─── Types ──────────────────────────────────────────────────────────────────

type PersonRow = {
  id: string
  company_id: string
  first_name: string
  last_name: string
  domain: string
}

type ProbeResult = {
  accepted: boolean
  code: number
  message: string
}

type VerifyStatus = 'valid' | 'risky' | 'invalid' | 'unknown' | 'unverified'

type CandidateResult = {
  email: string
  verifyStatus: VerifyStatus
  verifyScore: number
  probeCode?: number
  probeMessage?: string
}

// ─── MX Cache (24h TTL) ─────────────────────────────────────────────────────

const MX_CACHE = new Map<string, { mx: string | null; ts: number }>()
const MX_TTL_MS = 24 * 60 * 60 * 1000

async function getMX(domain: string): Promise<string | null> {
  const cached = MX_CACHE.get(domain)
  if (cached && Date.now() - cached.ts < MX_TTL_MS) return cached.mx
  try {
    const records = await dns.resolveMx(domain)
    if (!records || records.length === 0) {
      MX_CACHE.set(domain, { mx: null, ts: Date.now() })
      return null
    }
    const mx = records.sort((a, b) => a.priority - b.priority)[0].exchange
    MX_CACHE.set(domain, { mx, ts: Date.now() })
    return mx
  } catch {
    MX_CACHE.set(domain, { mx: null, ts: Date.now() })
    return null
  }
}

// ─── SMTP Probe ──────────────────────────────────────────────────────────────

// Microsoft 365 / Google Workspace MX patterns that silently accept all RCPT TO
const CATCHALL_MX_PATTERNS = [
  /\.protection\.outlook\.com$/i,
  /\.mail\.protection\.outlook\.com$/i,
  /aspmx\.l\.google\.com$/i,
  /alt[0-9]\.aspmx\.l\.google\.com$/i,
  /smtp\.google\.com$/i,
  /googlemail\.com$/i,
]

function isSilentCatchAllMx(mxHost: string): boolean {
  return CATCHALL_MX_PATTERNS.some((rx) => rx.test(mxHost))
}

async function smtpProbe(
  mxHost: string,
  toEmail: string,
  timeoutMs = 8000,
): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const fromEmail = 'leadvault-probe@gapup.io'
    const socket = net.createConnection(25, mxHost)
    let stage = 0
    let buffer = ''

    const timer = setTimeout(() => {
      socket.destroy()
      resolve({ accepted: false, code: 0, message: 'timeout' })
    }, timeoutMs)

    socket.on('data', (chunk) => {
      buffer += chunk.toString()
      if (!buffer.includes('\r\n')) return
      const line = buffer.trim()
      const code = parseInt(line.slice(0, 3), 10)
      buffer = ''

      if (stage === 0 && code === 220) {
        socket.write('HELO leadvault.gapup.io\r\n')
        stage = 1
      } else if (stage === 1 && code >= 200 && code < 300) {
        socket.write(`MAIL FROM:<${fromEmail}>\r\n`)
        stage = 2
      } else if (stage === 2 && code >= 200 && code < 300) {
        socket.write(`RCPT TO:<${toEmail}>\r\n`)
        stage = 3
      } else if (stage === 3) {
        clearTimeout(timer)
        socket.write('QUIT\r\n')
        socket.destroy()
        resolve({ accepted: code === 250, code, message: line })
      } else if (code >= 400) {
        clearTimeout(timer)
        socket.destroy()
        resolve({ accepted: false, code, message: line })
      }
    })

    socket.on('error', (e) => {
      clearTimeout(timer)
      resolve({ accepted: false, code: 0, message: e.message })
    })
  })
}

let port25Available: boolean | null = null

async function checkPort25(): Promise<boolean> {
  if (port25Available !== null) return port25Available
  return new Promise((resolve) => {
    const socket = net.createConnection(25, 'gmail-smtp-in.l.google.com')
    const timer = setTimeout(() => {
      socket.destroy()
      port25Available = false
      resolve(false)
    }, 5000)
    socket.on('connect', () => {
      clearTimeout(timer)
      socket.destroy()
      port25Available = true
      resolve(true)
    })
    socket.on('error', () => {
      clearTimeout(timer)
      port25Available = false
      resolve(false)
    })
  })
}

// ─── Email Permutator ────────────────────────────────────────────────────────

function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function normalisePart(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function generateCandidates(firstName: string, lastName: string, domain: string): string[] {
  const f = normalisePart(firstName)
  const l = normalisePart(lastName)
  const fc = normalise(firstName)
  const lc = normalise(lastName)
  const fi = fc.charAt(0)
  const li = lc.charAt(0)

  const candidates: string[] = []

  // Primary patterns (ordered by statistical likelihood)
  const patterns = [
    `${fc}.${lc}`,          // john.doe
    `${fc}`,                 // john
    `${fi}${lc}`,            // jdoe
    `${fc}.${li}`,           // john.d
    `${lc}.${fc}`,           // doe.john
    `${lc}`,                 // doe
    `${fc}${lc}`,            // johndoe
    `${fi}${li}`,            // jd
    `${fc}_${lc}`,           // john_doe
    `${lc}.${fi}`,           // doe.j
    `${fi}.${lc}`,           // j.doe
    `${fi}_${lc}`,           // j_doe
    `${fc}-${lc}`,           // john-doe
    `${lc}-${fc}`,           // doe-john
    `${lc}${fc}`,            // doejohn
  ]

  for (const local of patterns) {
    if (local.length >= 1) candidates.push(`${local}@${domain}`)
  }

  // Handle compound first names (e.g. Jean-Marie → jean.marie, jm, jeanmarie)
  if (firstName.includes('-') || firstName.includes(' ')) {
    const parts = firstName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[-\s]+/)
      .filter(Boolean)
      .map((p) => p.replace(/[^a-z0-9]/g, ''))

    if (parts.length >= 2) {
      const joined = parts.join('')
      const dotted = parts.join('.')
      const initials = parts.map((p) => p.charAt(0)).join('')
      const extra = [
        `${dotted}.${lc}`,
        `${joined}.${lc}`,
        `${initials}${lc}`,
        `${initials}.${lc}`,
      ]
      for (const local of extra) {
        if (!candidates.includes(`${local}@${domain}`)) {
          candidates.push(`${local}@${domain}`)
        }
      }
    }
  }

  return candidates.slice(0, 15)
}

// Sentinel address for catch-all detection
function sentinelEmail(domain: string): string {
  return `xx9z8q-leadvault-probe-${Math.random().toString(36).slice(2, 6)}@${domain}`
}

// ─── Persistence ─────────────────────────────────────────────────────────────

async function persistProbeLog(
  client: ReturnType<typeof vaultClient>,
  entries: Array<{
    domain: string
    email: string
    mxHost: string | null
    code: number
    accepted: boolean
    message: string
  }>,
  dryRun: boolean,
): Promise<void> {
  if (dryRun || entries.length === 0) return
  try {
    await (client.from as any)('smtp_probe_log').insert(
      entries.map((e) => ({
        domain: e.domain,
        email: e.email,
        mx_host: e.mxHost,
        code: e.code,
        accepted: e.accepted,
        message: e.message.slice(0, 500),
      })),
    )
  } catch {
    // Table may not exist yet; non-fatal
  }
}

async function insertContact(
  client: ReturnType<typeof vaultClient>,
  personId: string,
  companyId: string,
  email: string,
  verifyStatus: VerifyStatus,
  verifyScore: number,
  dryRun: boolean,
): Promise<boolean> {
  if (dryRun) return true
  const { error } = await (client.from as any)('lv_contacts').insert({
    person_id: personId,
    company_id: companyId,
    contact_type: 'email',
    contact_value: email,
    verify_status: verifyStatus,
    verify_provider: 'smtp-probe-internal',
    verify_score: verifyScore,
    primary_source: 'mailscout',
    last_verified_at: new Date().toISOString(),
  })
  if (error && error.message?.includes('duplicate')) return true
  return !error
}

// ─── Score mapping ───────────────────────────────────────────────────────────

function scoreForStatus(status: VerifyStatus): number {
  switch (status) {
    case 'valid': return 95
    case 'risky': return 50
    case 'invalid': return 0
    case 'unknown': return 20
    case 'unverified': return 30
    default: return 0
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

export type EmailPermutatorOptions = ConnectorOptions & {
  maxSmtpProbes?: number
  probeIntervalMs?: number
  mxChangeIntervalMs?: number
}

export async function runEmailPermutator(opts: EmailPermutatorOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const limit = opts.limit ?? 1000
  const dryRun = opts.dryRun ?? false
  const maxSmtpProbes = opts.maxSmtpProbes ?? 100
  const probeIntervalMs = opts.probeIntervalMs ?? 200
  const mxChangeIntervalMs = opts.mxChangeIntervalMs ?? 1000

  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: {},
  }

  const client = vaultClient()

  // ── 1. Port 25 availability check ──────────────────────────────────────────
  const smtpEnabled = await checkPort25()
  console.log(`[email-permutator] port-25 outbound: ${smtpEnabled ? 'AVAILABLE' : 'BLOCKED — MX-only fallback'}`)
  ;(result.metadata as Record<string, unknown>).smtp_enabled = smtpEnabled

  // ── 2. Cursor query (RPC: priority by decision_maker_score, exclude already-emailed) ────
  const { data: rpcRows, error: qErr } = await (client.rpc as any)(
    'lv_pick_persons_for_email_permutation',
    { p_limit: limit },
  )

  if (qErr) {
    result.error = qErr.message
    result.duration_ms = Date.now() - t0
    return result
  }

  const persons: PersonRow[] = ((rpcRows ?? []) as Array<Record<string, unknown>>)
    .map((r) => ({
      id: r['id'] as string,
      company_id: r['company_id'] as string,
      first_name: r['first_name'] as string,
      last_name: r['last_name'] as string,
      domain: (r['domain'] as string | undefined) ?? '',
    }))
    .filter((p) => p.domain && p.domain.length > 3)

  // RPC already excludes already-emailed persons (NOT EXISTS); no extra filter needed.
  const toProcess = persons
  console.log(`[email-permutator] ${persons.length} fetched (RPC priority), ${toProcess.length} to process`)

  // ── 4. Group by domain ──────────────────────────────────────────────────────
  const byDomain = new Map<string, PersonRow[]>()
  for (const p of toProcess) {
    const arr = byDomain.get(p.domain) ?? []
    arr.push(p)
    byDomain.set(p.domain, arr)
  }

  let totalSmtpProbes = 0
  let lastMxHost: string | null = null
  const probeLogBuffer: Parameters<typeof persistProbeLog>[1] = []

  // ── 5. Process domain by domain ─────────────────────────────────────────────
  for (const [domain, domainPersons] of byDomain) {
    // MX check
    const mxHost = await getMX(domain)
    if (!mxHost) {
      // No MX → domain doesn't accept email, skip all persons
      for (const p of domainPersons) {
        result.rows_processed++
        result.rows_skipped++
      }
      continue
    }

    const silentCatchAll = smtpEnabled && isSilentCatchAllMx(mxHost)
    let domainIsCatchAll = silentCatchAll

    // Catch-all detection probe (only when SMTP available and MX is not a known silent catch-all)
    if (smtpEnabled && !silentCatchAll && totalSmtpProbes < maxSmtpProbes) {
      if (lastMxHost !== null && lastMxHost !== mxHost) {
        await new Promise((r) => setTimeout(r, mxChangeIntervalMs))
      }
      const sentinel = sentinelEmail(domain)
      const probeRes = await smtpProbe(mxHost, sentinel)
      totalSmtpProbes++
      probeLogBuffer.push({ domain, email: sentinel, mxHost, ...probeRes })
      domainIsCatchAll = probeRes.accepted
      lastMxHost = mxHost
      await new Promise((r) => setTimeout(r, probeIntervalMs))
    }

    // Process each person in this domain
    for (const person of domainPersons) {
      result.rows_processed++
      const candidates = generateCandidates(person.first_name, person.last_name, domain)
      let acceptedCount = 0

      if (!smtpEnabled) {
        // Port 25 blocked: insert all candidates as 'unverified' — first one only to keep DB clean
        const firstCandidate = candidates[0]
        if (firstCandidate) {
          const ok = await insertContact(
            client,
            person.id,
            person.company_id,
            firstCandidate,
            'unverified',
            30,
            dryRun,
          )
          if (ok) result.rows_inserted++
          else result.rows_skipped++
        }
        continue
      }

      // SMTP available — probe in priority order
      for (const email of candidates) {
        if (totalSmtpProbes >= maxSmtpProbes) break
        if (acceptedCount >= 2) break

        if (lastMxHost !== null && lastMxHost !== mxHost) {
          await new Promise((r) => setTimeout(r, mxChangeIntervalMs))
        }

        const probeRes = await smtpProbe(mxHost, email)
        totalSmtpProbes++
        probeLogBuffer.push({ domain, email, mxHost, ...probeRes })
        lastMxHost = mxHost

        let verifyStatus: VerifyStatus
        if (probeRes.code === 0) {
          verifyStatus = 'unknown'
        } else if (probeRes.accepted) {
          verifyStatus = domainIsCatchAll ? 'risky' : 'valid'
          acceptedCount++
        } else if (probeRes.code >= 500 && probeRes.code < 600) {
          verifyStatus = 'invalid'
        } else {
          verifyStatus = 'unknown'
        }

        const verifyScore = scoreForStatus(verifyStatus)
        if (verifyStatus === 'valid' || verifyStatus === 'risky') {
          const ok = await insertContact(
            client,
            person.id,
            person.company_id,
            email,
            verifyStatus,
            verifyScore,
            dryRun,
          )
          if (ok) result.rows_inserted++
          else result.rows_skipped++
        } else if (verifyStatus === 'invalid') {
          // Persist invalid probes too (deduplicate future work)
          await insertContact(client, person.id, person.company_id, email, 'invalid', 0, dryRun)
        }

        if (!dryRun) await new Promise((r) => setTimeout(r, probeIntervalMs))
      }

      // If SMTP probes exhausted or no candidates accepted, insert top candidate as unverified
      if (acceptedCount === 0 && candidates.length > 0 && totalSmtpProbes < maxSmtpProbes) {
        const topCandidate = candidates[0]
        const ok = await insertContact(
          client,
          person.id,
          person.company_id,
          topCandidate,
          'unverified',
          30,
          dryRun,
        )
        if (ok) result.rows_inserted++
        else result.rows_skipped++
      }
    }

    // Flush probe log buffer every 50 entries
    if (probeLogBuffer.length >= 50) {
      await persistProbeLog(client, probeLogBuffer.splice(0), dryRun)
    }
  }

  // Flush remaining probe logs
  if (probeLogBuffer.length > 0) {
    await persistProbeLog(client, probeLogBuffer.splice(0), dryRun)
  }

  result.duration_ms = Date.now() - t0
  ;(result.metadata as Record<string, unknown>).smtp_probes_used = totalSmtpProbes
  ;(result.metadata as Record<string, unknown>).domains_processed = byDomain.size

  if (!dryRun) {
    try {
      await logSync({ source_id: 'mailscout', operation: 'verify', result })
    } catch (e) {
      console.error('[email-permutator] logSync err:', (e as Error).message)
    }
  }

  console.log(
    `[email-permutator] done — processed=${result.rows_processed} inserted=${result.rows_inserted} skipped=${result.rows_skipped} smtp_probes=${totalSmtpProbes} duration=${result.duration_ms}ms`,
  )

  return result
}
