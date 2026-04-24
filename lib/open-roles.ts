export type AppRole = 'entrepreneur' | 'financeur' | 'investisseur' | 'influenceur'

const ALL_ROLES: AppRole[] = ['entrepreneur', 'financeur', 'investisseur', 'influenceur']

function parseRoles(raw: string | undefined): Set<AppRole> {
  if (!raw) return new Set<AppRole>(['entrepreneur'])
  const parts = raw.split(',').map(r => r.trim().toLowerCase()).filter(Boolean)
  const valid = parts.filter((r): r is AppRole => (ALL_ROLES as string[]).includes(r))
  return new Set<AppRole>(valid.length ? valid : ['entrepreneur'])
}

export function getOpenRoles(): Set<AppRole> {
  return parseRoles(process.env.NEXT_PUBLIC_OPEN_ROLES)
}

export function isRoleOpen(role: AppRole): boolean {
  return getOpenRoles().has(role)
}

export const ROLE_ROUTE_PREFIX: Record<Exclude<AppRole, 'entrepreneur'>, string> = {
  financeur: '/finance',
  investisseur: '/invest',
  influenceur: '/influencer',
}

export const ROLE_WAITLIST_PATH: Record<Exclude<AppRole, 'entrepreneur'>, string> = {
  financeur: '/finance/waitlist',
  investisseur: '/invest/waitlist',
  influenceur: '/influencer/waitlist',
}

const ROLE_ALWAYS_PUBLIC: Record<Exclude<AppRole, 'entrepreneur'>, string[]> = {
  financeur: ['/finance/waitlist'],
  investisseur: ['/invest/waitlist'],
  influenceur: ['/influencer/waitlist'],
}

export function redirectPathForClosedRole(pathname: string): string | null {
  const closedRoles = (Object.keys(ROLE_ROUTE_PREFIX) as Exclude<AppRole, 'entrepreneur'>[])
    .filter(r => !isRoleOpen(r))

  for (const role of closedRoles) {
    const prefix = ROLE_ROUTE_PREFIX[role]
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      if (ROLE_ALWAYS_PUBLIC[role].some(p => pathname === p || pathname.startsWith(p + '/'))) {
        return null
      }
      return ROLE_WAITLIST_PATH[role]
    }
  }
  return null
}
