'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import CountryPanel from './CountryPanel'
import { getAnimatedIconHTML, CATEGORY_COLORS } from './AnimatedIcon'
import { useLang } from '@/components/LanguageProvider'
import type { CountryMapData } from '@/types/database'

// Seed data — replaced by API once Supabase is populated
const SEED_COUNTRIES: CountryMapData[] = [
  { iso:'MAR',name_fr:'Maroc',lat:31.79,lng:-7.09,flag:'🇲🇦',region:'Africa',
    trade_balance_usd:-8200000000,total_imports_usd:52000000000,total_exports_usd:43800000000,
    top_import_category:'energy',opportunity_count:12,top_opportunity_score:82,data_year:2023 },
  { iso:'TUN',name_fr:'Tunisie',lat:33.89,lng:9.54,flag:'🇹🇳',region:'Africa',
    trade_balance_usd:-4100000000,total_imports_usd:24000000000,total_exports_usd:19900000000,
    top_import_category:'energy',opportunity_count:8,top_opportunity_score:74,data_year:2023 },
  { iso:'TZA',name_fr:'Tanzanie',lat:-6.37,lng:34.89,flag:'🇹🇿',region:'Africa',
    trade_balance_usd:-2900000000,total_imports_usd:13000000000,total_exports_usd:10100000000,
    top_import_category:'manufactured',opportunity_count:18,top_opportunity_score:91,data_year:2023 },
  { iso:'ZAF',name_fr:'Afrique du Sud',lat:-30.56,lng:22.94,flag:'🇿🇦',region:'Africa',
    trade_balance_usd:2100000000,total_imports_usd:120000000000,total_exports_usd:122100000000,
    top_import_category:'manufactured',opportunity_count:9,top_opportunity_score:65,data_year:2023 },
  { iso:'NAM',name_fr:'Namibie',lat:-22.96,lng:18.49,flag:'🇳🇦',region:'Africa',
    trade_balance_usd:-1200000000,total_imports_usd:7800000000,total_exports_usd:6600000000,
    top_import_category:'agriculture',opportunity_count:14,top_opportunity_score:88,data_year:2023 },
  { iso:'ARE',name_fr:'Émirats Arabes Unis',lat:23.42,lng:53.85,flag:'🇦🇪',region:'Asia',
    trade_balance_usd:38000000000,total_imports_usd:310000000000,total_exports_usd:348000000000,
    top_import_category:'agriculture',opportunity_count:6,top_opportunity_score:71,data_year:2023 },
  { iso:'FRA',name_fr:'France',lat:46.23,lng:2.21,flag:'🇫🇷',region:'Europe',
    trade_balance_usd:-94000000000,total_imports_usd:780000000000,total_exports_usd:686000000000,
    top_import_category:'energy',opportunity_count:4,top_opportunity_score:55,data_year:2023 },
  { iso:'DEU',name_fr:'Allemagne',lat:51.17,lng:10.45,flag:'🇩🇪',region:'Europe',
    trade_balance_usd:178000000000,total_imports_usd:1400000000000,total_exports_usd:1578000000000,
    top_import_category:'energy',opportunity_count:3,top_opportunity_score:48,data_year:2023 },
  { iso:'BRA',name_fr:'Brésil',lat:-14.24,lng:-51.93,flag:'🇧🇷',region:'Americas',
    trade_balance_usd:71000000000,total_imports_usd:230000000000,total_exports_usd:301000000000,
    top_import_category:'energy',opportunity_count:11,top_opportunity_score:77,data_year:2023 },
  { iso:'IND',name_fr:'Inde',lat:20.59,lng:78.96,flag:'🇮🇳',region:'Asia',
    trade_balance_usd:-238000000000,total_imports_usd:710000000000,total_exports_usd:472000000000,
    top_import_category:'energy',opportunity_count:22,top_opportunity_score:94,data_year:2023 },
  { iso:'NGA',name_fr:'Nigeria',lat:9.08,lng:8.68,flag:'🇳🇬',region:'Africa',
    trade_balance_usd:8200000000,total_imports_usd:58000000000,total_exports_usd:66200000000,
    top_import_category:'agriculture',opportunity_count:25,top_opportunity_score:96,data_year:2023 },
  { iso:'ETH',name_fr:'Éthiopie',lat:9.15,lng:40.49,flag:'🇪🇹',region:'Africa',
    trade_balance_usd:-7800000000,total_imports_usd:18000000000,total_exports_usd:10200000000,
    top_import_category:'agriculture',opportunity_count:21,top_opportunity_score:93,data_year:2023 },
  { iso:'KEN',name_fr:'Kenya',lat:0.02,lng:37.91,flag:'🇰🇪',region:'Africa',
    trade_balance_usd:-8900000000,total_imports_usd:22000000000,total_exports_usd:13100000000,
    top_import_category:'energy',opportunity_count:17,top_opportunity_score:89,data_year:2023 },
  { iso:'CHN',name_fr:'Chine',lat:35.86,lng:104.19,flag:'🇨🇳',region:'Asia',
    trade_balance_usd:550000000000,total_imports_usd:2700000000000,total_exports_usd:3250000000000,
    top_import_category:'energy',opportunity_count:5,top_opportunity_score:60,data_year:2023 },
  { iso:'USA',name_fr:'États-Unis',lat:37.09,lng:-95.71,flag:'🇺🇸',region:'Americas',
    trade_balance_usd:-773000000000,total_imports_usd:3400000000000,total_exports_usd:2627000000000,
    top_import_category:'manufactured',opportunity_count:3,top_opportunity_score:42,data_year:2023 },
  { iso:'MEX',name_fr:'Mexique',lat:23.63,lng:-102.55,flag:'🇲🇽',region:'Americas',
    trade_balance_usd:-12000000000,total_imports_usd:580000000000,total_exports_usd:568000000000,
    top_import_category:'materials',opportunity_count:13,top_opportunity_score:80,data_year:2023 },
  { iso:'EGY',name_fr:'Égypte',lat:26.82,lng:30.80,flag:'🇪🇬',region:'Africa',
    trade_balance_usd:-44000000000,total_imports_usd:82000000000,total_exports_usd:38000000000,
    top_import_category:'agriculture',opportunity_count:16,top_opportunity_score:87,data_year:2023 },
  { iso:'PAK',name_fr:'Pakistan',lat:30.38,lng:69.35,flag:'🇵🇰',region:'Asia',
    trade_balance_usd:-31000000000,total_imports_usd:55000000000,total_exports_usd:24000000000,
    top_import_category:'energy',opportunity_count:19,top_opportunity_score:90,data_year:2023 },
  { iso:'VNM',name_fr:'Vietnam',lat:14.06,lng:108.28,flag:'🇻🇳',region:'Asia',
    trade_balance_usd:14000000000,total_imports_usd:360000000000,total_exports_usd:374000000000,
    top_import_category:'materials',opportunity_count:10,top_opportunity_score:75,data_year:2023 },
  { iso:'ARG',name_fr:'Argentine',lat:-38.42,lng:-63.62,flag:'🇦🇷',region:'Americas',
    trade_balance_usd:18000000000,total_imports_usd:80000000000,total_exports_usd:98000000000,
    top_import_category:'manufactured',opportunity_count:8,top_opportunity_score:69,data_year:2023 },
]


function fmtUsd(v: number | null): string {
  if (v == null) return '—'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e12) return sign + '$' + (abs / 1e12).toFixed(1) + 'T'
  if (abs >= 1e9)  return sign + '$' + (abs / 1e9).toFixed(1) + 'B'
  if (abs >= 1e6)  return sign + '$' + (abs / 1e6).toFixed(1) + 'M'
  return sign + '$' + abs.toLocaleString()
}

const TILE_URLS = {
  // Carto Voyager — océans bleu clair, forêts vert tendre, roads subtils.
  // Même style utilisé par The Estate, beaucoup plus lisible que l'OSM brut.
  standard:  { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', opts: { maxZoom: 19, attribution: '© OpenStreetMap, © CARTO' } },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', opts: { maxZoom: 19, attribution: 'Esri' } },
  night:     { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', opts: { maxZoom: 19 } },
} as const

const SATELLITE_LABEL_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'

interface Props {
  activeCategories?: string[]
  activeSubs?: string[]
}

export default function WorldMap({ activeCategories = [], activeSubs = [] }: Props) {
  const { t } = useLang()
  const mapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletMapRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([])
  const [selectedCountry, setSelectedCountry] = useState<CountryMapData | null>(null)
  const [countries, setCountries] = useState<CountryMapData[]>(SEED_COUNTRIES)
  const [mapReady, setMapReady] = useState(false)
  // Satellite par défaut — plus impactant visuellement à l'atterrissage,
  // "Voyager" (standard) reste disponible d'un clic pour la lisibilité pure.
  const [tileMode, setTileMode] = useState<'standard' | 'satellite' | 'night'>('satellite')
  const [totalMarkets, setTotalMarkets] = useState<number | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tileLayerRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const labelLayerRef = useRef<any>(null)

  const openPanel = useCallback((c: CountryMapData) => setSelectedCountry(c), [])

  // Fetch live data from API
  useEffect(() => {
    fetch('/api/countries')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (Array.isArray(data) && data.length > 0) setCountries(data) })
      .catch(() => {/* keep seed data */})

    // Aggregate stats (markets analyzed count) — separate endpoint
    fetch('/api/stats/map')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.markets != null) setTotalMarkets(data.markets) })
      .catch(() => {/* fallback to null, counter will hide */})
  }, [])

  // Init map once
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return

    async function init() {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      const map = L.map(mapRef.current!, {
        center: [20, 10],
        zoom: 2.5,
        minZoom: 2,
        maxZoom: 18,
        zoomControl: false, // manual placement below (topright, away from stats & sidebar)
        zoomSnap: 0.5,
        zoomDelta: 0.5,
        touchZoom: true,
        attributionControl: false,
        worldCopyJump: true,
      })
      // Mount zoom controls at topright on desktop (below tile switcher),
      // and bottom-right on mobile so they never overlap the CategoryFilter
      // toggle button (left), topbar, or the bottom-left stats bar.
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
      L.control.zoom({ position: isMobile ? 'bottomright' : 'topright' }).addTo(map)
      leafletMapRef.current = map
      leafletRef.current = L

      // Démarre sur satellite — le useEffect tileMode gère la suite si l'utilisateur switche.
      tileLayerRef.current = L.tileLayer(TILE_URLS.satellite.url, TILE_URLS.satellite.opts).addTo(map)
      // Ajoute aussi le label overlay satellite au démarrage (noms pays/villes)
      labelLayerRef.current = L.tileLayer(SATELLITE_LABEL_URL, { maxZoom: 19, opacity: 1 }).addTo(map)

      setMapReady(true)
    }

    init()

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
        leafletRef.current = null
        setMapReady(false)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Switch tile layer when tileMode changes
  useEffect(() => {
    if (!mapReady || !leafletMapRef.current || !leafletRef.current || !tileLayerRef.current) return
    const L = leafletRef.current
    const map = leafletMapRef.current

    // Remove previous label overlay
    if (labelLayerRef.current) {
      labelLayerRef.current.remove()
      labelLayerRef.current = null
    }

    tileLayerRef.current.remove()
    tileLayerRef.current = L.tileLayer(TILE_URLS[tileMode].url, TILE_URLS[tileMode].opts).addTo(map)

    // Toggle night class on container so the background bleed matches the tiles
    const container = map.getContainer?.()
    if (container) container.classList.toggle('ftg-night', tileMode === 'night')

    // Add label overlay for satellite mode (cities + countries)
    if (tileMode === 'satellite') {
      labelLayerRef.current = L.tileLayer(SATELLITE_LABEL_URL, { maxZoom: 19, opacity: 1 }).addTo(map)
    }

    // Keep markers on top
    markersRef.current.forEach(m => m.bringToFront?.())
  }, [tileMode, mapReady])

  // Re-render markers whenever map is ready, countries, or filter changes
  useEffect(() => {
    if (!mapReady || !leafletMapRef.current || !leafletRef.current) return
    const filtered = activeCategories.length === 0
      ? countries
      : countries.filter(c => c.top_import_category && activeCategories.includes(c.top_import_category))
    renderMarkers(leafletRef.current, leafletMapRef.current, filtered, openPanel)
  }, [mapReady, countries, activeCategories, activeSubs, openPanel])

  function renderMarkers(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map: any,
    data: CountryMapData[],
    onSelect: (c: CountryMapData) => void,
  ) {
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    data.forEach(c => {
      const iconSize = c.top_opportunity_score && c.top_opportunity_score >= 80 ? 40 : 32
      const iconHtml = getAnimatedIconHTML(
        c.top_import_category ?? 'all',
        undefined,
        iconSize,
        c.top_opportunity_score,
      )
      const icon = L.divIcon({
        html: iconHtml,
        className: 'ftg-div-marker',
        iconSize: [iconSize, iconSize],
        iconAnchor: [iconSize / 2, iconSize / 2],
        popupAnchor: [0, -iconSize / 2 - 4],
      })

      const m = L.marker([c.lat, c.lng], { icon }).addTo(map)

      // Hover popup
      let timer: ReturnType<typeof setTimeout> | null = null
      let popupEnter: (() => void) | null = null
      let popupLeave: (() => void) | null = null

      const popupHtml = buildPopupHtml(c)
      const popup = L.popup({ className: 'ftg-popup', offset: [0, -4], closeButton: false })
        .setContent(popupHtml)

      m.bindPopup(popup)

      m.on('mouseover', () => { if (timer) clearTimeout(timer); m.openPopup() })
      m.on('mouseout',  () => { timer = setTimeout(() => { try { m.closePopup() } catch {} }, 350) })
      m.on('click',     () => { clearTimeout(timer!); m.closePopup(); onSelect(c) })

      m.on('popupopen', () => {
        const el = m.getPopup()?.getElement()
        if (!el) return
        if (popupEnter) el.removeEventListener('mouseenter', popupEnter)
        if (popupLeave) el.removeEventListener('mouseleave', popupLeave)
        popupEnter = () => { if (timer) clearTimeout(timer) }
        popupLeave = () => { timer = setTimeout(() => { try { m.closePopup() } catch {} }, 250) }
        el.addEventListener('mouseenter', popupEnter)
        el.addEventListener('mouseleave', popupLeave)
      })

      m.on('popupclose', () => {
        const el = m.getPopup()?.getElement()
        if (el) {
          if (popupEnter) el.removeEventListener('mouseenter', popupEnter)
          if (popupLeave) el.removeEventListener('mouseleave', popupLeave)
        }
      })

      markersRef.current.push(m)
    })
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {/* Tile mode switcher — compact (icon-only on mobile, icon+label on md+) */}
      <div className={`absolute top-3 right-3 z-[400] flex gap-0.5 bg-[#0D1117]/90 border border-[rgba(201,168,76,.15)] rounded-lg p-0.5 backdrop-blur-sm ${selectedCountry ? 'hidden md:flex' : ''}`}>
        {([
          { id: 'standard',  label: t('map.tile_standard'),  icon: '🗺️' },
          { id: 'satellite', label: t('map.tile_satellite'), icon: '🛰️' },
          { id: 'night',     label: t('map.tile_night'),     icon: '🌙' },
        ] as const).map(m => (
          <button
            key={m.id}
            onClick={() => setTileMode(m.id)}
            aria-label={m.label}
            title={m.label}
            className={`flex items-center justify-center gap-1 w-8 h-8 md:w-auto md:h-auto md:px-2.5 md:py-1.5 rounded text-[11px] font-medium transition-all ${
              tileMode === m.id
                ? 'bg-[#C9A84C] text-[#07090F]'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <span className="text-sm">{m.icon}</span>
            <span className="hidden md:inline">{m.label}</span>
          </button>
        ))}
      </div>

      {/* Stats bar — stacked vertical on mobile, horizontal on md+; anchored bottom-left inside map */}
      <div className={`absolute bottom-3 left-3 flex flex-col md:flex-row md:items-center gap-1.5 md:gap-2 z-[400] pointer-events-none ${selectedCountry ? 'hidden md:flex' : ''}`}>
        <div className="pointer-events-auto bg-[#0D1117]/90 backdrop-blur-sm border border-[rgba(201,168,76,.15)] rounded-md px-2 py-1 text-[10px] md:text-xs text-gray-400 leading-tight whitespace-nowrap">
          <span className="text-[#C9A84C] font-semibold">{countries.length}</span>{' '}
          <span className="hidden md:inline">{t('map.countries_tracked')}</span>
          <span className="md:hidden">{t('map.countries_tracked_short') || 'pays'}</span>
        </div>
        <div className="pointer-events-auto bg-[#0D1117]/90 backdrop-blur-sm border border-[rgba(201,168,76,.15)] rounded-md px-2 py-1 text-[10px] md:text-xs text-gray-400 leading-tight whitespace-nowrap">
          <span className="text-[#C9A84C] font-semibold">
            {countries.reduce((s, c) => s + c.opportunity_count, 0)}
          </span>{' '}
          <span className="hidden md:inline">{t('map.opportunities_qualified') || t('map.opportunities')}</span>
          <span className="md:hidden">{t('map.opportunities_short') || 'opps'}</span>
        </div>
        {totalMarkets != null && totalMarkets > 0 && (
          <div className="pointer-events-auto bg-[#0D1117]/90 backdrop-blur-sm border border-[rgba(201,168,76,.15)] rounded-md px-2 py-1 text-[10px] md:text-xs text-gray-400 leading-tight whitespace-nowrap">
            <span className="text-[#C9A84C] font-semibold">{totalMarkets.toLocaleString()}</span>{' '}
            <span className="hidden md:inline">{t('map.markets_analyzed') || 'marchés analysés'}</span>
            <span className="md:hidden">{t('map.markets_short') || 'marchés'}</span>
          </div>
        )}
        {(activeCategories.length > 0 || activeSubs.length > 0) && (
          <div className="pointer-events-auto bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-md px-2 py-1 text-[10px] md:text-xs text-[#C9A84C] leading-tight whitespace-nowrap">
            {t('map.filter')}:{' '}
            <span className="font-semibold">
              {activeCategories.length > 0 ? activeCategories.join(', ') : ''}
              {activeSubs.length > 0 ? ` · ${activeSubs.length} sub` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Zoom control placement — ensure no overlap with tile switcher (topright desktop)
          or the CategoryFilter toggle button (left) and stats bar (bottom-left) on mobile */}
      <style>{`
        /* Base Leaflet container: gris très clair au lieu de noir par défaut,
           ce qui adoucit la carte pendant les pans/zooms et quand les océans
           sont transparents sur les tiles OSM. */
        .leaflet-container { background: #e7ecf1 !important; }
        /* Mode nuit : on garde un bleu nuit plus doux que le noir pur */
        .leaflet-container.ftg-night { background: #1e293b !important; }
        /* Desktop: tile switcher lives at top:12 right:12; push zoom below it */
        .leaflet-top.leaflet-right { top: 56px !important; right: 12px !important; }
        /* Mobile: zoom is at bottom-right, safe distance from stats bar (bottom-left) */
        @media (max-width: 767px) {
          .leaflet-top.leaflet-right { top: unset !important; }
          .leaflet-bottom.leaflet-right { bottom: 12px !important; right: 12px !important; }
        }
      `}</style>
      {/* Hide zoom controls on mobile when country panel is open (panel covers map) */}
      {selectedCountry && (
        <style>{`@media (max-width: 767px) { .leaflet-control-zoom { display: none !important; } }`}</style>
      )}

      {/* Country detail panel */}
      {selectedCountry && (
        <CountryPanel
          country={selectedCountry}
          onClose={() => setSelectedCountry(null)}
        />
      )}
    </div>
  )
}

function buildPopupHtml(c: CountryMapData): string {
  const color = CATEGORY_COLORS[c.top_import_category ?? 'all'] ?? '#C9A84C'
  const score = c.top_opportunity_score
  const balanceSign = (c.trade_balance_usd ?? 0) >= 0 ? '+' : ''
  return `
    <div style="padding:14px 16px;min-width:240px;font-family:system-ui,sans-serif">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:22px;line-height:1">${c.flag}</span>
        <div>
          <div style="font-weight:600;font-size:14px;color:#F9FAFB">${c.name_fr}</div>
          <div style="font-size:11px;color:#6B7280">${c.region}</div>
        </div>
        ${score ? `<div style="margin-left:auto;background:${color}22;color:${color};font-size:11px;font-weight:600;padding:2px 7px;border-radius:20px">⚡ ${score}</div>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
        <div style="background:#1F2937;border-radius:8px;padding:7px 9px">
          <div style="font-size:10px;color:#6B7280;margin-bottom:2px">Imports</div>
          <div style="font-size:13px;font-weight:600;color:#F87171">${fmtUsd(c.total_imports_usd)}</div>
        </div>
        <div style="background:#1F2937;border-radius:8px;padding:7px 9px">
          <div style="font-size:10px;color:#6B7280;margin-bottom:2px">Exports</div>
          <div style="font-size:13px;font-weight:600;color:#4ADE80">${fmtUsd(c.total_exports_usd)}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#6B7280">
        <span>Balance: <strong style="color:${(c.trade_balance_usd??0)>=0?'#4ADE80':'#F87171'}">${balanceSign}${fmtUsd(c.trade_balance_usd)}</strong></span>
        <span style="color:#C9A84C;cursor:pointer;font-weight:600">View details →</span>
      </div>
    </div>`
}
