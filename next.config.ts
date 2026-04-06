import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  // Turbopack is default in Next.js 16; Leaflet SSR handled via dynamic(ssr:false)
  turbopack: {},
}

export default nextConfig

