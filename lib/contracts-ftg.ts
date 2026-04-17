/**
 * FTG ContractGate — registry of signable agreements.
 *
 * Each "plan" maps to a markdown source stored on disk (llc-setup/subscriptions/ftg/*.md).
 * Versions are pinned here and mirrored into signed_agreements.agreement_version so
 * we can re-render the exact template shown at signature time if ever disputed.
 */

export type FtgPlanKey = 'data' | 'strategy' | 'premium' | 'account_signup'

export type FtgAgreementMeta = {
  plan: FtgPlanKey
  version: string
  titleFr: string
  titleEn: string
  /** File name under llc-setup/subscriptions/ftg, or synthetic 'account_signup' template. */
  sourceFile: string
}

export const FTG_AGREEMENTS: Record<FtgPlanKey, FtgAgreementMeta> = {
  data: {
    plan: 'data',
    version: '2026-04-17.v1',
    titleFr: 'Abonnement Data — 29 €/mois',
    titleEn: 'Data Subscription — 29 €/month',
    sourceFile: '1-data-plan-subscription.md',
  },
  strategy: {
    plan: 'strategy',
    version: '2026-04-17.v1',
    titleFr: 'Abonnement Strategy — 99 €/mois',
    titleEn: 'Strategy Subscription — 99 €/month',
    sourceFile: '2-strategy-plan-subscription.md',
  },
  premium: {
    plan: 'premium',
    version: '2026-04-17.v1',
    titleFr: 'Abonnement Premium — 149 €/mois',
    titleEn: 'Premium Subscription — 149 €/month',
    sourceFile: '3-premium-plan-subscription.md',
  },
  account_signup: {
    plan: 'account_signup',
    version: '2026-04-17.v1',
    titleFr: 'Conditions d\'utilisation & Politique de confidentialité',
    titleEn: 'Terms of Use & Privacy Policy',
    sourceFile: 'account-signup.md', // synthetic — served from inline template
  },
}

export function ftgAgreementFor(plan: string): FtgAgreementMeta {
  if (plan in FTG_AGREEMENTS) return FTG_AGREEMENTS[plan as FtgPlanKey]
  return FTG_AGREEMENTS.account_signup
}

/** Map current pricing CTA to the agreement plan key. */
export function planFromCheckoutParam(params: URLSearchParams): FtgPlanKey {
  const plan = params.get('plan')
  if (plan === 'starter') return 'data'         // Starter SKU is billed as Data tier at checkout time (29€)
  if (plan === 'premium') return 'premium'
  return 'account_signup'
}
