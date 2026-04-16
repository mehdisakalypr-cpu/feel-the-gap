'use client'

import Link from 'next/link'
import { useState } from 'react'
import Topbar from '@/components/Topbar'
import { PLAN_PRICE_EUR, PLAN_MONTHLY_GRANT, TOPUP_PACKS } from '@/lib/credits/costs'

export default function PricingPage() {
  const [mode, setMode] = useState<'subscriptions' | 'packs'>('subscriptions')
  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <Topbar />
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

        {mode === 'subscriptions' ? <Subscriptions /> : <Packs />}

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
    </div>
  )
}

function Subscriptions() {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      <PlanCard
        name="Free" price="€0" period="" credits={PLAN_MONTHLY_GRANT.free}
        tagline="Explore avant d'acheter"
        features={[
          { label: 'Map monde + fiche pays', yes: true },
          { label: 'Demo BP pour toutes les opportunités', yes: true },
          { label: 'Détail opportunité complet', yes: false },
          { label: 'Business plan IA', yes: false },
          { label: 'Training YouTube', yes: false },
          { label: 'Clients potentiels', yes: false },
        ]}
        ctaLabel="Commencer gratuitement" ctaHref="/auth/register"
      />
      <PlanCard
        name="Starter" price={`€${PLAN_PRICE_EUR.starter}`} period="/mois"
        credits={PLAN_MONTHLY_GRANT.starter} highlight
        tagline="Débloque tout le parcours"
        features={[
          { label: 'Tout du Free', yes: true },
          { label: '60 crédits/mois inclus', yes: true },
          { label: 'Détail opportunité (1 cr)', yes: true },
          { label: 'Business plan IA (10 cr = 6 BPs/mois)', yes: true },
          { label: 'Training YouTube — illimité', yes: true },
          { label: 'Proposer site e-commerce', yes: true },
          { label: 'Clients potentiels', yes: false },
          { label: 'Création site clé en main', yes: false },
        ]}
        ctaLabel="Passer Starter" ctaHref="/api/stripe/checkout?plan=starter"
      />
      <PlanCard
        name="Premium" price={`€${PLAN_PRICE_EUR.premium}`} period="/mois"
        credits={PLAN_MONTHLY_GRANT.premium}
        tagline="Parcours complet + ventes"
        features={[
          { label: 'Tout du Starter', yes: true },
          { label: '120 crédits/mois inclus', yes: true },
          { label: 'Liste clients potentiels (5 cr/contact)', yes: true },
          { label: 'Coordonnées + données aide ventes', yes: true },
          { label: 'Création site e-commerce clé en main', yes: true },
          { label: '1er site offert (économise 30 cr)', yes: true },
          { label: 'Support prioritaire', yes: true },
        ]}
        ctaLabel="Passer Premium" ctaHref="/api/stripe/checkout?plan=premium"
      />
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
  name, price, period, credits, tagline, features, ctaLabel, ctaHref, highlight,
}: {
  name: string; price: string; period: string; credits: number; tagline: string
  features: { label: string; yes: boolean }[]
  ctaLabel: string; ctaHref: string; highlight?: boolean
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
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-4xl font-bold">{price}</span>
        {period && <span className="text-sm text-white/50">{period}</span>}
      </div>
      <div className="text-sm text-emerald-400 mb-4">{credits} crédits{period ? ' /mois' : ''}</div>
      <p className="text-sm text-white/70 mb-5">{tagline}</p>
      <ul className="space-y-2 mb-6 flex-1">
        {features.map((f, i) => (
          <li key={i} className={`flex items-start gap-2 text-sm ${f.yes ? 'text-white/90' : 'text-white/30'}`}>
            <span>{f.yes ? '✓' : '—'}</span><span>{f.label}</span>
          </li>
        ))}
      </ul>
      <a href={ctaHref}
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
