import type { MetadataRoute } from 'next'

const SITE = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://feel-the-gap.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
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
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  }
}
