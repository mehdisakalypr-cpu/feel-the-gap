import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  // Leaflet requires window — exclude from server bundle
  webpack(config, { isServer }) {
    if (isServer) {
      config.externals = [...(config.externals ?? []), 'leaflet']
    }
    return config
  },
}

export default nextConfig

