/**
 * Cascade email finder — orchestre Hunter → Snov → Apollo → permutator.
 *
 * Stratégie : aller du moins coûteux au plus coûteux, stopper dès qu'on a
 * un email "verified" ou confidence ≥ 75.
 *
 * Ordre d'appel (tous optionnels selon ENV configurée) :
 *   1. Hunter email-finder (25 free/mo)
 *   2. Snov email-finder (50 free/mo)
 *   3. Apollo peopleMatch (25 free reveals/mo)  [non implémenté ici — existe via searchPeople enriched]
 *   4. Permutator + Hunter verifier (50 free verif/mo) → prend le top-3 patterns les plus probables
 */
import * as hunter from './hunter'
import * as snov from './snov'
import { rankedPermutations } from './permutator'

export type FoundEmail = {
  email: string
  confidence: number   // 0-100
  source: 'hunter' | 'snov' | 'apollo' | 'permutator+hunter_verify'
  status?: string      // verified | guessed | unknown
}

export async function cascadeFindEmail(opts: {
  first_name: string
  last_name: string
  domain: string
  company?: string
}): Promise<FoundEmail | null> {
  // 1) Hunter email-finder
  if (hunter.isConfigured()) {
    const h = await hunter.findEmail(opts)
    if (h?.email && h.confidence >= 70) {
      return { email: h.email, confidence: h.confidence, source: 'hunter', status: 'guessed' }
    }
  }

  // 2) Snov email-finder
  if (snov.isConfigured()) {
    const s = await snov.findEmail(opts)
    if (s?.email && s.confidence >= 75) {
      return { email: s.email, confidence: s.confidence, source: 'snov', status: 'guessed' }
    }
  }

  // 3) Permutator + Hunter verifier (si Hunter configuré)
  if (hunter.isConfigured()) {
    const patterns = rankedPermutations(opts).slice(0, 3)  // top 3 uniquement pour économiser les verifs
    for (const p of patterns) {
      const v = await hunter.verifyEmail(p)
      if (v && (v.status === 'valid' || v.score >= 80)) {
        return { email: p, confidence: v.score, source: 'permutator+hunter_verify', status: v.status }
      }
    }
  }

  return null
}

export function listConfiguredProviders(): string[] {
  const out: string[] = []
  if (hunter.isConfigured()) out.push('hunter')
  if (snov.isConfigured()) out.push('snov')
  return out
}
