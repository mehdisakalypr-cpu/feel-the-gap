// © 2025-2026 Feel The Gap — Mentions légales publiques de la boutique
import { renderLegalDoc } from '../_legal-page'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props { params: Promise<{ slug: string }> }

const FALLBACK = `Mentions légales

Le vendeur n'a pas encore renseigné ses mentions légales. Pour toute question, contactez la boutique.`

export default async function MentionsPage({ params }: Props) {
  const { slug } = await params
  return renderLegalDoc({ slug, docType: 'mentions', defaultTitle: 'Mentions légales', fallbackBody: FALLBACK })
}
