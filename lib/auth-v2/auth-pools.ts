/**
 * Auth pool boundary — security separation between client-facing SaaS and admin tools.
 *
 * Architecture decision (2026-05-03 mehdi) : we intentionally do NOT unify the
 * password across all sites. Two distinct pools :
 *
 * 1. CLIENT_FACING_POOL : sites publics où les utilisateurs end-customer ont
 *    des comptes. Mot de passe UNIFIÉ pour UX cohérente. Si une de ces auth
 *    est compromise, les autres tombent ensemble — c'est OK car ce sont les
 *    mêmes data clients de toute façon.
 *
 * 2. ADMIN_SEPARATE_POOL : outils admin internes founder. Chaque site a ses
 *    propres credentials, JAMAIS unifiés ni propagés. Si un compromis touche
 *    le pool client (RCE auth-v2, credential stuffing massif, leak), le founder
 *    garde la main sur les outils admin pour réagir, isoler, restaurer.
 *
 * RÈGLE D'OR : ne JAMAIS faire propager un password (via unifyPassword ou autre)
 * vers un site du pool admin. Toujours filtrer via isClientPoolSite() avant
 * de modifier auth_site_passwords ou estate_users.
 */

export const CLIENT_FACING_POOL = ['ftg', 'hub'] as const
export const ADMIN_SEPARATE_POOL = ['cc', 'ofa', 'estate'] as const

export type ClientPoolSite = typeof CLIENT_FACING_POOL[number]
export type AdminPoolSite = typeof ADMIN_SEPARATE_POOL[number]

export function isClientPoolSite(slug: string): slug is ClientPoolSite {
  return (CLIENT_FACING_POOL as readonly string[]).includes(slug)
}

export function isAdminPoolSite(slug: string): slug is AdminPoolSite {
  return (ADMIN_SEPARATE_POOL as readonly string[]).includes(slug)
}

/** Human-readable labels for UI */
export const POOL_LABELS: Record<ClientPoolSite, string> = {
  ftg: 'Feel The Gap',
  hub: 'Gapup Hub',
}
