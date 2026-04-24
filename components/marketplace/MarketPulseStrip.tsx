'use client'

/**
 * MarketPulseStrip — surface indicative trade volumes on marketplace landing.
 *
 * Source: real aggregated Comtrade/FAO data via ftg_product_country_pair_agg
 * matview → ftg_market_pulse_top RPC → /api/marketplace/market-pulse.
 *
 * NOT fake seed: always labelled "Indicative — Comtrade/FAO" so users know
 * these are market-level signals (not active supplier listings). CTAs route
 * to real actions: post volume as supplier, post demand as buyer.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'

type PulseItem = {
  product_id: string
  product_label: string
  country_iso: string
  country_name: string
  flag: string
  category: string
  indicative_gap_usd: number
  opportunity_count: number
  max_opportunity_score: number
}

function fmtUsd(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3)  return `$${(v / 1e3).toFixed(0)}K`
  return `$${Math.round(v)}`
}

export function MarketPulseStrip({ limit = 12 }: { limit?: number }) {
  const [items, setItems] = useState<PulseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/marketplace/market-pulse?limit=${limit}`, { cache: 'force-cache' })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return
        if (!j.ok) {
          setErr(j.error ?? 'fetch_failed')
        } else {
          setItems(j.items ?? [])
        }
      })
      .catch((e) => alive && setErr(String(e)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [limit])

  if (loading) {
    return (
      <section className="mb-6">
        <div className="h-[140px] bg-white/[.02] border border-white/5 rounded-xl animate-pulse" />
      </section>
    )
  }

  if (err || items.length === 0) return null

  return (
    <section className="mb-6 space-y-3">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span>📊</span> Market Pulse
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Indicative corridors — sourced from Comtrade &amp; FAO aggregates, refreshed daily.
            These are market-level trade flows, not active supplier listings.
          </p>
        </div>
        <div className="text-[10px] text-gray-600 shrink-0 hidden sm:block">
          {items.length} corridors · transparent source
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((it) => (
          <div
            key={`${it.product_id}-${it.country_iso}`}
            className="p-3 bg-[#0D1117] border border-white/10 rounded-xl hover:border-[#C9A84C]/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate" title={it.product_label}>
                  {it.product_label}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                  <span>{it.flag || '🌍'}</span>
                  <span className="truncate">{it.country_name}</span>
                  {it.category && it.category !== 'other' && (
                    <span className="text-gray-600">· {it.category}</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-[#C9A84C]">
                  {fmtUsd(Number(it.indicative_gap_usd) || 0)}
                </div>
                <div className="text-[10px] text-gray-500">gap indicatif</div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
              <span
                className="text-[10px] px-1.5 py-0.5 bg-white/[.03] border border-white/10 rounded text-gray-400"
                title="Aggregated from Comtrade + FAO trade data"
              >
                Indicative
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href={`/marketplace/new?kind=volume&country=${it.country_iso}`}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 underline underline-offset-2 whitespace-nowrap"
                  title="I produce this — list a volume"
                >
                  Sell →
                </Link>
                <Link
                  href={`/marketplace/new?kind=demand&country=${it.country_iso}`}
                  className="text-[11px] text-[#C9A84C] hover:text-[#E8C97A] underline underline-offset-2 whitespace-nowrap"
                  title="I need this — post a buyer demand"
                >
                  Buy →
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
