/**
 * Plan access utilities — handles demo vs billed plans, expiration, admin bypass.
 */

const TIER_ORDER = ['free', 'basic', 'standard', 'premium', 'enterprise'] as const
const TIER_NAMES: Record<string, string> = {
  free: 'Explorer',
  basic: 'Data',
  standard: 'Strategy',
  premium: 'Premium',
  enterprise: 'Enterprise',
}

export type UserPlanInfo = {
  tier: string
  is_billed: boolean
  is_admin: boolean
  demo_expires_at: string | null
}

/**
 * Returns the display name for a plan, prefixed with "Demo" if not billed.
 */
export function getPlanDisplayName(info: UserPlanInfo): string {
  const name = TIER_NAMES[info.tier] ?? info.tier
  if (info.is_admin) return `${name} (Admin)`
  if (!info.is_billed) return `Demo ${name}`
  return name
}

/**
 * Check if a demo plan has expired.
 */
export function isDemoExpired(info: UserPlanInfo): boolean {
  if (info.is_admin) return false
  if (info.is_billed) return false
  if (!info.demo_expires_at) return false // null = illimité
  return new Date(info.demo_expires_at).getTime() < Date.now()
}

/**
 * Returns the effective tier for access control.
 * - Admin: always their stored tier (full access)
 * - Billed plan: their stored tier
 * - Demo plan not expired: their stored tier
 * - Demo plan expired: 'free' (downgraded)
 */
export function getEffectiveTier(info: UserPlanInfo): string {
  if (info.is_admin) return info.tier
  if (info.is_billed) return info.tier
  if (isDemoExpired(info)) return 'free'
  return info.tier
}

/**
 * Check if user has access to a given tier level.
 */
export function hasTierAccess(info: UserPlanInfo, requiredTier: string): boolean {
  if (info.is_admin) return true
  const effective = getEffectiveTier(info)
  const userLevel = TIER_ORDER.indexOf(effective as typeof TIER_ORDER[number])
  const requiredLevel = TIER_ORDER.indexOf(requiredTier as typeof TIER_ORDER[number])
  if (userLevel === -1 || requiredLevel === -1) return false
  return userLevel >= requiredLevel
}
