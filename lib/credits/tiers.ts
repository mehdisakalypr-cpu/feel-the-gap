/**
 * FTG — Feature access matrix par tier.
 * Complète `costs.ts` (quotas crédits) avec le gating fonctionnel (booléens).
 */
import type { PlanTier } from './costs'

export type Feature =
  | 'map_view'
  | 'country_list'
  | 'demo_bp'
  | 'opportunity_detail'
  | 'bp_generate'
  | 'training_youtube'
  | 'ecommerce_site_propose'
  | 'client_list'
  | 'client_contact_reveal'
  | 'site_creation'

/** Matrice feature × tier. true = feature autorisée (sous réserve crédits si action payante). */
export const FEATURE_ACCESS: Record<Feature, Record<PlanTier, boolean>> = {
  map_view:                 { free: true,  starter: true,  strategy: true,  premium: true,  ultimate: true,  custom: true },
  country_list:             { free: true,  starter: true,  strategy: true,  premium: true,  ultimate: true,  custom: true },
  demo_bp:                  { free: true,  starter: true,  strategy: true,  premium: true,  ultimate: true,  custom: true },
  opportunity_detail:       { free: false, starter: true,  strategy: true,  premium: true,  ultimate: true,  custom: true },
  bp_generate:              { free: false, starter: true,  strategy: true,  premium: true,  ultimate: true,  custom: true },
  training_youtube:         { free: false, starter: true,  strategy: true,  premium: true,  ultimate: true,  custom: true },
  ecommerce_site_propose:   { free: false, starter: true,  strategy: true,  premium: true,  ultimate: true,  custom: true },
  client_list:              { free: false, starter: false, strategy: true,  premium: true,  ultimate: true,  custom: true },
  client_contact_reveal:    { free: false, starter: false, strategy: true,  premium: true,  ultimate: true,  custom: true },
  site_creation:            { free: false, starter: false, strategy: true,  premium: true,  ultimate: true,  custom: true },
}

export function canAccess(tier: PlanTier, feature: Feature): boolean {
  return FEATURE_ACCESS[feature]?.[tier] ?? false
}

/** Minimum tier required for a feature (null = free ok). */
export function minTierFor(feature: Feature): PlanTier {
  if (FEATURE_ACCESS[feature].free) return 'free'
  if (FEATURE_ACCESS[feature].starter) return 'starter'
  if (FEATURE_ACCESS[feature].strategy) return 'strategy'
  if (FEATURE_ACCESS[feature].premium) return 'premium'
  if (FEATURE_ACCESS[feature].ultimate) return 'ultimate'
  return 'custom'
}

/** For paywall modal: "you need tier X to access Y" */
export function paywallReason(currentTier: PlanTier, feature: Feature): {
  ok: boolean
  requiredTier?: PlanTier
  message?: string
} {
  if (canAccess(currentTier, feature)) return { ok: true }
  const required = minTierFor(feature)
  const msg: Record<PlanTier, string> = {
    free: 'Disponible gratuitement',
    starter: 'Passe Data (€29/mo, 60 crédits) pour débloquer.',
    strategy: 'Passe Strategy (€99/mo, 100 crédits + méthode dominante + 1 supplier + 1 client).',
    premium: 'Passe Premium (€149/mo, 200 crédits + bench complet + 5 suppliers + 5 clients).',
    ultimate: 'Passe Ultimate (€299/mo, tout débloqué + 250 opps Fill-the-Gap/mo + AI engine).',
    custom: 'Contacte-nous pour un plan sur mesure.',
  }
  return { ok: false, requiredTier: required, message: msg[required] }
}
