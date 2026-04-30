import type { MetadataRoute } from 'next'

const SITE = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://www.gapup.io'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/companies-sitemap-index', '/api/companies-sitemap/', '/api/trade-shows-sitemap', '/api/companies/remove-request'],
        disallow: [
          '/admin/',
          '/api/',
          '/account/',
          '/buyer/',
          '/seller/',
          '/onboarding/internal/',
          '/_next/',
          '/auth/reset',
          '/auth/biometric',
        ],
      },
      {
        userAgent: ['GPTBot', 'ChatGPT-User', 'CCBot', 'anthropic-ai', 'Claude-Web', 'Google-Extended', 'PerplexityBot'],
        disallow: '/',
      },
    ],
    sitemap: [
      `${SITE}/sitemap.xml`,
      `${SITE}/api/companies-sitemap-index`,
      `${SITE}/api/trade-shows-sitemap`,
    ],
    host: SITE,
  }
}
