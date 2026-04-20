// © 2025-2026 Feel The Gap — CGV publiques de la boutique
import { renderLegalDoc } from '../_legal-page'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props { params: Promise<{ slug: string }> }

const FALLBACK = `Conditions Générales de Vente

La boutique n'a pas encore publié ses CGV. Veuillez contacter le vendeur avant tout achat.`

export default async function CgvPage({ params }: Props) {
  const { slug } = await params
  return renderLegalDoc({ slug, docType: 'cgv', defaultTitle: 'Conditions Générales de Vente', fallbackBody: FALLBACK })
}
