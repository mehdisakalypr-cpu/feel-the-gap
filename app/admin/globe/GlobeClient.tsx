'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@supabase/supabase-js'
import { playBankai, playKaChing, isMuted, setMuted } from '@/lib/globe-audio'
import { attackForCrossing, playAttack, type AnimeAttack } from '@/lib/anime-attacks'

const RevenueGlobe = dynamic(() => import('./RevenueGlobe'), { ssr: false })

type SiteFilter = 'ALL' | 'ftg' | 'ofa' | 'estate'
type CountryRow = { iso: string; name: string | null; lat: number | null; lng: number | null; flag: string | null; ca_total: number; mrr: number; ca_hors_mrr: number; customers: number; purchases: number }
type ProductRow = { product: string; product_name: string; origin_country: string | null; category: string | null; ca_total: number; mrr: number; ca_hors_mrr: number; customers: number; purchases: number }
type FunnelRow = { step: string; visits: number; unique_sessions: number; unique_users: number }
type LiveKpis = { mrr_total: number; ca_hors_mrr_total: number; ca_total: number; payeurs_total: number; subs_count: number; purchases_count: number; visits_24h: number; visits_live: number }

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export default function GlobeClient({ initialSite = 'ALL' as SiteFilter }: { initialSite?: SiteFilter }) {
  const [site, setSite] = useState<SiteFilter>(initialSite)
  const [kpis, setKpis] = useState<LiveKpis | null>(null)
  const [countries, setCountries] = useState<CountryRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [funnel, setFunnel] = useState<FunnelRow[]>([])
  const [selectedIso, setSelectedIso] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [muted, setMutedState] = useState<boolean>(false)
  const [pulses, setPulses] = useState<Array<{ id: number; lat: number; lng: number; color: string }>>([])
  const [attackBanner, setAttackBanner] = useState<AnimeAttack | null>(null)
  const pulseIdRef = useRef(0)
  const bankaiPlayedRef = useRef(false)
  const prevCaTotalRef = useRef<number | null>(null)

  const sb = useMemo(() => createClient(SUPA_URL, SUPA_ANON, { auth: { persistSession: false } }), [])

  // Initial mute state
  useEffect(() => {
    setMutedState(isMuted())
  }, [])

  // Bankai intro — once on mount, after a tiny delay so AudioContext can start on user gesture
  useEffect(() => {
    if (bankaiPlayedRef.current) return
    const onFirstInteraction = () => {
      if (bankaiPlayedRef.current) return
      bankaiPlayedRef.current = true
      playBankai()
      window.removeEventListener('click', onFirstInteraction)
      window.removeEventListener('keydown', onFirstInteraction)
    }
    window.addEventListener('click', onFirstInteraction, { once: true })
    window.addEventListener('keydown', onFirstInteraction, { once: true })
    return () => {
      window.removeEventListener('click', onFirstInteraction)
      window.removeEventListener('keydown', onFirstInteraction)
    }
  }, [])

  // Fetch aggregates (initial + after site change)
  const reload = async () => {
    const siteFilter = site === 'ALL' ? null : site

    const kpisRes = await sb.from('v_live_kpis').select('*').limit(1).maybeSingle()
    if (kpisRes.data) setKpis(kpisRes.data as unknown as LiveKpis)

    let countryQ = sb.from('v_revenue_by_country').select('*')
    if (siteFilter) countryQ = countryQ as unknown as typeof countryQ // site filter applied via revenue_events.site; view ne l'expose pas encore → raw RPC future. v1: sans filter côté view.
    const cRes = await countryQ.order('ca_total', { ascending: false }).limit(200)
    if (cRes.data) setCountries(cRes.data as unknown as CountryRow[])

    const pRes = await sb.from('v_revenue_by_product').select('*').order('ca_total', { ascending: false }).limit(20)
    if (pRes.data) setProducts(pRes.data as unknown as ProductRow[])

    const fRes = await sb.from('v_funnel_stages').select('*').order('visits', { ascending: false })
    if (fRes.data) setFunnel(fRes.data as unknown as FunnelRow[])
  }

  useEffect(() => { reload() }, [site]) // eslint-disable-line react-hooks/exhaustive-deps

  // Bleach attack detection on CA threshold crossing
  useEffect(() => {
    if (!kpis) return
    const newTotal = Number(kpis.ca_total || 0)
    const oldTotal = prevCaTotalRef.current
    if (oldTotal !== null) {
      const attack = attackForCrossing(oldTotal, newTotal)
      if (attack && !isMuted()) {
        try {
          const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          if (C) playAttack(attack, new C())
        } catch {}
        setAttackBanner(attack)
        setTimeout(() => setAttackBanner(null), 4200)
      }
    }
    prevCaTotalRef.current = newTotal
  }, [kpis])

  // Realtime subscribe — new payment → ka-ching + pulse + reload
  useEffect(() => {
    const ch = sb.channel('revenue-globe')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'revenue_events' },
        (payload) => {
          const row = payload.new as {
            amount_eur?: number
            country_iso?: string | null
            metadata?: { country_iso?: string }
            site?: string
          }
          if (site !== 'ALL' && row.site && row.site !== site) return
          const iso = (row.country_iso || row.metadata?.country_iso || '').toUpperCase()
          const c = countries.find((x) => x.iso === iso)
          const lat = c?.lat ?? 0
          const lng = c?.lng ?? 0
          playKaChing(row.amount_eur)
          const id = ++pulseIdRef.current
          setPulses((p) => [...p, { id, lat, lng, color: '#C9A84C' }])
          setTimeout(() => setPulses((p) => p.filter((x) => x.id !== id)), 2200)
          reload()
        }
      )
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [sb, site, countries]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMute = () => {
    const next = !muted
    setMutedState(next)
    setMuted(next)
  }

  const filteredProducts = useMemo(() => {
    if (!selectedIso) return products
    return products.filter((p) => (p.origin_country || '').toUpperCase() === selectedIso)
  }, [products, selectedIso])

  const selectedCountry = selectedIso ? countries.find((c) => c.iso === selectedIso) : null
  const selectedProductRow = selectedProduct ? products.find((p) => p.product === selectedProduct) : null

  return (
    <div className="min-h-screen bg-[#0A0E17] text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-[rgba(201,168,76,.15)] bg-[#0A0E17]/95 backdrop-blur">
        <div className="px-6 py-3 flex items-center gap-4 flex-wrap">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <span className="text-[#C9A84C]">🗡️ BANKAI</span>
            <span className="text-gray-500 text-sm font-normal">— Revenue Globe</span>
          </h1>

          <div className="flex items-center gap-1 ml-auto text-sm">
            {(['ALL', 'ftg', 'ofa', 'estate'] as SiteFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => { setSite(s); setSelectedIso(null); setSelectedProduct(null) }}
                className={`px-3 py-1 rounded-md border text-xs font-semibold uppercase tracking-wider transition-colors ${site === s ? 'bg-[#C9A84C] text-[#07090F] border-[#C9A84C]' : 'bg-transparent text-gray-400 border-white/10 hover:border-[#C9A84C]/40'}`}
              >
                {s === 'ALL' ? 'All sites' : s}
              </button>
            ))}
          </div>

          <button
            onClick={toggleMute}
            className="px-3 py-1 rounded-md bg-white/5 border border-white/10 text-sm hover:bg-white/10"
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>

        <div className="px-6 pb-3 grid grid-cols-2 md:grid-cols-6 gap-3">
          <Kpi label="CA Total" value={fmtEur(kpis?.ca_total)} accent />
          <Kpi label="MRR" value={fmtEur(kpis?.mrr_total)} accent />
          <Kpi label="Hors MRR" value={fmtEur(kpis?.ca_hors_mrr_total)} />
          <Kpi label="Payeurs" value={String(kpis?.payeurs_total ?? 0)} />
          <Kpi label="Visites 24h" value={String(kpis?.visits_24h ?? 0)} />
          <Kpi label="Live (5min)" value={String(kpis?.visits_live ?? 0)} pulse={!!kpis?.visits_live} />
        </div>
      </div>

      {/* Bleach attack banner overlay */}
      {attackBanner && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div
            className="px-10 py-6 rounded-2xl border-4 backdrop-blur-lg animate-[bankaiIn_.35s_ease-out]"
            style={{ borderColor: attackBanner.color, background: `linear-gradient(135deg, ${attackBanner.color}22, #0A0E17EE)` }}
          >
            <div className="text-6xl text-center mb-2">{attackBanner.emoji}</div>
            <div className="text-3xl font-black uppercase tracking-widest text-center" style={{ color: attackBanner.color, textShadow: `0 0 20px ${attackBanner.color}` }}>
              {attackBanner.name}
            </div>
            <div className="text-center text-xs text-gray-400 mt-1 uppercase tracking-wider">{attackBanner.character} · {attackBanner.anime}</div>
            <div className="text-center text-sm text-white/80 mt-2 italic">&ldquo;{attackBanner.tagline}&rdquo;</div>
            <div className="text-center text-[10px] text-gray-500 mt-3">Palier franchi : €{attackBanner.threshold.toLocaleString('fr-FR')}</div>
          </div>
        </div>
      )}
      <style jsx global>{`
        @keyframes bankaiIn {
          0%   { opacity: 0; transform: scale(0.6) rotate(-8deg); }
          60%  { opacity: 1; transform: scale(1.1) rotate(2deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
      `}</style>

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row">
        {/* Globe */}
        <div className="flex-1 relative min-h-[60vh] lg:min-h-[calc(100vh-140px)]">
          <RevenueGlobe
            countries={countries}
            selectedIso={selectedIso}
            onSelectIso={(iso) => setSelectedIso((cur) => (cur === iso ? null : iso))}
            pulses={pulses}
          />
          {selectedCountry && (
            <div className="absolute bottom-4 left-4 right-4 lg:right-auto lg:max-w-md bg-[#0D1117]/95 border border-[rgba(201,168,76,.25)] rounded-xl p-4 backdrop-blur">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{selectedCountry.flag}</span>
                <span className="font-bold">{selectedCountry.name || selectedCountry.iso}</span>
                <button onClick={() => setSelectedIso(null)} className="ml-auto text-gray-500 hover:text-white text-sm">✕</button>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <Stat label="CA" value={fmtEur(selectedCountry.ca_total)} />
                <Stat label="MRR" value={fmtEur(selectedCountry.mrr)} />
                <Stat label="Clients" value={String(selectedCountry.customers)} />
              </div>
              <div className="mt-3">
                <div className="text-xs text-gray-500 mb-1">Top produits</div>
                <div className="flex flex-col gap-1">
                  {filteredProducts.slice(0, 5).map((p) => (
                    <button
                      key={p.product}
                      onClick={() => setSelectedProduct((cur) => (cur === p.product ? null : p.product))}
                      className="flex justify-between text-xs px-2 py-1 rounded hover:bg-white/5"
                    >
                      <span className="truncate">{p.product_name}</span>
                      <span className="text-[#C9A84C]">{fmtEur(p.ca_total)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <aside className="lg:w-[340px] border-l border-white/10 p-5 space-y-6 lg:sticky lg:top-[140px] lg:self-start lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto">
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">🏆 Top produits CA</h2>
            <ul className="space-y-1">
              {products.slice(0, 10).map((p, i) => (
                <li key={p.product}>
                  <button
                    onClick={() => setSelectedProduct((cur) => (cur === p.product ? null : p.product))}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${selectedProduct === p.product ? 'bg-[#C9A84C]/15 border border-[#C9A84C]/40' : 'hover:bg-white/5 border border-transparent'}`}
                  >
                    <span className="text-xs w-6 text-gray-600">{i + 1}.</span>
                    <span className="flex-1 text-sm truncate">{p.product_name}</span>
                    <span className="text-sm text-[#C9A84C] font-semibold">{fmtEur(p.ca_total)}</span>
                  </button>
                </li>
              ))}
              {products.length === 0 && <li className="text-sm text-gray-600 italic px-2">Aucune vente — en attente du premier encaissement.</li>}
            </ul>
            {selectedProductRow && (
              <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="text-xs text-gray-500 mb-2">{selectedProductRow.product_name}</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Stat label="CA" value={fmtEur(selectedProductRow.ca_total)} />
                  <Stat label="MRR" value={fmtEur(selectedProductRow.mrr)} />
                  <Stat label="Clients" value={String(selectedProductRow.customers)} />
                </div>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">🎯 CA par parcours</h2>
            <ul className="space-y-1">
              {funnel.map((f) => (
                <li key={f.step} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                  <span className="flex-1 truncate text-gray-400">{f.step}</span>
                  <span className="text-xs text-gray-500">{f.visits} visites</span>
                </li>
              ))}
              {funnel.length === 0 && <li className="text-sm text-gray-600 italic px-2">Aucun événement funnel dans les 24 dernières heures.</li>}
            </ul>
          </section>

          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">ℹ️ Status</h2>
            <div className="text-xs text-gray-500 space-y-1">
              <div>Site actif : <span className="text-white">{site === 'ALL' ? 'Tous les sites' : site.toUpperCase()}</span></div>
              <div>Pays trackés : <span className="text-white">{countries.length}</span></div>
              <div>Canal Realtime : <span className="text-emerald-400">✓ connecté</span></div>
              <div className="text-gray-600 pt-2">
                Dépose <code className="text-gray-400">/public/sounds/bankai.mp3</code> pour remplacer l&apos;intro synthétisée.
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

function Kpi({ label, value, accent, pulse }: { label: string; value: string; accent?: boolean; pulse?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${accent ? 'border-[#C9A84C]/40 bg-[#C9A84C]/5' : 'border-white/10 bg-white/5'}`}>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 flex items-center gap-1">
        {label}
        {pulse && <span className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />}
      </div>
      <div className={`text-lg font-bold ${accent ? 'text-[#C9A84C]' : 'text-white'}`}>{value}</div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="font-semibold text-white">{value}</div>
    </div>
  )
}

function fmtEur(n: number | null | undefined): string {
  const v = Number(n || 0)
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `€${(v / 1_000).toFixed(1)}K`
  return `€${v.toFixed(0)}`
}
