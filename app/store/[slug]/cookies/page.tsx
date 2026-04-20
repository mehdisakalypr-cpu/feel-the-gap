// © 2025-2026 Feel The Gap — Politique cookies publiques de la boutique
import { renderLegalDoc } from '../_legal-page'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props { params: Promise<{ slug: string }> }

const FALLBACK = `Politique de cookies

Cette boutique utilise des cookies strictement nécessaires au panier et à la session. Aucun cookie analytique n'est posé sans votre consentement explicite.`

export default async function CookiesPage({ params }: Props) {
  const { slug } = await params
  return renderLegalDoc({ slug, docType: 'cookies', defaultTitle: 'Politique de cookies', fallbackBody: FALLBACK })
}
