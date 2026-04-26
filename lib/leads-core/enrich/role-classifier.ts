/**
 * Role classifier — normalise free-text roles (FR/EN) into canonical seniority buckets.
 *
 * Buckets (from lv_persons.role_seniority enum):
 *   c-level   : CEO, Président, PDG, Directeur Général, MD, COO, CFO, CTO, Founder
 *   vp        : VP, Vice President, Chief X Officer (non-listed)
 *   director  : Director, Directeur, Head Of, Manager-Director, Gérant
 *   manager   : Manager, Responsable, Chef de
 *   individual: rest (employee, secretary, contributor)
 *
 * decision_maker_score (0-100):
 *   c-level=95, vp=80, director=65, manager=45, individual=15
 */

export type RoleSeniority = 'c-level' | 'vp' | 'director' | 'manager' | 'individual'

const C_LEVEL_RX =
  /\b(ceo|chief\s*(?:executive|operating|financial|technology|marketing|product|revenue|strategy|legal|people|hr)\s*officer|coo|cfo|cto|cmo|cpo|cro|cso|clo|chro|founder|co[-\s]*founder|managing\s*director|md|owner|proprietor|président|presidente?|p\.?d\.?g\.?|directeur\s*g[ée]n[ée]ral|d\.?g\.?|directrice\s*g[ée]n[ée]rale|gérant(?:e)?\s*majoritaire|gérante?\s*unique)\b/i

const VP_RX = /\b(vp|vice[-\s]*president|vice[-\s]*pr[ée]sident|chief\b)\b/i

const DIRECTOR_RX =
  /\b(director|directeur|directrice|head\s*of|chef\s*d[ee]\s*service|gérant(?:e)?|manager\s*director|administrator|administrateur|administratrice|secretary\s*general|secrétaire\s*g[ée]n[ée]ral)\b/i

const MANAGER_RX =
  /\b(manager|responsable|chef\s*de|team\s*lead|lead|principal|senior\s*manager|cadre\s*sup[ée]rieur)\b/i

const SCORE: Record<RoleSeniority, number> = {
  'c-level': 95,
  vp: 80,
  director: 65,
  manager: 45,
  individual: 15,
}

export function classifyRole(rawRole: string | null | undefined): {
  seniority: RoleSeniority
  score: number
} {
  const role = (rawRole ?? '').trim()
  if (!role) return { seniority: 'individual', score: SCORE.individual }

  if (C_LEVEL_RX.test(role)) return { seniority: 'c-level', score: SCORE['c-level'] }
  if (VP_RX.test(role)) return { seniority: 'vp', score: SCORE.vp }
  if (DIRECTOR_RX.test(role)) return { seniority: 'director', score: SCORE.director }
  if (MANAGER_RX.test(role)) return { seniority: 'manager', score: SCORE.manager }
  return { seniority: 'individual', score: SCORE.individual }
}

export function splitFullName(full: string): { first: string | null; last: string | null } {
  const cleaned = full.trim().replace(/\s+/g, ' ')
  if (!cleaned) return { first: null, last: null }
  const parts = cleaned.split(' ')
  if (parts.length === 1) return { first: null, last: parts[0] }
  // Heuristic FR/EN: last word = lastname, rest = firstname(s)
  const last = parts[parts.length - 1]
  const first = parts.slice(0, -1).join(' ')
  return { first, last }
}
