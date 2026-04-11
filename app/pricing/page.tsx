'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Topbar from '@/components/Topbar'
import { createSupabaseBrowser } from '@/lib/supabase'

const STRIPE_PRICES = {
  basic:    process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC    ?? '',
  standard: process.env.NEXT_PUBLIC_STRIPE_PRICE_STANDARD ?? '',
  premium:  process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM  ?? '',
}

const PLANS = [
  {
    id: 'free',
    name: 'Explorer',
    price: 0,
    period: null,
    badge: null,
    description: 'Explorez la carte mondiale et découvrez les flux commerciaux.',
    color: '#6B7280',
    features: [
      'Carte mondiale interactive',
      'Vue d\'ensemble des balances commerciales',
      'Top catégorie d\'import par pays',
      'Score d\'opportunité indicatif',
      '1 fiche pays gratuite / mois',
    ],
    cta: 'Commencer gratuitement',
    href: '/auth/register',
    priceId: null,
    popular: false,
  },
  {
    id: 'basic',
    name: 'Data',
    price: 29,
    period: 'mois',
    badge: null,
    description: 'Abonnement aux données — accédez aux opportunités et sauvegardez vos analyses.',
    color: '#60A5FA',
    features: [
      'Tout Explorer',
      'Sauvegarde des recherches avec filtres',
      'Opportunités matérialisées sur la carte (pays par pays)',
      'Fiche opportunité par pays — volume d\'affaires potentiel',
      'Historique de recherches illimité',
      'Export données CSV',
      'Alertes email nouvelles opportunités',
    ],
    cta: 'Démarrer Data',
    href: '/auth/register?plan=basic',
    priceId: STRIPE_PRICES.basic,
    popular: false,
  },
  {
    id: 'standard',
    name: 'Strategy',
    price: 99,
    period: 'mois',
    badge: 'POPULAIRE',
    description: 'Planification IA — business plan, feuille de route et advisor à la demande.',
    color: '#C9A84C',
    features: [
      'Tout Data',
      'Génération de business plans IA (dépenses, actions, ROI)',
      'AI Advisor — cahier des charges & rapport d\'actions concrètes',
      'Opportunity Farming — scanner de produit',
      'Crédits IA à la consommation (rechargeables)',
      'Compteur de crédits en temps réel',
      'Appel d\'onboarding 1-on-1',
    ],
    cta: 'Démarrer Strategy',
    href: '/auth/register?plan=standard',
    priceId: STRIPE_PRICES.standard,
    popular: true,
    note: 'L\'AI Advisor est facturé à l\'usage via un système de crédits internes. Recharge à partir de 10 €.',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 149,
    period: 'mois',
    badge: 'NOUVEAU',
    description: 'Réseau d\'influence IA — distribuez via des audiences qualifiées.',
    color: '#A78BFA',
    features: [
      'Tout Strategy',
      'Accès réseau influenceurs (audiences localisées, niches, reach)',
      'Matching influenceur ↔ produit par géo et catégorie',
      'AI Advisor prospecte les influenceurs pour votre produit',
      'Dashboard performance affiliation (clics, conversions, CA)',
      'Carte des ventes par audience géographique influenceur',
    ],
    cta: 'Démarrer Premium',
    href: '/auth/register?plan=premium',
    priceId: STRIPE_PRICES.premium,
    popular: false,
    note: 'L\'AI Advisor prospection consomme des crédits IA (inclus dans le plan, rechargeables).',
  },
]

const CREDIT_PACKS = [
  { label: '10 €', amount: 10 },
  { label: '20 €', amount: 20 },
  { label: '50 €', amount: 50 },
  { label: '75 €', amount: 75 },
  { label: '100 €', amount: 100 },
]

interface GeoTier {
  country: string | null
  tier: string
  multiplier: number
  currency: string
  symbol: string
}

export default function PricingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [userTier, setUserTier] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null)
  const [geo, setGeo] = useState<GeoTier>({ country: null, tier: 'tier1_premium', multiplier: 1, currency: 'EUR', symbol: '\u20ac' })

  useEffect(() => {
    const sb = createSupabaseBrowser()
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setCurrentUser({ id: data.user.id, email: data.user.email ?? '' })
      const { data: profile } = await sb.from('profiles').select('tier').eq('id', data.user.id).single()
      setUserTier(profile?.tier ?? 'free')
    })
    // Detect geo-pricing tier
    fetch('/api/geo').then(r => r.json()).then(setGeo).catch(() => {})
  }, [])

  async function handleSubscribe(plan: typeof PLANS[0]) {
    if (!plan.priceId) {
      router.push(plan.href)
      return
    }
    setLoading(plan.id)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId:    plan.priceId,
          successUrl: `${location.origin}/account?upgraded=1`,
          cancelUrl:  `${location.origin}/pricing`,
          userId:     currentUser?.id,
          userEmail:  currentUser?.email,
          planLabel:  plan.name,
        }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {
      router.push(plan.href)
    }
    setLoading(null)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#07090F]">
      <Topbar />
      <main className="flex-1 px-6 py-16 max-w-6xl mx-auto w-full">

        {/* PPP discount banner */}
        {geo.multiplier < 1 && (
          <div className="mb-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-6 py-4 flex items-center gap-3">
            <span className="text-2xl">🌍</span>
            <div>
              <p className="text-sm font-semibold text-emerald-400">
                Prix ajustés pour votre marché ({geo.country})
              </p>
              <p className="text-xs text-gray-400">
                Nous appliquons un tarif adapté au pouvoir d'achat local : -{Math.round((1 - geo.multiplier) * 100)}% sur tous les plans.
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">
            Tarifs simples et transparents
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            De la découverte gratuite au business plan IA complet. Passez au niveau supérieur quand vous êtes prêt.
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 mb-16">
          {PLANS.map(plan => {
            const isCurrentPlan = userTier === plan.id
            return (
            <div key={plan.id} className={`relative flex flex-col rounded-2xl border p-6 ${
              isCurrentPlan
                ? 'border-[#C9A84C] ring-2 ring-[#C9A84C]/30 bg-gradient-to-b from-[#C9A84C]/8 to-transparent'
                : plan.popular
                ? 'border-[#C9A84C] bg-gradient-to-b from-[#C9A84C]/5 to-transparent'
                : 'border-white/10 bg-[#0D1117]'
            }`}>
              {isCurrentPlan && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                  <span className="bg-[#C9A84C] text-[#07090F] text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap flex items-center gap-1">
                    <svg width="9" height="9" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                    Plan actuel
                  </span>
                </div>
              )}
              {!isCurrentPlan && plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-[#C9A84C] text-[#07090F] text-[10px] font-bold px-3 py-1 rounded-full">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-5">
                <div className="w-8 h-8 rounded-lg mb-3 flex items-center justify-center"
                  style={{ background: plan.color + '22' }}>
                  <div className="w-3 h-3 rounded-full" style={{ background: plan.color }} />
                </div>
                <h2 className="text-lg font-semibold text-white">{plan.name}</h2>
                <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
              </div>

              <div className="mb-6">
                {plan.price === null ? (
                  <span className="text-2xl font-bold text-white">Sur mesure</span>
                ) : plan.price === 0 ? (
                  <span className="text-2xl font-bold text-white">Gratuit</span>
                ) : (
                  <div>
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-bold text-white">
                        {Math.round(plan.price * geo.multiplier)} {geo.symbol}
                      </span>
                      <span className="text-gray-500 text-sm pb-1">/{plan.period}</span>
                    </div>
                    {geo.multiplier < 1 && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs text-gray-600 line-through">{plan.price} €</span>
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                          -{Math.round((1 - geo.multiplier) * 100)}% PPP
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <ul className="space-y-2 flex-1 mb-4">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                    <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 20 20"
                      fill="currentColor" style={{ color: plan.color }}>
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              {'note' in plan && plan.note && (
                <p className="text-[11px] text-[#C9A84C]/70 mb-4 border border-[#C9A84C]/20 rounded-lg px-3 py-2 bg-[#C9A84C]/5">
                  {plan.note}
                </p>
              )}

              {plan.id === 'free' ? (
                <Link href={plan.href}
                  className="w-full py-2.5 text-sm font-semibold text-center rounded-xl transition-colors block"
                  style={{ background: plan.color + '18', color: plan.color, border: `1px solid ${plan.color}33` }}>
                  {plan.cta}
                </Link>
              ) : (
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={loading === plan.id}
                  className="w-full py-2.5 text-sm font-semibold text-center rounded-xl transition-colors disabled:opacity-60"
                  style={plan.popular
                    ? { background: plan.color, color: '#07090F' }
                    : { background: plan.color + '18', color: plan.color, border: `1px solid ${plan.color}33` }}>
                  {loading === plan.id ? 'Redirection…' : plan.cta}
                </button>
              )}
            </div>
          )})}
        </div>

        {/* Credits section */}
        <div className="border border-[#C9A84C]/20 rounded-2xl bg-[#0D1117] p-8 mb-10">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/10 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Crédits AI Advisor</h2>
              <p className="text-sm text-gray-400 max-w-2xl">
                L'AI Advisor (génération de business plans, cahiers des charges, rapports d'actions) consomme des tokens IA.
                Chaque session est facturée à l'usage via un compteur de crédits interne. Les crédits sont rechargeables à tout moment.
                Dès que votre solde atteint <span className="text-white font-medium">1 €</span>, une invitation à recharger s'affiche automatiquement.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {CREDIT_PACKS.map(pack => (
              <div key={pack.amount}
                className="px-5 py-3 rounded-xl border border-[#C9A84C]/30 bg-[#C9A84C]/5 text-[#C9A84C] font-semibold text-sm cursor-default">
                + {pack.label} de crédits
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-4">
            Les recharges sont disponibles dans votre espace compte. Inclus dans le plan Strategy.
          </p>
        </div>

        {/* Access control note */}
        <div className="border border-white/5 rounded-xl bg-[#0D1117] px-6 py-5 mb-8">
          <h3 className="text-sm font-semibold text-white mb-2">Accès et abonnement</h3>
          <ul className="text-sm text-gray-500 space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-red-400 shrink-0">•</span>
              En cas de non-renouvellement ou de paiement refusé, l'historique des recherches et les fiches opportunités sont masqués — ils se débloquent dès la régularisation du paiement.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 shrink-0">•</span>
              La carte cesse d'afficher les opportunités et les plans d'action sont inaccessibles sans abonnement actif.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 shrink-0">•</span>
              Le paiement réactive immédiatement l'ensemble de vos données et fonctionnalités.
            </li>
          </ul>
        </div>

        <p className="text-center text-xs text-gray-600">
          Paiements sécurisés via Stripe. Annulation possible à tout moment.
        </p>
      </main>
    </div>
  )
}
