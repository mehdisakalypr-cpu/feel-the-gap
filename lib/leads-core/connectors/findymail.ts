/**
 * Findymail connector — email finding + verification
 *
 * License: Commercial — €49/mo (1000 credits/mo included)
 * Docs: https://app.findymail.com/docs
 * Auth: Bearer token via FINDYMAIL_API_KEY env var
 *
 * Status: AWAITING USER ACTIVATION
 *   - Set FINDYMAIL_API_KEY in .env.local after subscribing at app.findymail.com
 *   - All API calls below are commented out.
 *   - A console.log stub logs "Findymail call would happen here" instead.
 *
 * Strategy when activated:
 *   1. Pick lv_companies WHERE domain IS NOT NULL AND no email in lv_contacts yet
 *      ORDER BY enrichment_score DESC (highest ICP first)
 *   2. POST /api/search/domain for each domain -> returns email list
 *   3. POST /api/find for individual person lookup (first_name + last_name + domain)
 *   4. INSERT into lv_contacts (contact_type=email, verify_status=valid, verify_provider=findymail)
 *   5. Track credit usage — abort at FINDYMAIL_BUDGET_CREDITS (default 800 of 1000)
 *
 * Credit cost (approximate):
 *   - Domain search: 1 credit per result email returned
 *   - Person find: 1 credit per found email
 *   - Verification only: 0.1 credit per email
 */

import { vaultClient } from '../client'
import { logSync } from '../log'
import type { ConnectorOptions, SyncResult } from '../types'

const FINDYMAIL_BASE = 'https://app.findymail.com/api'
const FINDYMAIL_UA = 'gapup-leads-vault/1.0'

export type FindymailOptions = ConnectorOptions & {
  budgetCredits?: number
  mode?: 'domain' | 'person' | 'both'
}

/*
  API helpers — disabled pending activation.

  async function findByDomain(apiKey, domain, limit=5) {
    const res = await fetch(FINDYMAIL_BASE + '/search/domain', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'User-Agent': FINDYMAIL_UA },
      body: JSON.stringify({ domain, limit }),
    })
    return res.ok ? res.json() : null
  }

  async function findByPerson(apiKey, firstName, lastName, domain) {
    const res = await fetch(FINDYMAIL_BASE + '/find', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'User-Agent': FINDYMAIL_UA },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, company_domain: domain }),
    })
    return res.ok ? res.json() : null
  }

  async function checkCredits(apiKey) {
    const res = await fetch(FINDYMAIL_BASE + '/account', {
      headers: { Authorization: 'Bearer ' + apiKey, 'User-Agent': FINDYMAIL_UA },
    })
    return res.ok ? (await res.json()).credits_remaining ?? 0 : 0
  }
*/

export async function runFindymail(opts: FindymailOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: { status: 'awaiting_activation' },
  }

  const apiKey = process.env.FINDYMAIL_API_KEY
  if (!apiKey) {
    console.log('[findymail] SKIP — FINDYMAIL_API_KEY not set. Awaiting user activation (€49/mo at app.findymail.com)')
    console.log('[findymail] Findymail call would happen here, awaiting user activation.')
    result.duration_ms = Date.now() - t0
    result.error = 'FINDYMAIL_API_KEY not configured'
    return result
  }

  console.log('[findymail] API key detected — connector ready but calls disabled pending final activation.')
  console.log('[findymail] Findymail call would happen here, awaiting user activation.')

  result.duration_ms = Date.now() - t0
  return result
}
