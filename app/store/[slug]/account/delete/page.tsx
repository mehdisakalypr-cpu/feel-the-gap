// © 2025-2026 Feel The Gap — buyer RGPD delete (article 17)

import { requireBuyer } from '../_lib/store-auth'
import { DeleteFlow } from './form'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props { params: Promise<{ slug: string }> }

export default async function DeleteAccountPage({ params }: Props) {
  const { slug } = await params
  const { user, store } = await requireBuyer(slug)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Supprimer mon compte</h1>
        <p className="mt-1 text-sm text-gray-400">
          Conformément à l&apos;article 17 du RGPD (droit à l&apos;effacement), vous pouvez demander la suppression de votre compte sur {store.name}.
        </p>
      </div>

      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-300">Conséquences</h2>
        <ul className="space-y-2 text-sm text-gray-300">
          <li>• Votre profil acheteur est <strong>anonymisé sous 30 jours</strong> puis purgé.</li>
          <li>• Vos commandes restent conservées 10 ans (obligation fiscale française) mais sont dissociées de votre identité.</li>
          <li>• Vos adresses sont supprimées immédiatement.</li>
          <li>• L&apos;abonnement Stripe éventuellement actif est résilié à la fin de la période en cours.</li>
          <li>• Vous serez déconnecté de toutes vos sessions.</li>
        </ul>
        <p className="mt-3 text-xs text-gray-500">
          <strong>Cette action est irréversible.</strong> Vous pouvez d&apos;abord exporter vos données.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Compte concerné : <span className="font-mono text-gray-400">{user.email}</span>
        </p>
      </div>

      <DeleteFlow slug={slug} />
    </div>
  )
}
