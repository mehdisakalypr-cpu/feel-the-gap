/**
 * Tier hierarchy helpers — pour la cohérence d'affichage des CTA upgrade.
 *
 * RÈGLE D'OR : un user d'un tier donné ne doit JAMAIS voir un CTA
 * "Passer à <tier_inferieur_ou_courant>". Seuls les tiers SUPÉRIEURS
 * peuvent être proposés.
 *
 * Hiérarchie : free < solo_producer < starter < strategy < premium < ultimate
 *              (custom = enterprise spécifique, traité à part)
 */

import type { PlanTier } from './costs'

export const TIER_RANK: Record<PlanTier, number> = {
  free: 0,
  solo_producer: 1,
  starter: 2,
  strategy: 3,
  premium: 4,
  ultimate: 5,
  custom: 99, // enterprise sur-mesure : ne fait pas partie de la hiérarchie standard
}

export const TIER_ORDER: PlanTier[] = ['free', 'solo_producer', 'starter', 'strategy', 'premium', 'ultimate']

/**
 * Retourne true si `targetTier` est strictement supérieur au `currentTier`
 * (donc qu'on peut proposer l'upgrade).
 *
 * @example
 *   shouldShowUpgradeTo('premium', 'strategy') // false (downgrade)
 *   shouldShowUpgradeTo('premium', 'ultimate') // true (upgrade légitime)
 *   shouldShowUpgradeTo('premium', 'premium')  // false (tier courant)
 */
export function shouldShowUpgradeTo(currentTier: PlanTier, targetTier: PlanTier): boolean {
  if (currentTier === 'custom') return false   // enterprise = tout débloqué
  const current = TIER_RANK[currentTier] ?? 0
  const target = TIER_RANK[targetTier] ?? 0
  return target > current
}

/**
 * Liste des tiers strictement supérieurs au tier courant — à proposer en upgrade.
 *
 * @example
 *   getUpgradeOptions('strategy')  // ['premium', 'ultimate']
 *   getUpgradeOptions('ultimate')  // []
 */
export function getUpgradeOptions(currentTier: PlanTier): PlanTier[] {
  if (currentTier === 'custom') return []
  const current = TIER_RANK[currentTier] ?? 0
  return TIER_ORDER.filter((t) => (TIER_RANK[t] ?? 0) > current)
}

/**
 * Le tier immédiatement au-dessus, ou null si déjà au max (ultimate ou custom).
 */
export function nextTierUp(currentTier: PlanTier): PlanTier | null {
  const opts = getUpgradeOptions(currentTier)
  return opts[0] ?? null
}

/**
 * Compare deux tiers : -1 si a < b, 0 si a == b, 1 si a > b.
 */
export function compareTiers(a: PlanTier, b: PlanTier): -1 | 0 | 1 {
  const ra = TIER_RANK[a] ?? 0
  const rb = TIER_RANK[b] ?? 0
  if (ra < rb) return -1
  if (ra > rb) return 1
  return 0
}

/**
 * Helper pour décider du label d'un CTA selon le tier courant.
 * - tier courant ou inférieur : null (ne pas afficher)
 * - tier supérieur : "Passer à X"
 */
export function ctaLabelFor(currentTier: PlanTier, targetTier: PlanTier, fr = true): string | null {
  if (!shouldShowUpgradeTo(currentTier, targetTier)) return null
  const labels: Record<PlanTier, { fr: string; en: string }> = {
    free:          { fr: 'Commencer gratuitement', en: 'Start free' },
    solo_producer: { fr: 'Passer à Solo Producer', en: 'Upgrade to Solo Producer' },
    starter:       { fr: 'Passer à Data',          en: 'Upgrade to Data' },
    strategy:      { fr: 'Passer à Strategy',      en: 'Upgrade to Strategy' },
    premium:       { fr: 'Passer à Premium',       en: 'Upgrade to Premium' },
    ultimate:      { fr: 'Passer à Ultimate',      en: 'Upgrade to Ultimate' },
    custom:        { fr: 'Plan sur mesure',        en: 'Custom plan' },
  }
  return labels[targetTier][fr ? 'fr' : 'en']
}
