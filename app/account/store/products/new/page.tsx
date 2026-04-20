// © 2025-2026 Feel The Gap — create new product

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireStoreOwner } from '../../_lib/store-owner'
import { ProductForm } from '@/components/store/ProductForm'

export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
  const gate = await requireStoreOwner()
  if (!gate.ok) redirect(gate.redirectTo)

  return (
    <div className="space-y-5">
      <header>
        <Link href="/account/store/products" className="text-xs text-gray-500 hover:text-gray-300">
          \u2190 Retour aux produits
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-white">Nouveau produit</h1>
        <p className="mt-1 text-sm text-gray-400">
          Cr\u00e9ez votre fiche produit. Vous pourrez ajouter photos, vid\u00e9os et variantes apr\u00e8s la cr\u00e9ation.
        </p>
      </header>
      <ProductForm />
    </div>
  )
}
