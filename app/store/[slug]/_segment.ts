// © 2025-2026 Feel The Gap — visitor B2B/B2C segment helper (server-side cookie read)
//
// Shaka 2026-04-21 : un seul site par vendeur, adaptatif selon type visiteur.
// Le store peut être B2B only (mode_b2b=true, mode_b2c=false), B2C only, ou les deux.
// Si les deux : on affiche un gate d'entrée qui demande "Professionnel ou Particulier ?"
// Le choix est persisté dans le cookie `ftg_store_{slug}_seg` pendant 180 jours.

import { cookies } from 'next/headers'
import type { StoreContext } from './account/_lib/store-auth'

export type VisitorSegment = 'b2c' | 'b2b'

export const SEGMENT_COOKIE_PREFIX = 'ftg_store_seg_'

export function segmentCookieName(slug: string): string {
  return SEGMENT_COOKIE_PREFIX + slug.replace(/[^a-z0-9-]/gi, '').toLowerCase()
}

/**
 * Resolve the effective segment for the current request.
 * - If store is B2B only → 'b2b'
 * - If store is B2C only → 'b2c'
 * - If both: read cookie, fallback to 'b2c' default (gate overlay will ask to confirm)
 */
export async function resolveSegment(store: StoreContext): Promise<VisitorSegment> {
  if (store.mode_b2b && !store.mode_b2c) return 'b2b'
  if (store.mode_b2c && !store.mode_b2b) return 'b2c'
  const jar = await cookies()
  const raw = jar.get(segmentCookieName(store.slug))?.value
  if (raw === 'b2b' || raw === 'b2c') return raw
  return 'b2c'
}

/**
 * Returns true if the store offers both segments AND no cookie is set yet
 * (→ show the SegmentGate overlay on first visit).
 */
export async function shouldShowGate(store: StoreContext): Promise<boolean> {
  if (!(store.mode_b2b && store.mode_b2c)) return false
  const jar = await cookies()
  return !jar.get(segmentCookieName(store.slug))?.value
}

/**
 * Product segment is 'b2b' | 'b2c' | 'both'. Returns true if visible for the
 * current visitor segment.
 */
export function productVisibleForSegment(
  productSegment: 'b2b' | 'b2c' | 'both',
  visitor: VisitorSegment,
): boolean {
  return productSegment === 'both' || productSegment === visitor
}
