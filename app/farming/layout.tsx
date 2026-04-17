import { notFound } from 'next/navigation'
import { isFeatureEnabled } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'

export default async function FarmingLayout({ children }: { children: React.ReactNode }) {
  const enabled = await isFeatureEnabled('farming')
  if (!enabled) notFound()
  return <>{children}</>
}
