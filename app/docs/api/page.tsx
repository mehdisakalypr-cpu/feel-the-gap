import Link from 'next/link'
import SwaggerEmbed from './SwaggerEmbed'

export const metadata = {
  title: 'Docs API — Feel The Gap',
  description: "Documentation interactive Swagger UI pour l'API Feel The Gap.",
}

export const dynamic = 'force-static'

/**
 * /docs/api — Swagger UI embed via CDN (pas de npm deps).
 * Source : https://github.com/swagger-api/swagger-ui
 * Spec chargée depuis /api/v1/openapi.
 */
export default function ApiDocsPage() {
  return (
    <div style={{ background: '#07090F', minHeight: '100vh' }}>
      <div style={{
        padding: '20px 28px', background: '#0F172A',
        borderBottom: '1px solid rgba(201,168,76,.2)', color: '#E2E8F0',
        fontFamily: 'system-ui, sans-serif', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: '#C9A84C' }}>
            Feel The Gap · Docs API
          </div>
          <h1 style={{ margin: '4px 0 0', fontSize: 22 }}>Documentation interactive</h1>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
          <Link href="/api-platform" style={{ color: '#C9A84C', textDecoration: 'none' }}>← Retour aux tiers</Link>
          <Link href="/account/api-tokens" style={{ color: '#C9A84C', textDecoration: 'none' }}>Mes tokens →</Link>
          <a href="/api/v1/openapi" target="_blank" rel="noopener" style={{ color: '#C9A84C', textDecoration: 'none' }}>openapi.json ↗</a>
        </div>
      </div>
      <SwaggerEmbed />
    </div>
  )
}
