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

const TIERS: Tier[] = [
  { key: 'starter',   label: 'Starter',   icon: '🌱', matches: '3 matches /mo',   baseline_eur: 99,   color: C.blue,   best_for: 'Premier deals, découverte' },
  { key: 'growth',    label: 'Growth',    icon: '🚀', matches: '10 matches /mo',  baseline_eur: 299,  color: C.amber,  best_for: 'Scaling B2B' },
  { key: 'pro',       label: 'Pro',       icon: '💼', matches: '25 matches /mo',  baseline_eur: 749,  color: C.gold,   best_for: 'Trader actif' },
  { key: 'unlimited', label: 'Unlimited', icon: '♾️', matches: '∞ matches',       baseline_eur: 1499, color: C.purple, best_for: 'Marketplace intensif' },
]

const PAY_PER_ACT = [
  { range: '€0 − €10k',      fee: 149 },
  { range: '€10k − €50k',    fee: 349 },
  { range: '€50k − €200k',   fee: 749 },
  { range: '€200k − €1M',    fee: 1499 },
  { range: '€1M+',           fee: 2999 },
]

export default function SubscriptionsPage() {
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
      if (!r.ok) throw new Error(j.error || 'Checkout failed')
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

  const adjusted = useMemo(() => TIERS.map(t => ({
    ...t,
    adjusted_eur: Math.round(t.baseline_eur * multiplier),
  })), [multiplier])

  const adjustedPayPerAct = useMemo(() => PAY_PER_ACT.map(p => ({
    ...p,
    adjusted_fee: Math.round(p.fee * multiplier),
  })), [multiplier])

  return (
    <div style={{ padding: 24, color: C.text, fontFamily: 'Inter, sans-serif', maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ marginBottom: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: C.gold, margin: 0 }}>
          💎 Marketplace — deux formules au choix
        </h1>
        <p style={{ color: C.muted, fontSize: '.96rem', margin: '10px 0 0' }}>
          Abonnement pour les traders récurrents · pay-per-act pour les deals ponctuels.
          <br />
          <span style={{ color: C.dim, fontSize: '.8rem' }}>
            Prix adaptés au pouvoir d&apos;achat de ton pays : {countryLabel}
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
          🔁 Abonnement mensuel
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {adjusted.map(t => {
            const saved = multiplier < 1 ? t.baseline_eur - t.adjusted_eur : 0
            return (
              <div key={t.key} style={{
                padding: 20, background: C.card, borderRadius: 10,
                border: `2px solid ${t.color}44`,
                position: 'relative' as const,
              }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>{t.icon}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: t.color }}>{t.label}</div>
                <div style={{ fontSize: '.72rem', color: C.muted, marginTop: 2 }}>{t.matches}</div>

                <div style={{ marginTop: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: t.color }}>
                    €{t.adjusted_eur}
                    <span style={{ fontSize: '.72rem', color: C.muted, fontWeight: 400 }}> /mo</span>
                  </div>
                  {multiplier < 1 && (
                    <div style={{ fontSize: '.66rem', color: C.dim, textDecoration: 'line-through' }}>
                      €{t.baseline_eur} /mo baseline
                    </div>
                  )}
                  {saved > 0 && (
                    <div style={{ fontSize: '.66rem', color: C.green, marginTop: 2 }}>
                      −€{saved} pays en dev
                    </div>
                  )}
                </div>

                <div style={{ fontSize: '.72rem', color: C.muted, fontStyle: 'italic', marginBottom: 14 }}>
                  {t.best_for}
                </div>

                <button
                  onClick={() => subscribe(t.key)}
                  disabled={checkingOut !== null}
                  style={{
                    width: '100%', padding: 10, background: t.color, color: C.bg,
                    border: 'none', fontWeight: 700, fontSize: '.82rem',
                    cursor: checkingOut !== null ? 'wait' : 'pointer',
                    opacity: checkingOut && checkingOut !== t.key ? 0.5 : 1,
                    fontFamily: 'inherit', borderRadius: 4,
                  }}
                >
                  {checkingOut === t.key ? 'Redirection Stripe…' : `Choisir ${t.label}`}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* Pay per act */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: C.gold, marginBottom: 14, borderLeft: `3px solid ${C.gold}`, paddingLeft: 10 }}>
          💳 Pay-per-act (sans engagement)
        </h2>
        <p style={{ color: C.muted, fontSize: '.82rem', marginBottom: 14 }}>
          Idéal pour un seul deal ponctuel. Facturé à l&apos;acceptation mutuelle du match (les 2 parties confirment). Ensuite la commission est payée par l&apos;<strong>acheteur</strong> sur Stripe.
        </p>

        <div style={{ background: C.card, border: `1px solid ${C.gold}33`, borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.84rem' }}>
            <thead style={{ background: `${C.gold}08` }}>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left' as const, color: C.dim, textTransform: 'uppercase' as const, fontSize: '.66rem', letterSpacing: '.1em' }}>Volume transaction</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' as const, color: C.dim, textTransform: 'uppercase' as const, fontSize: '.66rem', letterSpacing: '.1em' }}>Frais (ton pays)</th>
                {multiplier < 1 && (
                  <th style={{ padding: '12px 16px', textAlign: 'right' as const, color: C.dim, textTransform: 'uppercase' as const, fontSize: '.66rem', letterSpacing: '.1em' }}>Baseline</th>
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
          💡 Seuils vérifiés par fourchette déclarée (pas de sous-déclaration tolérée). Si fraude détectée → bannissement + clawback.
        </div>
      </section>

      <section style={{ padding: 18, background: C.card, border: `1px dashed ${C.gold}33`, borderRadius: 8 }}>
        <div style={{ fontSize: '.9rem', fontWeight: 700, color: C.gold, marginBottom: 8 }}>🎯 Lequel choisir ?</div>
        <div style={{ fontSize: '.82rem', color: C.muted, lineHeight: 1.6 }}>
          <div><strong style={{ color: C.text }}>Pay-per-act</strong> si tu prévois 1-2 deals par an → paie seulement quand tu matches.</div>
          <div style={{ marginTop: 4 }}><strong style={{ color: C.text }}>Starter (€99/mo)</strong> si tu as 2-3 deals /mois → break-even dès le 1er deal Tier 2 (€499).</div>
          <div style={{ marginTop: 4 }}><strong style={{ color: C.text }}>Growth (€299/mo)</strong> si tu as 5-10 deals /mois → break-even dès le 1er deal Tier 3 (€999).</div>
          <div style={{ marginTop: 4 }}><strong style={{ color: C.text }}>Pro (€749/mo)</strong> pour les traders multi-produits actifs.</div>
          <div style={{ marginTop: 4 }}><strong style={{ color: C.text }}>Unlimited (€1 499/mo)</strong> pour les trading desks / marketplaces internes.</div>
        </div>
      </section>
    </div>
  )
}
