'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { PLAN_PRICE_EUR, PLAN_MONTHLY_GRANT, TOPUP_PACKS, SUBSCRIPTION_DURATIONS, applyDurationDiscount, type DurationMonths, type PlanTier } from '@/lib/credits/costs'
import ContractGate, { type ContractGateAgreement } from '@/components/ContractGate'
import { createSupabaseBrowser } from '@/lib/supabase'
import { shouldShowUpgradeTo } from '@/lib/credits/tier-helpers'

type GeoInfo = {
  country: string
  countryName: string
  multiplier: number
  plans: {
    solo_producer?: { baseEUR: number; price: number; currency: string }
    starter:  { baseEUR: number; price: number; currency: string }
    strategy?: { baseEUR: number; price: number; currency: string }
    premium:  { baseEUR: number; price: number; currency: string }
    ultimate?: { baseEUR: number; price: number; currency: string }
  }
}

export default function PricingPage() {
  const [mode, setMode] = useState<'subscriptions' | 'packs'>('subscriptions')
  const [duration, setDuration] = useState<DurationMonths>(1)
  const [geo, setGeo] = useState<GeoInfo | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [userTier, setUserTier] = useState<PlanTier | null>(null)
  const [authResolved, setAuthResolved] = useState(false)
  const [gate, setGate] = useState<null | { agreement: ContractGateAgreement; next: string; email: string }>(null)

  // Engagement signal: viewing pricing → ExitFeedback becomes eligible.
  useEffect(() => {
    try { localStorage.setItem('ftg_engaged', '1') } catch { /* noop */ }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/geo')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data) setGeo(data as GeoInfo) })
      .catch(() => { /* silent — fallback to EU prices */ })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    // Capture authenticated email for ContractGate receipt. Anonymous users get
    // redirected to /auth/login by the checkout route, so the gate only opens
    // once we have an email.
    // Also fetch the current tier so we can hide CTAs for plans the user
    // already has (no "downgrade" CTAs — RÈGLE D'OR tier-helpers.ts).
    let cancelled = false
    const sb = createSupabaseBrowser()
    sb.auth.getUser().then(async ({ data }) => {
      if (cancelled) return
      const user = data.user
      if (!user) {
        setAuthResolved(true)
        return
      }
      if (user.email) setUserEmail(user.email)
      try {
        const { data: profile } = await sb
          .from('profiles')
          .select('tier')
          .eq('id', user.id)
          .single()
        if (cancelled) return
        const tier = (profile?.tier as PlanTier | undefined) ?? 'free'
        setUserTier(tier)
      } catch {
        if (!cancelled) setUserTier('free')
      } finally {
        if (!cancelled) setAuthResolved(true)
      }
    })
    return () => { cancelled = true }
  }, [])

  function openGate(e: React.MouseEvent<HTMLAnchorElement>, agreement: ContractGateAgreement, next: string) {
    if (!userEmail) return // let default <a> redirect to /auth/login via checkout route
    e.preventDefault()
    setGate({ agreement, next, email: userEmail })
  }

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <main className="max-w-6xl mx-auto px-4 py-12">
        <header className="text-center mb-10">
          <div className="text-xs uppercase tracking-[0.3em] text-emerald-400 mb-2">Pricing</div>
          <h1 className="text-4xl font-semibold mb-3">Débloque les opportunités qui te correspondent</h1>
          <p className="text-white/60 max-w-2xl mx-auto">
            Free : carte monde + demo BP pour toutes les opportunités.
            Starter : accès complet + 60 crédits/mois.
            Premium : clients potentiels + création site.
          </p>
        </header>

        <div className="flex justify-center mb-10">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
            <button
              onClick={() => setMode('subscriptions')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition ${
                mode === 'subscriptions' ? 'bg-emerald-500 text-black' : 'text-white/70'
              }`}
            >
              Abonnements mensuels
            </button>
            <button
              onClick={() => setMode('packs')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition ${
                mode === 'packs' ? 'bg-emerald-500 text-black' : 'text-white/70'
              }`}
            >
              Packs crédits (one-shot)
            </button>
          </div>
        </div>

        {geo && geo.multiplier !== 1 && (
          <div className="text-center mb-6 text-xs text-white/70">
            Price adjusted for {geo.countryName}{' '}
            <span className="text-white/40">
              (EU: €{geo.plans.starter.baseEUR}/€{geo.plans.premium.baseEUR} —
              your region: €{geo.plans.starter.price}/€{geo.plans.premium.price})
            </span>
          </div>
        )}

        {mode === 'subscriptions' && (
          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1 flex-wrap">
              {SUBSCRIPTION_DURATIONS.map(d => (
                <button
                  key={d.months}
                  onClick={() => setDuration(d.months as DurationMonths)}
                  className={`px-4 py-2 rounded-full text-xs font-medium transition ${
                    duration === d.months ? 'bg-[#C9A84C] text-black' : 'text-white/70 hover:text-white'
                  }`}
                >{d.label}</button>
              ))}
            </div>
          </div>
        )}

        {mode === 'subscriptions' ? <Subscriptions geo={geo} duration={duration} onUpgradeClick={openGate} userTier={userTier} authResolved={authResolved} /> : <Packs />}

        <section className="mt-16 grid md:grid-cols-2 gap-6">
          <InfoCard
            title="Crédits inclus vs crédits à l'acte"
            items={[
              'Starter = €0.48 / crédit · 6 BPs/mois inclus',
              'Premium = €0.66 / crédit · 12 BPs/mois inclus + clients',
              'Pack +50 = €0.90 / crédit (le plus cher hors sub)',
              'Sub toujours moins cher à partir de 2 actions lourdes',
            ]}
          />
          <InfoCard
            title="Ce qui consomme des crédits"
            items={[
              'Voir détail opportunité : 1 crédit',
              'Générer business plan PDF : 10 crédits',
              'Révéler contact client : 5 crédits',
              'Création site clé en main : 30 crédits (1er offert Premium)',
              'Outreach via FTG : 1 crédit / contact',
            ]}
          />
        </section>

        <footer className="text-center mt-12 text-sm text-white/50">
          Besoin d'un plan Enterprise / agency ? <Link href="/contact" className="underline text-white/80">Parle-nous.</Link>
        </footer>
      </main>

      {gate && (
        <ContractGate
          agreement={gate.agreement}
          email={gate.email}
          purchaseIntent={{ flow: 'upgrade_paid', plan: gate.agreement, next: gate.next }}
          onAccepted={() => {
            // Signature persisted server-side — proceed to Stripe hosted checkout.
            setGate(null)
            window.location.href = gate.next
          }}
          onCancel={() => setGate(null)}
        />
      )}
    </div>
  )
}

function Subscriptions({
  geo,
  duration,
  onUpgradeClick,
  userTier,
  authResolved,
}: {
  geo: GeoInfo | null
  duration: DurationMonths
  onUpgradeClick: (e: React.MouseEvent<HTMLAnchorElement>, agreement: ContractGateAgreement, next: string) => void
  userTier: PlanTier | null
  authResolved: boolean
}) {
  // Anonymous (or auth still resolving): show every plan, including Free.
  // Authenticated: hide Free + every tier <= current (no downgrade CTAs).
  const isAnonymous = authResolved && userTier === null
  const showFree = !authResolved || isAnonymous
  const showPlan = (target: PlanTier) =>
    !authResolved || isAnonymous || (userTier !== null && shouldShowUpgradeTo(userTier, target))
  const soloMonthly     = geo?.plans.solo_producer?.price ?? PLAN_PRICE_EUR.solo_producer
  const starterMonthly  = geo?.plans.starter.price  ?? PLAN_PRICE_EUR.starter
  const strategyMonthly = geo?.plans.strategy?.price ?? PLAN_PRICE_EUR.strategy
  const premiumMonthly  = geo?.plans.premium.price  ?? PLAN_PRICE_EUR.premium
  const ultimateMonthly = geo?.plans.ultimate?.price ?? PLAN_PRICE_EUR.ultimate

  const solo     = applyDurationDiscount(soloMonthly, duration)
  const starter  = applyDurationDiscount(starterMonthly, duration)
  const strategy = applyDurationDiscount(strategyMonthly, duration)
  const premium  = applyDurationDiscount(premiumMonthly, duration)
  const ultimate = applyDurationDiscount(ultimateMonthly, duration)

  const soloPrice     = solo.monthlyEffective
  const starterPrice  = starter.monthlyEffective
  const strategyPrice = strategy.monthlyEffective
  const premiumPrice  = premium.monthlyEffective
  const ultimatePrice = ultimate.monthlyEffective

  const soloBase      = soloMonthly
  const starterBase   = starterMonthly
  const strategyBase  = strategyMonthly
  const premiumBase   = premiumMonthly
  const ultimateBase  = ultimateMonthly

  const geoSuffix = geo && geo.multiplier !== 1 ? `&cc=${geo.country}` : ''
  const durSuffix = duration === 1 ? '' : `&duration=${duration}`
  const soloHref     = `/api/stripe/checkout?plan=solo_producer${geoSuffix}${durSuffix}`
  const starterHref  = `/api/stripe/checkout?plan=starter${geoSuffix}${durSuffix}`
  const strategyHref = `/api/stripe/checkout?plan=strategy${geoSuffix}${durSuffix}`
  const premiumHref  = `/api/stripe/checkout?plan=premium${geoSuffix}${durSuffix}`
  const ultimateHref = `/api/stripe/checkout?plan=ultimate${geoSuffix}${durSuffix}`

  const savingsNote = (savings: number) => duration === 1
    ? null
    : `Économie ${savings.toFixed(0)}€ sur ${duration} mois`
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
      {showFree && (
      <PlanCard
        name="Free" price="€0" period="" credits={PLAN_MONTHLY_GRANT.free}
        tagline="Explore avant d'acheter"
        features={[
          { label: 'Map monde + fiche pays', yes: true },
          { label: 'Demo BP pour toutes les opportunités', yes: true },
          { label: 'Détail opportunité complet', yes: false },
          { label: 'Business plan IA', yes: false },
          { label: 'Fill the Gap', yes: false },
        ]}
        ctaLabel="Commencer gratuitement" ctaHref="/auth/register"
      />
      )}
      {showPlan('solo_producer') && (
      <PlanCard
        name="Solo Producer" price={`€${soloPrice}`}
        basePrice={duration > 1 ? `€${soloBase}` : (soloPrice !== soloBase ? `€${soloBase}` : undefined)}
        period="/mois"
        savings={savingsNote(solo.savingsVsMonthly)}
        credits={PLAN_MONTHLY_GRANT.solo_producer}
        tagline="Cultiver local, vendre local"
        features={[
          { label: 'Map monde + fiche pays', yes: true },
          { label: `${PLAN_MONTHLY_GRANT.solo_producer} crédits IA/mois inclus`, yes: true },
          { label: '1 pays × 1 opportunité', yes: true },
          { label: 'Business plan IA complet', yes: true },
          { label: 'Training YouTube illimité', yes: true },
          { label: 'Boutique intégrée (bientôt)', yes: true },
          { label: 'Fill the Gap', yes: false },
        ]}
        ctaLabel="Démarrer à €19.99/mo" ctaHref={soloHref}
        onCtaClick={e => onUpgradeClick(e, 'data', soloHref)}
      />
      )}
      {showPlan('starter') && (
      <PlanCard
        name="Data" price={`€${starterPrice}`}
        basePrice={duration > 1 ? `€${starterBase}` : (starterPrice !== starterBase ? `€${starterBase}` : undefined)}
        period="/mois"
        savings={savingsNote(starter.savingsVsMonthly)}
        credits={PLAN_MONTHLY_GRANT.starter}
        tagline="Tout du parcours"
        features={[
          { label: 'Tout du Free', yes: true },
          { label: `${PLAN_MONTHLY_GRANT.starter} crédits IA/mois`, yes: true },
          { label: 'Détail opportunité', yes: true },
          { label: 'Business plan IA', yes: true },
          { label: 'Training YouTube', yes: true },
          { label: 'Fill the Gap', yes: false },
        ]}
        ctaLabel="Passer Data" ctaHref={starterHref}
        onCtaClick={e => onUpgradeClick(e, 'data', starterHref)}
      />
      )}
      {showPlan('strategy') && (
      <PlanCard
        name="Strategy" price={`€${strategyPrice}`}
        basePrice={duration > 1 ? `€${strategyBase}` : (strategyPrice !== strategyBase ? `€${strategyBase}` : undefined)}
        period="/mois"
        savings={savingsNote(strategy.savingsVsMonthly)}
        credits={PLAN_MONTHLY_GRANT.strategy}
        tagline="Méthode + 1 supplier + 1 client"
        features={[
          { label: 'Tout du Data', yes: true },
          { label: `${PLAN_MONTHLY_GRANT.strategy} crédits IA/mois`, yes: true },
          { label: 'Méthode de fabrication dominante', yes: true },
          { label: '1 supplier clé', yes: true },
          { label: '1 client n°1 du pays', yes: true },
          { label: 'Fill the Gap', yes: false },
        ]}
        ctaLabel="Passer Strategy" ctaHref={strategyHref}
        onCtaClick={e => onUpgradeClick(e, 'premium', strategyHref)}
      />
      )}
      {showPlan('premium') && (
      <PlanCard
        name="Premium" price={`€${premiumPrice}`}
        basePrice={duration > 1 ? `€${premiumBase}` : (premiumPrice !== premiumBase ? `€${premiumBase}` : undefined)}
        period="/mois"
        savings={savingsNote(premium.savingsVsMonthly)}
        credits={PLAN_MONTHLY_GRANT.premium} highlight
        tagline="Bench complet + 5/5"
        features={[
          { label: 'Tout du Strategy', yes: true },
          { label: `${PLAN_MONTHLY_GRANT.premium} crédits IA/mois`, yes: true },
          { label: 'Bench complet des méthodes', yes: true },
          { label: '5 suppliers + 5 clients', yes: true },
          { label: '150 opps Fill the Gap/mois', yes: true },
          { label: 'Site e-commerce clé en main', yes: true },
        ]}
        ctaLabel="Passer Premium" ctaHref={premiumHref}
        onCtaClick={e => onUpgradeClick(e, 'premium', premiumHref)}
      />
      )}
      {showPlan('ultimate') && (
      <PlanCard
        name="Ultimate" price={`€${ultimatePrice}`}
        basePrice={duration > 1 ? `€${ultimateBase}` : (ultimatePrice !== ultimateBase ? `€${ultimateBase}` : undefined)}
        period="/mois"
        savings={savingsNote(ultimate.savingsVsMonthly)}
        credits={PLAN_MONTHLY_GRANT.ultimate}
        tagline="Tout illimité + AI engine"
        features={[
          { label: 'Tout du Premium', yes: true },
          { label: `${PLAN_MONTHLY_GRANT.ultimate} crédits IA/mois`, yes: true },
          { label: 'Méthodes + suppliers + clients illimités', yes: true },
          { label: '250 opps Fill the Gap/mois', yes: true },
          { label: 'AI engine cascade ×3', yes: true },
          { label: 'Support VIP dédié', yes: true },
        ]}
        ctaLabel="Passer Ultimate" ctaHref={ultimateHref}
        onCtaClick={e => onUpgradeClick(e, 'premium', ultimateHref)}
      />
      )}
    </div>
  )
}

function Packs() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-6 text-sm text-white/60">
        Packs one-shot, valables 12 mois, s'ajoutent à ton solde — idéal si tu ne veux qu'une
        seule opportunité.
      </div>
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
        {TOPUP_PACKS.map((p) => (
          <a
            key={p.size}
            href={`/api/stripe/checkout?pack=${p.size}`}
            className={`relative rounded-xl border p-5 transition hover:bg-white/5 ${
              p.size === 50 ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 bg-white/3'
            }`}
          >
            {p.size === 50 && (
              <span className="absolute -top-2 right-3 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-black font-semibold">
                Meilleur prix
              </span>
            )}
            <div className="text-3xl font-bold">+{p.size}</div>
            <div className="text-xs text-white/50 uppercase tracking-wider mb-3">crédits</div>
            <div className="text-2xl font-semibold mb-1">€{p.price}</div>
            <div className="text-xs text-white/50">€{p.unit.toFixed(2)}/crédit</div>
          </a>
        ))}
      </div>
    </div>
  )
}

function PlanCard({
  name, price, basePrice, period, credits, tagline, features, ctaLabel, ctaHref, highlight, onCtaClick, savings,
}: {
  name: string; price: string; basePrice?: string; period: string; credits: number; tagline: string
  features: { label: string; yes: boolean }[]
  ctaLabel: string; ctaHref: string; highlight?: boolean
  savings?: string | null
  onCtaClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}) {
  return (
    <div className={`relative rounded-xl border p-6 flex flex-col ${
      highlight ? 'border-emerald-500/50 bg-emerald-500/5 shadow-lg shadow-emerald-500/10' : 'border-white/10 bg-white/3'
    }`}>
      {highlight && (
        <span className="absolute -top-3 left-6 text-[10px] px-2 py-1 rounded-full bg-emerald-500 text-black font-semibold uppercase tracking-wider">
          Le plus choisi
        </span>
      )}
      <div className="text-sm uppercase tracking-widest text-white/50 mb-1">{name}</div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-4xl font-bold">{price}</span>
        {basePrice && (
          <span className="text-sm text-white/40 line-through">{basePrice}</span>
        )}
        {period && <span className="text-sm text-white/50">{period}</span>}
      </div>
      <div className="text-sm text-emerald-400 mb-1">{credits} crédits{period ? ' /mois' : ''}</div>
      {savings && <div className="text-xs text-[#C9A84C] mb-3">{savings}</div>}
      <p className="text-sm text-white/70 mb-5">{tagline}</p>
      <ul className="space-y-2 mb-6 flex-1">
        {features.map((f, i) => (
          <li key={i} className={`flex items-start gap-2 text-sm ${f.yes ? 'text-white/90' : 'text-white/30'}`}>
            <span>{f.yes ? '✓' : '—'}</span><span>{f.label}</span>
          </li>
        ))}
      </ul>
      <a href={ctaHref}
        onClick={onCtaClick}
        className={`block w-full text-center py-3 rounded font-medium transition ${
          highlight ? 'bg-emerald-500 hover:bg-emerald-400 text-black' : 'border border-white/20 hover:bg-white/5 text-white'
        }`}>
        {ctaLabel}
      </a>
    </div>
  )
}

function InfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/3 p-6">
      <h3 className="font-semibold mb-3">{title}</h3>
      <ul className="space-y-2 text-sm text-white/70">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-2"><span className="text-emerald-400">›</span><span>{t}</span></li>
        ))}
      </ul>
    </div>
  )
}
