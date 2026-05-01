import type { NextConfig } from 'next'

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://challenges.cloudflare.com https://vercel.live",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.resend.com https://api.openai.com https://*.vercel.app https://vercel.live wss://ws-us3.pusher.com https://cdn.jsdelivr.net https://*.gapup.io wss://*.gapup.io",
  "frame-src https://js.stripe.com https://challenges.cloudflare.com https://vercel.live",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(self)' },
  { key: 'Content-Security-Policy', value: csp },
]

const CC_BASE = process.env.NEXT_PUBLIC_CC_BASE || 'https://cc-dashboard.vercel.app'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  // Turbopack is default in Next.js 16; Leaflet SSR handled via dynamic(ssr:false)
  turbopack: {},
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  // Ad Factory moved to command-center 2026-05-01. 308 preserves method (POST→POST)
  // for any external callers still hitting FTG API routes; users following bookmarks
  // get redirected to the new admin pages.
  async redirects() {
    return [
      { source: '/admin/ad-factory', destination: `${CC_BASE}/admin/ad-factory`, permanent: true },
      { source: '/admin/ad-factory/:path*', destination: `${CC_BASE}/admin/ad-factory/:path*`, permanent: true },
      { source: '/api/admin/ad-factory/:path*', destination: `${CC_BASE}/api/admin/ad-factory/:path*`, permanent: true },
      { source: '/api/ad-factory/:path*', destination: `${CC_BASE}/api/ad-factory/:path*`, permanent: true },
    ]
  },
}

export default nextConfig

