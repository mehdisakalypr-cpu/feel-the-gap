// © 2025-2026 Feel The Gap — buyer RGPD data export (article 20)

import { requireBuyer } from '../_lib/store-auth'
import { ExportButton } from './form'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props { params: Promise<{ slug: string }> }

export default async function DataExportPage({ params }: Props) {
  const { slug } = await params
  const { user, store } = await requireBuyer(slug)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Exporter mes données</h1>
        <p className="mt-1 text-sm text-gray-400">
          Conformément à l&apos;article 20 du RGPD, vous pouvez télécharger l&apos;ensemble de vos données collectées par {store.name}.
        </p>
      </div>

      <div className="rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117] p-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-300">Contenu de l&apos;export</h2>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-gray-300">
          <li>Profil acheteur (id, email, dates)</li>
          <li>Adresses de livraison et facturation</li>
          <li>Historique des commandes et lignes de commande</li>
          <li>Factures émises (références)</li>
          <li>Préférences de notification</li>
        </ul>
        <p className="text-xs text-gray-500">
          Format : JSON structuré (lisible par tout outil compatible). Téléchargement instantané.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Compte : <span className="font-mono text-gray-400">{user.email}</span>
        </p>
      </div>

      <ExportButton slug={slug} />
    </div>
  )
}
