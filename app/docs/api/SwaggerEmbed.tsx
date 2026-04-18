'use client'

import { useEffect, useRef } from 'react'

const SWAGGER_CSS_URL = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css'
const SWAGGER_JS_URL = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js'

/**
 * SwaggerEmbed — charge Swagger UI depuis CDN via DOM refs (safe).
 * Aucun innerHTML / dangerouslySetInnerHTML : uniquement createElement + setAttribute.
 */
export default function SwaggerEmbed() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const cssId = 'swagger-ui-css'
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link')
      link.id = cssId
      link.rel = 'stylesheet'
      link.href = SWAGGER_CSS_URL
      document.head.appendChild(link)
    }

    const scriptId = 'swagger-ui-bundle'
    const init = () => {
      const g = window as unknown as {
        SwaggerUIBundle?: (opts: Record<string, unknown>) => unknown
        ui?: unknown
      }
      if (!g.SwaggerUIBundle) return
      g.ui = g.SwaggerUIBundle({
        url: '/api/v1/openapi',
        dom_id: '#swagger-ui',
        deepLinking: true,
        layout: 'BaseLayout',
        tryItOutEnabled: true,
        persistAuthorization: true,
      })
    }

    const existing = document.getElementById(scriptId) as HTMLScriptElement | null
    if (existing) {
      if ((window as unknown as { SwaggerUIBundle?: unknown }).SwaggerUIBundle) init()
      else existing.addEventListener('load', init, { once: true })
    } else {
      const script = document.createElement('script')
      script.id = scriptId
      script.src = SWAGGER_JS_URL
      script.crossOrigin = 'anonymous'
      script.onload = init
      document.body.appendChild(script)
    }
  }, [])

  return (
    <div
      id="swagger-ui"
      ref={containerRef}
      style={{ background: 'white', padding: '20px 0', minHeight: '80vh' }}
    />
  )
}
