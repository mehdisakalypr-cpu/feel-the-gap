'use client'

/**
 * /marketplace/subscriptions — formules abo + pay-per-act
 * Shaka 2026-04-21
 *
 * Prix baseline 100% pays développé × PPP pays acheteur.
 * Self-selection : multi-deals → abo (ROI dès 3 acts), single-shot → pay-per-act.
 */

import { useState, useEffect, useMemo } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { t } from '@/lib/i18n/t'

const C = {
  bg: '#07090F', card: '#0D1117', gold: '#C9A84C', text: '#E8E0D0',
  muted: '#9BA8B8', dim: '#5A6A7A', green: '#10B981', red: '#EF4444',
  blue: '#60A5FA', amber: '#F59E0B', purple: '#A78BFA',
}

type Tier = {
  key: 'starter' | 'growth' | 'pro' | 'unlimited'
  label: string
  icon: string
  matches: string
  baseline_eur: number
  color: string
  best_for: string
}

function buildTiers(): Tier[] {
  return [
    { key: 'starter',   label: t('marketplace.subscriptions.tiers.starter.label'),   icon: '🌱', matches: t('marketplace.subscriptions.tiers.starter.matches'),   baseline_eur: 99,   color: C.blue,   best_for: t('marketplace.subscriptions.tiers.starter.bestFor') },
    { key: 'growth',    label: t('marketplace.subscriptions.tiers.growth.label'),    icon: '🚀', matches: t('marketplace.subscriptions.tiers.growth.matches'),    baseline_eur: 299,  color: C.amber,  best_for: t('marketplace.subscriptions.tiers.growth.bestFor') },
    { key: 'pro',       label: t('marketplace.subscriptions.tiers.pro.label'),       icon: '💼', matches: t('marketplace.subscriptions.tiers.pro.matches'),       baseline_eur: 749,  color: C.gold,   best_for: t('marketplace.subscriptions.tiers.pro.bestFor') },
    { key: 'unlimited', label: t('marketplace.subscriptions.tiers.unlimited.label'), icon: '♾️', matches: t('marketplace.subscriptions.tiers.unlimited.matches'), baseline_eur: 1499, color: C.purple, best_for: t('marketplace.subscriptions.tiers.unlimited.bestFor') },
  ]
}

const PAY_PER_ACT = [
  { range: '€0 − €10k',      fee: 149 },
  { range: '€10k − €50k',    fee: 349 },
  { range: '€50k − €200k',   fee: 749 },
  { range: '€200k − €1M',    fee: 1499 },
  { range: '€1M+',           fee: 2999 },
]

export default function SubscriptionsPage() {
  const TIERS = useMemo(() => buildTiers(), [])
  const [multiplier, setMultiplier] = useState<number>(1.0)
  const [countryLabel, setCountryLabel] = useState<string>('🇫🇷 France (PPP 1.0)')
  const [checkoutErr, setCheckoutErr] = useState<string | null>(null)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)

  async function subscribe(tier: Tier['key']) {
    setCheckoutErr(null); setCheckingOut(tier)
    try {
      const r = await fetch('/api/marketplace/subscriptions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      const j = await r.json()
      if (r.status === 401 && j.redirect) { window.location.href = j.redirect; return }
      if (!r.ok) throw new Error(j.error || t('marketplace.subscriptions.errors.checkoutFailed'))
      if (j.url) window.location.href = j.url
    } catch (e) {
      setCheckoutErr((e as Error).message)
    } finally {
      setCheckingOut(null)
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const sb = createSupabaseBrowser()
        const { data: { user } } = await sb.auth.getUser()
        if (!user) return
        // Infer country from user profile if set, else fallback France
        const { data: profile } = await sb
          .from('profiles')
          .select('country')
          .eq('id', user.id)
          .maybeSingle()
        if (!profile?.country) return
        const { data: country } = await sb
          .from('countries')
          .select('id, name_fr, name, pricing_multiplier, flag')
          .eq('id', profile.country)
          .maybeSingle()
        if (country?.pricing_multiplier) {
          setMultiplier(Number(country.pricing_multiplier))
          setCountryLabel(`${country.flag ?? ''} ${country.name_fr ?? country.name} (PPP ${Number(country.pricing_multiplier).toFixed(2)})`)
        }
      } catch {}
    })()
  }, [])

  const adjusted = useMemo(() => TIERS.map(tier => ({
    ...tier,
    adjusted_eur: Math.round(tier.baseline_eur * multiplier),
  })), [multiplier, TIERS])

  const adjustedPayPerAct = useMemo(() => PAY_PER_ACT.map(p => ({
    ...p,
    adjusted_fee: Math.round(p.fee * multiplier),
  })), [multiplier])

  return (
    <div style={{ padding: 24, color: C.text, fontFamily: 'Inter, sans-serif', maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ marginBottom: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: C.gold, margin: 0 }}>
          {t('marketplace.subscriptions.title')}
        </h1>
        <p style={{ color: C.muted, fontSize: '.96rem', margin: '10px 0 0' }}>
          {t('marketplace.subscriptions.subtitle')}
          <br />
          <span style={{ color: C.dim, fontSize: '.8rem' }}>
            {t('marketplace.subscriptions.countryHint', { country: countryLabel })}
          </span>
        </p>
      </header>

      {checkoutErr && (
        <div style={{ padding: 12, background: `${C.red}15`, border: `1px solid ${C.red}44`, color: C.red, fontSize: '.78rem', marginBottom: 12, borderRadius: 4 }}>
          {checkoutErr}
        </div>
      )}

      {/* Abonnement tiers */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: C.gold, marginBottom: 14, borderLeft: `3px solid ${C.gold}`, paddingLeft: 10 }}>
          {t('marketplace.subscriptions.abo.sectionTitle')}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {adjusted.map(tier => {
            const saved = multiplier < 1 ? tier.baseline_eur - tier.adjusted_eur : 0
            return (
              <div key={tier.key} style={{
                padding: 20, background: C.card, borderRadius: 10,
                border: `2px solid ${tier.color}44`,
                position: 'relative' as const,
              }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>{tier.icon}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: tier.color }}>{tier.label}</div>
                <div style={{ fontSize: '.72rem', color: C.muted, marginTop: 2 }}>{tier.matches}</div>

                <div style={{ marginTop: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: tier.color }}>
                    €{tier.adjusted_eur}
                    <span style={{ fontSize: '.72rem', color: C.muted, fontWeight: 400 }}> {t('marketplace.subscriptions.abo.perMonth')}</span>
                  </div>
                  {multiplier < 1 && (
                    <div style={{ fontSize: '.66rem', color: C.dim, textDecoration: 'line-through' }}>
                      {t('marketplace.subscriptions.abo.baselineLabel', { amount: tier.baseline_eur })}
                    </div>
                  )}
                  {saved > 0 && (
                    <div style={{ fontSize: '.66rem', color: C.green, marginTop: 2 }}>
                      {t('marketplace.subscriptions.abo.savedLabel', { amount: saved })}
                    </div>
                  )}
                </div>

                <div style={{ fontSize: '.72rem', color: C.muted, fontStyle: 'italic', marginBottom: 14 }}>
                  {tier.best_for}
                </div>

                <button
                  onClick={() => subscribe(tier.key)}
                  disabled={checkingOut !== null}
                  style={{
                    width: '100%', padding: 10, background: tier.color, color: C.bg,
                    border: 'none', fontWeight: 700, fontSize: '.82rem',
                    cursor: checkingOut !== null ? 'wait' : 'pointer',
                    opacity: checkingOut && checkingOut !== tier.key ? 0.5 : 1,
                    fontFamily: 'inherit', borderRadius: 4,
                  }}
                >
                  {checkingOut === tier.key ? t('marketplace.subscriptions.abo.redirecting') : t('marketplace.subscriptions.abo.cta', { tier: tier.label })}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* Pay per act */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: C.gold, marginBottom: 14, borderLeft: `3px solid ${C.gold}`, paddingLeft: 10 }}>
          {t('marketplace.subscriptions.ppa.sectionTitle')}
        </h2>
        <p style={{ color: C.muted, fontSize: '.82rem', marginBottom: 14 }}>
          {(() => {
            const raw = t('marketplace.subscriptions.ppa.intro', { buyerStrong: '%%BUYER%%' })
            const [pre, post] = raw.split('%%BUYER%%')
            return <>{pre}<strong>{t('marketplace.subscriptions.ppa.buyerStrong')}</strong>{post}</>
          })()}
        </p>

        <div style={{ background: C.card, border: `1px solid ${C.gold}33`, borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.84rem' }}>
            <thead style={{ background: `${C.gold}08` }}>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left' as const, color: C.dim, textTransform: 'uppercase' as const, fontSize: '.66rem', letterSpacing: '.1em' }}>{t('marketplace.subscriptions.ppa.tableVolume')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' as const, color: C.dim, textTransform: 'uppercase' as const, fontSize: '.66rem', letterSpacing: '.1em' }}>{t('marketplace.subscriptions.ppa.tableFeeYou')}</th>
                {multiplier < 1 && (
                  <th style={{ padding: '12px 16px', textAlign: 'right' as const, color: C.dim, textTransform: 'uppercase' as const, fontSize: '.66rem', letterSpacing: '.1em' }}>{t('marketplace.subscriptions.ppa.tableBaseline')}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {adjustedPayPerAct.map(p => (
                <tr key={p.range} style={{ borderTop: `1px solid ${C.dim}22` }}>
                  <td style={{ padding: '14px 16px', fontWeight: 600 }}>{p.range}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' as const, fontWeight: 800, color: C.gold, fontSize: '1.05rem' }}>
                    €{p.adjusted_fee}
                  </td>
                  {multiplier < 1 && (
                    <td style={{ padding: '14px 16px', textAlign: 'right' as const, color: C.dim, textDecoration: 'line-through' }}>
                      €{p.fee}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12, fontSize: '.72rem', color: C.muted }}>
          {t('marketplace.subscriptions.ppa.footnote')}
        </div>
      </section>

      <section style={{ padding: 18, background: C.card, border: `1px dashed ${C.gold}33`, borderRadius: 8 }}>
        <div style={{ fontSize: '.9rem', fontWeight: 700, color: C.gold, marginBottom: 8 }}>{t('marketplace.subscriptions.compare.title')}</div>
        <div style={{ fontSize: '.82rem', color: C.muted, lineHeight: 1.6 }}>
          {(['ppa', 'starter', 'growth', 'pro', 'unlimited'] as const).map((k, idx) => {
            const strongKey = `marketplace.subscriptions.compare.${k}Strong`
            const raw = t(`marketplace.subscriptions.compare.${k}`, { strong: '%%S%%' })
            const [pre, post] = raw.split('%%S%%')
            return (
              <div key={k} style={{ marginTop: idx > 0 ? 4 : 0 }}>
                {pre}<strong style={{ color: C.text }}>{t(strongKey)}</strong>{post}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
