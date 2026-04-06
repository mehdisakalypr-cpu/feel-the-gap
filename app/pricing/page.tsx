'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Topbar from '@/components/Topbar'

// Stripe price IDs — will be set when live keys arrive end of April
const STRIPE_PRICES = {
  basic: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC ?? '',
  pro:   process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO   ?? '',
}

const PLANS = [
  {
    id: 'free',
    name: 'Explorer',
    price: 0,
    period: null,
    description: 'Discover global trade gaps at a glance.',
    color: '#6B7280',
    features: [
      'World map — all countries',
      'Trade balance overview',
      'Top import category per country',
      'Opportunity score indicator',
      '1 free country report/month',
    ],
    cta: 'Start for free',
    href: '/auth/register',
    priceId: null,
  },
  {
    id: 'basic',
    name: 'Analyst',
    price: 29,
    period: 'month',
    description: 'Full data access for market researchers.',
    color: '#60A5FA',
    features: [
      'Everything in Explorer',
      'Full trade flow data (all years)',
      'Unlimited country reports',
      'Top 10 opportunities per country',
      'Export data to CSV',
      'Email alerts on new opportunities',
    ],
    cta: 'Start Analyst plan',
    href: '/auth/register?plan=basic',
    priceId: STRIPE_PRICES.basic,
    popular: false,
  },
  {
    id: 'pro',
    name: 'Strategist',
    price: 99,
    period: 'month',
    description: 'AI-powered business plans & full analysis.',
    color: '#C9A84C',
    features: [
      'Everything in Analyst',
      'Complete business plans (trade & production)',
      'Machinery & supplier recommendations',
      'Capex/Opex/ROI models',
      'AI advisor — unlimited chat',
      'Opportunity Farming — product scanner',
      '1-on-1 onboarding call',
    ],
    cta: 'Start Strategist plan',
    href: '/auth/register?plan=pro',
    priceId: STRIPE_PRICES.pro,
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    period: null,
    description: 'Custom research & white-label solutions.',
    color: '#A78BFA',
    features: [
      'Everything in Strategist',
      'Custom country/sector research',
      'White-label reports',
      'API access',
      'Dedicated analyst',
      'SLA & custom contracts',
    ],
    cta: 'Contact us',
    href: 'mailto:hello@feelthegap.com',
    priceId: null,
  },
]

export default function PricingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleSubscribe(plan: typeof PLANS[0]) {
    if (!plan.priceId) {
      // Stripe not live yet — redirect to register
      router.push(plan.href)
      return
    }
    setLoading(plan.id)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.priceId,
          successUrl: `${location.origin}/account?upgraded=1`,
          cancelUrl: `${location.origin}/pricing`,
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
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">
            Simple, transparent pricing
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            From free market exploration to full AI-powered business plans. Scale as you grow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {PLANS.map(plan => (
            <div key={plan.id} className={`relative flex flex-col rounded-2xl border p-6 ${
              plan.popular ? 'border-[#C9A84C] bg-gradient-to-b from-[#C9A84C]/5 to-transparent' : 'border-white/10 bg-[#0D1117]'
            }`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-[#C9A84C] text-[#07090F] text-[10px] font-bold px-3 py-1 rounded-full">MOST POPULAR</span>
                </div>
              )}
              <div className="mb-5">
                <div className="w-8 h-8 rounded-lg mb-3 flex items-center justify-center" style={{ background: plan.color + '22' }}>
                  <div className="w-3 h-3 rounded-full" style={{ background: plan.color }} />
                </div>
                <h2 className="text-lg font-semibold text-white">{plan.name}</h2>
                <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
              </div>
              <div className="mb-6">
                {plan.price === null ? (
                  <span className="text-2xl font-bold text-white">Custom</span>
                ) : plan.price === 0 ? (
                  <span className="text-2xl font-bold text-white">Free</span>
                ) : (
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold text-white">€{plan.price}</span>
                    <span className="text-gray-500 text-sm pb-1">/{plan.period}</span>
                  </div>
                )}
              </div>
              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                    <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style={{ color: plan.color }}>
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              {plan.id === 'enterprise' ? (
                <a href={plan.href}
                  className="w-full py-2.5 text-sm font-semibold text-center rounded-xl transition-colors block"
                  style={{ background: plan.color + '18', color: plan.color, border: `1px solid ${plan.color}33` }}>
                  {plan.cta}
                </a>
              ) : plan.id === 'free' ? (
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
                  {loading === plan.id ? 'Redirecting…' : plan.cta}
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-600 mt-8">
          All plans include a 7-day free trial. No credit card required for Explorer.
          Stripe payments activate end of April 2026.
        </p>
      </main>
    </div>
  )
}
