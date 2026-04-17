import { notFound } from 'next/navigation'
import { isFeatureEnabled } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'

export default async function FundingLayout({ children }: { children: React.ReactNode }) {
  const enabled = await isFeatureEnabled('funding')
  if (!enabled) notFound()
  return <>{children}</>
}
