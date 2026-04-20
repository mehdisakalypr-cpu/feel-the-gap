// © 2025-2026 Feel The Gap — buyer notification preferences

import { requireBuyer } from '../_lib/store-auth'
import { NotificationsForm } from './form'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props { params: Promise<{ slug: string }> }

export default async function NotificationsPage({ params }: Props) {
  const { slug } = await params
  const { store } = await requireBuyer(slug)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Préférences de notifications</h1>
        <p className="mt-1 text-sm text-gray-400">
          Choisissez les emails que vous recevez de {store.name}. Les emails transactionnels (commande, paiement, livraison) restent obligatoires.
        </p>
      </div>
      <NotificationsForm slug={slug} />
    </div>
  )
}
