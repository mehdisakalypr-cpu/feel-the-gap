/**
 * Email permutator — génère 20+ patterns from firstname/lastname/domain.
 * Pas de call API, pur string-work.
 * Permet de vérifier via SMTP ou Hunter verifier ensuite.
 */

export function permutations(opts: { first_name: string; last_name: string; domain: string }): string[] {
  const fn = opts.first_name.toLowerCase().replace(/[^a-z]/g, '')
  const ln = opts.last_name.toLowerCase().replace(/[^a-z]/g, '')
  const d = opts.domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!fn || !ln || !d) return []

  const fi = fn[0]
  const li = ln[0]

  const patterns = new Set<string>([
    // Les plus courants en entreprise
    `${fn}.${ln}@${d}`,         // john.doe@ (40% des entreprises)
    `${fi}${ln}@${d}`,           // jdoe@ (25%)
    `${fn}@${d}`,                // john@ (15%)
    `${fn}${ln}@${d}`,           // johndoe@ (10%)
    `${fn}_${ln}@${d}`,          // john_doe@
    `${fn}-${ln}@${d}`,          // john-doe@
    `${fi}.${ln}@${d}`,          // j.doe@
    `${fn}.${li}@${d}`,          // john.d@
    `${ln}.${fn}@${d}`,          // doe.john@
    `${ln}${fn}@${d}`,           // doejohn@
    `${ln}${fi}@${d}`,           // doej@
    `${fi}${li}@${d}`,           // jd@
    `${ln}@${d}`,                // doe@
    `${fn}${li}@${d}`,           // johnd@
    `${fi}_${ln}@${d}`,          // j_doe@
    `${fi}-${ln}@${d}`,          // j-doe@
    `${fn}.${ln}.${d.split('.')[0]}@${d}`,  // rare mais possible pour grandes boîtes
  ])
  return [...patterns]
}

/** Ordre de probabilité décroissante (pour SMTP check en séquence). */
export function rankedPermutations(opts: { first_name: string; last_name: string; domain: string }) {
  return permutations(opts)
}
