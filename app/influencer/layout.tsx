import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isFeatureEnabled, isParcoursEnabled } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Influenceurs — Feel The Gap',
  description: "Programme d'affiliation Feel The Gap pour influenceurs B2B : commissions récurrentes sur abonnements, catalogue produits, carte des marchés, outils de recommandation.",
  openGraph: {
    title: 'Programme Influenceurs — Feel The Gap',
    description: "Monétise ton audience B2B avec des commissions récurrentes sur les opportunités d'import/export mondiales.",
    type: 'website',
  },
}

export default async function InfluencerLayout({ children }: { children: React.ReactNode }) {
  // Gate on both legacy feature flag AND the new parcours_state — a parcours can be
  // disabled even if the legacy feature flag is on.
  const [legacy, parcours] = await Promise.all([
    isFeatureEnabled('influencer'),
    isParcoursEnabled('influenceur'),
  ])
  if (!legacy || !parcours) notFound()
  return <>{children}</>
}
