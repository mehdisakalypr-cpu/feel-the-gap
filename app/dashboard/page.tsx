'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/components/LanguageProvider'

type Selection = {
  id: string
  opportunity_id: string
  country_iso: string
  product_slug: string | null
  created_at: string
  opportunities: {
    id: string
    opportunity_score: number | null
    products: { id: string; name: string; name_fr: string | null } | null
    countries: { id: string; name: string; name_fr: string | null; flag: string | null } | null
  } | null
}

type Product = {
  id: string
  slug: string
  name: string
  country_iso: string | null
  completion_pct: number
  status: 'draft' | 'active' | 'archived'
  updated_at: string
}

type Dossier = {
  id: string
  type: 'financement' | 'investissement'
  title: string | null
  country_iso: string | null
  product_slug: string | null
  amount_eur: number | null
  completion_pct: number | null
  status: string | null
  updated_at: string
}

type Summary = {
  selections: Selection[]
  products: Product[]
  funding: Dossier[]
  investment: Dossier[]
  counts: { selections: number; products: number; funding: number; investment: number }
}

function fmtEur(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' M€'
  if (n >= 1e3) return Math.round(n / 1e3) + ' k€'
  return n.toLocaleString('fr-FR') + ' €'
}

export default function DashboardPage() {
  const { t, lang } = useLang()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/summary', { cache: 'no-store' })
      .then(async r => {
        if (r.status === 401) { window.location.href = '/auth/login?redirect=/dashboard'; return null }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => { if (data) setSummary(data) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const countryLabel = (c: { name: string; name_fr: string | null } | null) =>
    c ? (lang === 'fr' ? (c.name_fr ?? c.name) : (c.name || c.name_fr || '')) : '—'
  const productLabel = (p: { name: string; name_fr: string | null } | null) =>
    p ? (lang === 'fr' ? (p.name_fr ?? p.name) : (p.name || p.name_fr || '')) : '—'

  if (loading) return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-white/50">{t('common.loading')}</div>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-red-400">{error}</div>
      </div>
    </div>
  )

  const s = summary!
  const incomplete = (pct: number | null) => (pct ?? 0) < 100

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <main className="max-w-6xl mx-auto px-4 py-10">
        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.25em] text-[#C9A84C] mb-1">{t('dashboard.kicker')}</div>
          <h1 className="text-3xl md:text-4xl font-bold">{t('dashboard.title')}</h1>
          <p className="text-sm text-white/60 mt-2 max-w-2xl">{t('dashboard.intro')}</p>
        </header>

        <section className="grid md:grid-cols-2 gap-5 mb-6">
          <StatCard label={t('dashboard.count_opps')} value={s.counts.selections} href="#opps" />
          <StatCard label={t('dashboard.count_products')} value={s.counts.products} href="#products" />
          <StatCard label={t('dashboard.count_funding')} value={s.counts.funding} href="#funding" />
          <StatCard label={t('dashboard.count_investment')} value={s.counts.investment} href="#investment" />
        </section>

        <section id="opps" className="mb-10">
          <SectionHeader
            title={t('dashboard.block_opps_title')}
            hint={t('dashboard.block_opps_hint')}
            cta={{ href: '/reports', label: t('dashboard.block_opps_cta') }}
          />
          {s.selections.length === 0 ? (
            <EmptyState
              icon="🎯"
              title={t('dashboard.empty_opps_title')}
              desc={t('dashboard.empty_opps_desc')}
              cta={{ href: '/reports', label: t('dashboard.empty_opps_cta') }}
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {s.selections.map(sel => (
                <Link
                  key={sel.id}
                  href={`/reports/${sel.country_iso}#opp-${sel.opportunity_id}`}
                  className="block rounded-xl border border-white/10 bg-white/3 hover:bg-white/5 transition-colors p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{sel.opportunities?.countries?.flag ?? '🌍'}</span>
                    <span className="text-sm text-white/80">{countryLabel(sel.opportunities?.countries ?? null)}</span>
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/30">
                      {sel.opportunities?.opportunity_score ?? '—'}/100
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-white">{productLabel(sel.opportunities?.products ?? null)}</div>
                  <div className="mt-3 text-[11px] text-white/40">{t('dashboard.open_synthesis')} →</div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section id="products" className="mb-10">
          <SectionHeader
            title={t('dashboard.block_products_title')}
            hint={t('dashboard.block_products_hint')}
            cta={{ href: '/dashboard/products/new', label: t('dashboard.block_products_cta') }}
          />
          {s.products.length === 0 ? (
            <EmptyState
              icon="🛍️"
              title={t('dashboard.empty_products_title')}
              desc={t('dashboard.empty_products_desc')}
              cta={{ href: '/dashboard/products/new', label: t('dashboard.empty_products_cta') }}
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {s.products.map(p => (
                <Link
                  key={p.id}
                  href={`/dashboard/products/${p.slug}`}
                  className="block rounded-xl border border-white/10 bg-white/3 hover:bg-white/5 transition-colors p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white truncate pr-2">{p.name}</span>
                    {incomplete(p.completion_pct) && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 shrink-0">
                        {t('dashboard.to_complete')}
                      </span>
                    )}
                  </div>
                  <ProgressBar pct={p.completion_pct} />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section id="funding" className="mb-10">
          <SectionHeader
            title={t('dashboard.block_funding_title')}
            hint={t('dashboard.block_funding_hint')}
            cta={{ href: '/funding', label: t('dashboard.block_funding_cta') }}
          />
          {s.funding.length === 0 ? (
            <EmptyState
              icon="🏦"
              title={t('dashboard.empty_funding_title')}
              desc={t('dashboard.empty_funding_desc')}
              cta={{ href: '/funding', label: t('dashboard.empty_funding_cta') }}
            />
          ) : (
            <DossierList items={s.funding} t={t} />
          )}
        </section>

        <section id="investment" className="mb-10">
          <SectionHeader
            title={t('dashboard.block_investment_title')}
            hint={t('dashboard.block_investment_hint')}
            cta={{ href: '/funding', label: t('dashboard.block_investment_cta') }}
          />
          {s.investment.length === 0 ? (
            <EmptyState
              icon="📈"
              title={t('dashboard.empty_investment_title')}
              desc={t('dashboard.empty_investment_desc')}
              cta={{ href: '/funding', label: t('dashboard.empty_investment_cta') }}
            />
          ) : (
            <DossierList items={s.investment} t={t} />
          )}
        </section>
      </main>
    </div>
  )

  function DossierList({ items, t }: { items: Dossier[]; t: (k: string) => string }) {
    return (
      <div className="grid md:grid-cols-2 gap-4">
        {items.map(d => (
          <Link
            key={d.id}
            href={`/funding/dossier/${d.id}`}
            className="block rounded-xl border border-white/10 bg-white/3 hover:bg-white/5 transition-colors p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-white truncate pr-2">{d.title ?? '—'}</span>
              {incomplete(d.completion_pct) && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 shrink-0">
                  {t('dashboard.to_complete')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-white/50 mb-2">
              {d.country_iso && <span>{d.country_iso}</span>}
              {d.amount_eur != null && <span className="text-[#C9A84C] font-semibold">{fmtEur(d.amount_eur)}</span>}
              {d.status && <span className="capitalize">{d.status}</span>}
            </div>
            <ProgressBar pct={d.completion_pct ?? 0} />
          </Link>
        ))}
      </div>
    )
  }
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <a href={href} className="rounded-xl border border-white/10 bg-white/3 p-4 hover:bg-white/5 transition-colors block">
      <div className="text-xs uppercase tracking-wider text-white/50 mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </a>
  )
}

function SectionHeader({ title, hint, cta }: { title: string; hint: string; cta: { href: string; label: string } }) {
  return (
    <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
      <div className="min-w-0">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="text-xs text-white/50 mt-0.5">{hint}</p>
      </div>
      <Link href={cta.href} className="text-xs text-[#C9A84C] hover:text-[#E8C97A] font-medium whitespace-nowrap">
        {cta.label} →
      </Link>
    </div>
  )
}

function EmptyState({ icon, title, desc, cta }: { icon: string; title: string; desc: string; cta: { href: string; label: string } }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/2 p-8 text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-sm font-semibold text-white mb-1">{title}</div>
      <p className="text-xs text-white/50 mb-4 max-w-sm mx-auto">{desc}</p>
      <Link href={cta.href} className="inline-block px-4 py-2 rounded-lg text-xs font-bold bg-[#C9A84C] text-[#07090F] hover:bg-[#E8C97A] transition-colors">
        {cta.label}
      </Link>
    </div>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  const safe = Math.max(0, Math.min(100, pct))
  return (
    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${safe}%`, background: safe === 100 ? '#34D399' : '#C9A84C' }}
      />
    </div>
  )
}
