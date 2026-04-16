'use client'

import { useEffect, useMemo, useRef } from 'react'
import Globe from 'react-globe.gl'

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

export default function RevenueGlobe({ countries, selectedIso, onSelectIso, pulses }: Props) {
  const globeRef = useRef<unknown>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const maxCa = useMemo(() => Math.max(1, ...countries.map((c) => c.ca_total || 0)), [countries])

  const points = useMemo(() =>
    countries
      .filter((c) => c.lat != null && c.lng != null && c.ca_total > 0)
      .map((c) => ({
        lat: c.lat as number,
        lng: c.lng as number,
        iso: c.iso,
        name: c.name,
        ca: c.ca_total,
        customers: c.customers,
        size: 0.3 + (c.ca_total / maxCa) * 1.5,
        color: selectedIso && selectedIso !== c.iso ? 'rgba(150,150,150,.35)' : '#C9A84C',
      })),
  [countries, maxCa, selectedIso])

  const rings = useMemo(() => pulses.map((p) => ({ lat: p.lat, lng: p.lng, color: p.color })), [pulses])

  // Responsive dimensions
  const sizeRef = useRef({ w: 800, h: 600 })
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => { sizeRef.current = { w: el.clientWidth, h: el.clientHeight } }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Auto-rotate until a country is selected
  useEffect(() => {
    const g = globeRef.current as { controls?: () => { autoRotate: boolean; autoRotateSpeed: number } } | null
    if (!g || !g.controls) return
    const ctrl = g.controls()
    ctrl.autoRotate = !selectedIso
    ctrl.autoRotateSpeed = 0.4
  }, [selectedIso, countries.length])

  return (
    <div ref={containerRef} className="w-full h-full min-h-[60vh]">
      <Globe
        ref={globeRef as React.MutableRefObject<never>}
        width={sizeRef.current.w}
        height={sizeRef.current.h}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundColor="rgba(10,14,23,1)"
        atmosphereColor="#C9A84C"
        atmosphereAltitude={0.18}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointAltitude={(d: unknown) => (d as { size: number }).size * 0.04}
        pointRadius={(d: unknown) => (d as { size: number }).size * 0.5}
        pointLabel={(d: unknown) => {
          const x = d as { name: string; iso: string; ca: number; customers: number }
          return `<div style="background:#0D1117;border:1px solid #C9A84C;padding:6px 10px;border-radius:8px;font-family:system-ui"><b>${x.name || x.iso}</b><br/>CA: €${(x.ca).toLocaleString('fr-FR')}<br/>Clients: ${x.customers}</div>`
        }}
        onPointClick={(d: unknown) => onSelectIso((d as { iso: string }).iso)}
        ringsData={rings}
        ringColor={(d: unknown) => (d as { color: string }).color}
        ringMaxRadius={5}
        ringPropagationSpeed={3}
        ringRepeatPeriod={1200}
      />
    </div>
  )
}
