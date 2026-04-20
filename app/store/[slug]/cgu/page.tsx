// © 2025-2026 Feel The Gap — CGU publiques de la boutique
import { renderLegalDoc } from '../_legal-page'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props { params: Promise<{ slug: string }> }

const FALLBACK = `Conditions Générales d'Utilisation

L'utilisation de cette boutique implique l'acceptation des règles de courtoisie et des lois en vigueur.`

export default async function CguPage({ params }: Props) {
  const { slug } = await params
  return renderLegalDoc({ slug, docType: 'cgu', defaultTitle: 'Conditions Générales d\'Utilisation', fallbackBody: FALLBACK })
}
