// © 2025-2026 Feel The Gap — public storefront layout (passthrough only)
// IMPORTANT : ce layout enveloppe à la fois les routes publiques (/store/[slug],
// /products, /cart, /checkout, /cgv…) ET les routes /store/[slug]/account.
// Le segment account possède son propre layout (header acheteur dédié), donc
// ici on ne rend PAS de chrome — chaque page publique invoque <StoreChrome>
// elle-même via components/store-public/StoreChrome.tsx.
//
// Ce layout existe principalement pour valider le slug une seule fois et
// déclencher notFound() si la boutique n'est pas active.

import { notFound } from 'next/navigation'
import { getStoreBySlug } from './account/_lib/store-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export default async function StoreSlugLayout({ children, params }: Props) {
  const { slug } = await params
  const store = await getStoreBySlug(slug)
  if (!store) notFound()
  return <>{children}</>
}
