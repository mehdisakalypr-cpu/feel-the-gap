// © 2025-2026 Feel The Gap — buyer wishlist (placeholder P1, table store_wishlists arrive en P2)

import Link from 'next/link'
import { requireBuyer } from '../_lib/store-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props { params: Promise<{ slug: string }> }

export default async function WishlistPage({ params }: Props) {
  const { slug } = await params
  const { store } = await requireBuyer(slug)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mes favoris</h1>
        <p className="mt-1 text-sm text-gray-400">
          Retrouvez les produits que vous avez sauvegardés sur {store.name}.
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-white/10 bg-[#0D1117] p-10 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#C9A84C]/10 text-2xl">
          ⭐
        </div>
        <h2 className="text-lg font-semibold text-white">Bientôt disponible</h2>
        <p className="mt-2 mx-auto max-w-md text-sm text-gray-400">
          La liste de favoris sera activée prochainement. En attendant, parcourez la boutique : vous pourrez ajouter des produits à votre liste depuis chaque fiche produit.
        </p>
        <Link
          href={`/store/${slug}`}
          className="mt-6 inline-block rounded-xl bg-[#C9A84C] px-5 py-2.5 text-sm font-semibold text-[#07090F] hover:bg-[#E8C97A]"
        >
          Voir la boutique
        </Link>
      </div>
    </div>
  )
}
