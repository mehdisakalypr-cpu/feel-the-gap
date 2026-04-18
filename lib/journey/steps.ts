/**
 * Journey Steps — canonical ordered list for the 7-step parcours.
 *
 * Source of truth for `<JourneySidebar />`, `<JourneyNavFooter />` and any
 * breadcrumb that needs to know what comes before/after the current page.
 *
 * Ordre validé (project_production_3_0.md 2026-04-17) :
 *   1. Fiche pays
 *   2. Rapport d'opportunités
 *   3. Méthodes de production (Production 3.0)
 *   4. Business plan
 *   5. Vidéos de ce marché
 *   6. Clients potentiels
 *   7. Synthèse (recap / AI engine)
 *   8. Site e-commerce (store) — optionnel, ne bloque pas la complétion
 *
 * `studies` n'est pas séquentiel (onglet sur la fiche pays) ; `sequentialSteps()`
 * l'exclut pour la navigation prev/next.
 */

export type JourneyStepId =
  | 'country'
  | 'report'
  | 'studies'
  | 'methods'
  | 'business_plan'
  | 'videos'
  | 'clients'
  | 'recap'
  | 'store'
  | 'success'

export type JourneyPhase = 'feel' | 'production' | 'fill'

export type JourneyTier = 'explorer' | 'data' | 'strategy' | 'premium'

export interface JourneyStep {
  id: JourneyStepId
  tier: JourneyTier
  phase: JourneyPhase
  labelFr: string
  labelEn: string
  descFr: string
  descEn: string
  icon: string
  href: (iso: string) => string
  optional?: boolean
}

export const JOURNEY_STEPS: JourneyStep[] = [
  { id: 'country',       phase: 'feel',       tier: 'explorer', labelFr: 'Fiche pays',                 labelEn: 'Country sheet',            descFr: "Vue d'ensemble du marché",          descEn: 'Market overview',            icon: '🌍', href: (iso) => `/country/${iso}` },
  { id: 'report',        phase: 'feel',       tier: 'data',     labelFr: "Rapport d'opportunités",     labelEn: 'Opportunities report',     descFr: 'Analyse détaillée',                 descEn: 'Detailed analysis',          icon: '📊', href: (iso) => `/reports/${iso}` },
  { id: 'studies',       phase: 'feel',       tier: 'strategy', labelFr: 'Études approfondies',        labelEn: 'In-depth studies',         descFr: 'Recherche avancée',                 descEn: 'Advanced research',          icon: '📑', href: (iso) => `/country/${iso}?tab=studies`, optional: true },
  { id: 'methods',       phase: 'production', tier: 'strategy', labelFr: 'Méthodes de production',    labelEn: 'Production methods',       descFr: 'Comparateur multi-critères',        descEn: 'Multi-criteria comparator',  icon: '🏭', href: (iso) => `/country/${iso}/methods` },
  { id: 'business_plan', phase: 'feel',       tier: 'strategy', labelFr: 'Business plan',              labelEn: 'Business plan',            descFr: '3 scénarios chiffrés',              descEn: '3 costed scenarios',         icon: '💼', href: (iso) => `/country/${iso}/enriched-plan` },
  { id: 'videos',        phase: 'fill',       tier: 'data',     labelFr: 'Vidéos de ce marché',        labelEn: 'Videos on this market',    descFr: 'Formation + insights terrain',      descEn: 'Training + field insights',  icon: '🎬', href: (iso) => `/country/${iso}/videos` },
  { id: 'clients',       phase: 'feel',       tier: 'strategy', labelFr: 'Clients potentiels',         labelEn: 'Potential customers',      descFr: 'Acheteurs B2B matchés par IA',      descEn: 'AI-matched B2B buyers',      icon: '🎯', href: (iso) => `/country/${iso}/clients` },
  { id: 'recap',         phase: 'fill',       tier: 'explorer', labelFr: "Synthèse de l'opportunité",  labelEn: 'Opportunity recap',        descFr: 'Tout ce que vous avez débloqué',    descEn: "Everything you've unlocked", icon: '🎖️', href: (iso) => `/country/${iso}/recap` },
  { id: 'store',         phase: 'fill',       tier: 'premium',  labelFr: 'Site e-commerce en 5 min',   labelEn: 'E-commerce site in 5 min', descFr: 'Mini-site marchand prêt à vendre',  descEn: 'Ready-to-sell seller mini-site', icon: '🏪', href: (iso) => `/country/${iso}/store`, optional: true },
]

/** The subset of steps that form the sequential prev/next navigation (excludes `studies`). */
export function sequentialSteps(): JourneyStep[] {
  return JOURNEY_STEPS.filter((s) => s.id !== 'studies')
}

export function stepById(id: JourneyStepId): JourneyStep | undefined {
  return JOURNEY_STEPS.find((s) => s.id === id)
}
