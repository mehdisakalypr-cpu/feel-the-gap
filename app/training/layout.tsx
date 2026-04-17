import { notFound } from 'next/navigation'
import { isFeatureEnabled } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'

export default async function TrainingLayout({ children }: { children: React.ReactNode }) {
  const enabled = await isFeatureEnabled('training')
  if (!enabled) notFound()
  return <>{children}</>
}
