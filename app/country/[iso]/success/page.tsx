import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Legacy route — split into /clients, /videos, /store, /recap.
// Preserves existing bookmarks/external links by redirecting to the recap.
export default async function SuccessRedirect({ params }: { params: Promise<{ iso: string }> }) {
  const { iso } = await params
  redirect(`/country/${iso}/recap`)
}
