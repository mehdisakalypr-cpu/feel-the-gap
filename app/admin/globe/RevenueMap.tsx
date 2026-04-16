'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { geoEqualEarth, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'

type CountryRow = {
  iso: string
  name: string | null
  lat: number | null
  lng: number | null
  flag: string | null
  ca_total: number
  mrr: number
  customers: number
}

type Pulse = { id: number; lat: number; lng: number; color: string }

interface Props {
  countries: CountryRow[]
  selectedIso: string | null
  onSelectIso: (iso: string) => void
  pulses: Pulse[]
}

// Natural Earth 110m topology — served from jsdelivr CDN
const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

type WorldTopology = {
  type: 'Topology'
  objects: { countries: { type: 'GeometryCollection'; geometries: unknown[] } }
  [k: string]: unknown
}

export default function RevenueMap({ countries, selectedIso, onSelectIso, pulses }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 1200, h: 600 })
  const [features, setFeatures] = useState<Feature<Geometry, { name: string }>[]>([])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      setSize({ w, h: Math.round(w * 0.55) })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    fetch(TOPO_URL).then((r) => r.json()).then((topo: WorldTopology) => {
      const fc = feature(topo as unknown as Parameters<typeof feature>[0], topo.objects.countries as Parameters<typeof feature>[1]) as FeatureCollection<Geometry, { name: string }>
      setFeatures(fc.features)
    }).catch(() => {/* noop */})
  }, [])

  const { projection, pathGen } = useMemo(() => {
    const proj = geoEqualEarth().fitSize([size.w, size.h], { type: 'Sphere' } as unknown as Feature)
    return { projection: proj, pathGen: geoPath(proj) }
  }, [size.w, size.h])

  const maxCa = useMemo(() => Math.max(1, ...countries.map((c) => c.ca_total || 0)), [countries])

  const markers = useMemo(() =>
    countries
      .filter((c) => c.lat != null && c.lng != null && c.ca_total > 0)
      .map((c) => {
        const coords = projection([c.lng as number, c.lat as number])
        if (!coords) return null
        const size = 3 + Math.sqrt(c.ca_total / maxCa) * 18
        return { c, x: coords[0], y: coords[1], size }
      })
      .filter(Boolean) as Array<{ c: CountryRow; x: number; y: number; size: number }>,
  [countries, maxCa, projection])

  const pulsePoints = useMemo(() =>
    pulses.map((p) => {
      const coords = projection([p.lng, p.lat])
      if (!coords) return null
      return { ...p, x: coords[0], y: coords[1] }
    }).filter(Boolean) as Array<Pulse & { x: number; y: number }>,
  [pulses, projection])

  return (
    <div ref={containerRef} className="w-full h-full min-h-[60vh] relative bg-[#0A0E17]">
      <svg width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} className="block">
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#C9A84C" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#C9A84C" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Graticule / sphere outline */}
        <path d={pathGen({ type: 'Sphere' } as unknown as Feature) || ''} fill="#0D1117" stroke="rgba(201,168,76,.10)" strokeWidth={0.8} />

        {/* Countries */}
        {features.map((f, i) => (
          <path
            key={(f.id as string) ?? i}
            d={pathGen(f) || ''}
            fill="rgba(255,255,255,.04)"
            stroke="rgba(201,168,76,.15)"
            strokeWidth={0.4}
          />
        ))}

        {/* Revenue markers */}
        {markers.map(({ c, x, y, size: s }) => {
          const dimmed = selectedIso && selectedIso !== c.iso
          return (
            <g
              key={c.iso}
              onClick={() => onSelectIso(c.iso)}
              style={{ cursor: 'pointer' }}
            >
              <circle cx={x} cy={y} r={s + 3} fill="url(#glow)" opacity={dimmed ? 0.25 : 0.7} />
              <circle cx={x} cy={y} r={s} fill={dimmed ? 'rgba(150,150,150,.45)' : '#C9A84C'} stroke="#0A0E17" strokeWidth={1}>
                <title>{c.name || c.iso} — €{c.ca_total.toLocaleString('fr-FR')} · {c.customers} clients</title>
              </circle>
            </g>
          )
        })}

        {/* Pulse rings (ka-ching) */}
        {pulsePoints.map((p) => (
          <g key={p.id}>
            <circle cx={p.x} cy={p.y} r={5} fill="none" stroke={p.color} strokeWidth={2} opacity={0.85}>
              <animate attributeName="r" from="5" to="60" dur="2s" fill="freeze" />
              <animate attributeName="opacity" from="0.85" to="0" dur="2s" fill="freeze" />
            </circle>
            <circle cx={p.x} cy={p.y} r={3} fill={p.color} opacity={1}>
              <animate attributeName="opacity" from="1" to="0" dur="1.2s" fill="freeze" />
            </circle>
          </g>
        ))}
      </svg>
    </div>
  )
}
