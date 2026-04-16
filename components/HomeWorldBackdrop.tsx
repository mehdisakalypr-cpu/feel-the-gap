'use client'

import { useEffect, useState } from 'react'
import { geoEqualEarth, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'

const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

type WorldTopology = {
  type: 'Topology'
  objects: { countries: { type: 'GeometryCollection'; geometries: unknown[] } }
  [k: string]: unknown
}

// Major trade hubs — golden dots pulsing over the map
const TRADE_HUBS: Array<{ lat: number; lng: number; color: string }> = [
  { lat: 48.85, lng: 2.35,   color: '#C9A84C' }, // Paris
  { lat: 40.71, lng: -74.01, color: '#60A5FA' }, // New York
  { lat: 51.51, lng: -0.13,  color: '#A78BFA' }, // London
  { lat: 35.68, lng: 139.69, color: '#F472B6' }, // Tokyo
  { lat: 22.32, lng: 114.17, color: '#34D399' }, // Hong Kong
  { lat: 1.35,  lng: 103.82, color: '#FBBF24' }, // Singapore
  { lat: -33.87, lng: 151.21, color: '#22D3EE' }, // Sydney
  { lat: -23.55, lng: -46.64, color: '#FB923C' }, // São Paulo
  { lat: 6.52,  lng: 3.38,   color: '#C9A84C' }, // Lagos
  { lat: -33.93, lng: 18.42, color: '#34D399' }, // Cape Town
  { lat: 25.20, lng: 55.27,  color: '#F59E0B' }, // Dubai
  { lat: 19.08, lng: 72.88,  color: '#F472B6' }, // Mumbai
  { lat: 5.35,  lng: -4.02,  color: '#C9A84C' }, // Abidjan
  { lat: 14.69, lng: -17.44, color: '#34D399' }, // Dakar
]

export default function HomeWorldBackdrop() {
  const [features, setFeatures] = useState<Feature<Geometry, { name: string }>[]>([])

  useEffect(() => {
    fetch(TOPO_URL).then((r) => r.json()).then((topo: WorldTopology) => {
      const fc = feature(topo as unknown as Parameters<typeof feature>[0], topo.objects.countries as Parameters<typeof feature>[1]) as FeatureCollection<Geometry, { name: string }>
      setFeatures(fc.features)
    }).catch(() => {})
  }, [])

  const W = 1920
  const H = 960
  const projection = geoEqualEarth().fitSize([W, H], { type: 'Sphere' } as unknown as Feature)
  const pathGen = geoPath(projection)

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at top, #0D1117 0%, #07090F 45%, #050710 100%)' }} />

      {/* World SVG */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full opacity-45 mix-blend-screen"
      >
        <defs>
          <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#C9A84C" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#C9A84C" stopOpacity="0" />
          </radialGradient>
          <filter id="softBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
          <linearGradient id="countryFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1A2236" />
            <stop offset="100%" stopColor="#0F1524" />
          </linearGradient>
        </defs>

        {/* Countries — soft dark fill with subtle border */}
        <g filter="url(#softBlur)">
          {features.map((f, i) => (
            <path
              key={(f.id as string) ?? i}
              d={pathGen(f) || ''}
              fill="url(#countryFill)"
              stroke="rgba(201,168,76,0.18)"
              strokeWidth={0.7}
            />
          ))}
        </g>

        {/* Pulsing trade hubs */}
        {TRADE_HUBS.map((h, i) => {
          const coords = projection([h.lng, h.lat])
          if (!coords) return null
          const delay = (i * 0.23) % 3
          return (
            <g key={i}>
              <circle cx={coords[0]} cy={coords[1]} r={16} fill="url(#hubGlow)" opacity={0.9} />
              <circle cx={coords[0]} cy={coords[1]} r={3} fill={h.color} opacity={0.95}>
                <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" begin={`${delay}s`} repeatCount="indefinite" />
              </circle>
              <circle cx={coords[0]} cy={coords[1]} r={8} fill="none" stroke={h.color} strokeWidth={1.5} opacity={0.5}>
                <animate attributeName="r" values="3;24;3" dur="4s" begin={`${delay}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0;0.6" dur="4s" begin={`${delay}s`} repeatCount="indefinite" />
              </circle>
            </g>
          )
        })}
      </svg>

      {/* Warm color overlay — soft gold + azure gradients */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(800px 500px at 20% 30%, rgba(201,168,76,.12), transparent), radial-gradient(700px 400px at 80% 70%, rgba(96,165,250,.08), transparent)' }} />
      {/* Vignette to keep focus on center content */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 0%, rgba(7,9,15,.4) 70%, rgba(7,9,15,.85) 100%)' }} />
    </div>
  )
}
