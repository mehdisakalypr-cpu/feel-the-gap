'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import MarketplaceStateBanner from '@/components/MarketplaceStateBanner'

// Homepage /invest — destinée aux investisseurs en capital : business angels,
// fonds d'amorçage/Série A, family offices côté equity, corporate VC.
// Vocabulaire : thèse d'investissement, deal flow, sourcing, ticket, pre-money,
// post-money, dilution, cap table, traction, unit economics, runway, exit.

export default function InvestHomePage() {
  const [hasInvestorRole, setHasInvestorRole] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createSupabaseBrowser()
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setLoading(false); return }
      const { data: p } = await sb.from('profiles').select('roles').eq('id', data.user.id).single()
      const roles = (p?.roles ?? []) as string[]
      setHasInvestorRole(roles.includes('investisseur'))
      setLoading(false)
    })
  }, [])

  return (
    <div className="min-h-screen bg-[#07090F] text-white">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(ellipse at top, rgba(96,165,250,0.18), transparent 60%), radial-gradient(ellipse at bottom left, rgba(167,139,250,0.12), transparent 50%)',
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold mb-5"
            style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#60A5FA' }}>
            📈 Portail Investisseurs
          </div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4 max-w-3xl">
            Un deal flow curé<br />
            <span style={{ background: 'linear-gradient(135deg,#60A5FA,#A78BFA)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
              sur des marchés quantifiés.
            </span>
          </h1>
          <p className="text-gray-300 text-base md:text-lg max-w-2xl leading-relaxed mb-8">
            Feel The Gap identifie des opportunités import/export et production sur 115 pays,
            puis accompagne les entrepreneurs dans la construction de dossiers de levée conformes
            aux standards de due diligence. <span className="text-white font-semibold">Vous sourcez des deals où la taille du marché,
            la traction et la thèse sont déjà structurées.</span>
          </p>
          <div className="flex flex-wrap gap-3">
            {hasInvestorRole ? (
              <>
                <Link href="/invest/dashboard"
                  className="px-6 py-3 rounded-xl font-bold text-sm"
                  style={{ background: 'linear-gradient(135deg,#60A5FA,#A78BFA)', color: '#07090F' }}>
                  📊 Mon pipeline →
                </Link>
                <Link href="/invest/reports"
                  className="px-6 py-3 rounded-xl font-bold text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  Parcourir le deal flow
                </Link>
              </>
            ) : (
              <>
                <Link href="/invest/signup"
                  className="px-6 py-3 rounded-xl font-bold text-sm"
                  style={{ background: 'linear-gradient(135deg,#60A5FA,#A78BFA)', color: '#07090F' }}>
                  Activer mon accès Investisseur →
                </Link>
                <Link href="/auth/login?role=investisseur"
                  className="px-6 py-3 rounded-xl font-bold text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  Se connecter
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Marketplace state banner ────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 -mt-6 mb-4">
        <MarketplaceStateBanner
          role="investisseur"
          accentColor="#60A5FA"
          waitlistHref="/invest/waitlist"
          catalogHref="/invest/reports"
        />
      </section>

      {/* ── Value props ─────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: '🎯',
              title: 'Thèse quantifiée',
              body: 'Chaque opportunité est notée sur sa taille de marché (gap import/export), sa tension, son alignement produit-pays, sa croissance sectorielle. Votre thèse rencontre des deals réellement adressables.',
              color: '#60A5FA',
            },
            {
              icon: '📋',
              title: 'Due diligence facilitée',
              body: 'Les dossiers d\'investissement couvrent les 17 sections standards : équipe, marché, produit, traction, financials, cap table, use of funds, valorisation, gouvernance, exit strategy.',
              color: '#A78BFA',
            },
            {
              icon: '🛡️',
              title: 'Moins de risque',
              body: 'Les entrepreneurs sont accompagnés pas à pas — de l\'identification du marché à la détection de clients et à la promotion. L\'approche business est structurée et standardisée.',
              color: '#C9A84C',
            },
          ].map((card) => (
            <div key={card.title}
              className="rounded-2xl p-6"
              style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                style={{ background: card.color + '15', border: `1px solid ${card.color}30` }}>
                {card.icon}
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: card.color }}>{card.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-10">
        <h2 className="text-2xl md:text-3xl font-bold mb-8">Du sourcing au term sheet</h2>
        <div className="space-y-4">
          {[
            { n: 1, t: 'Sourcing qualifié', d: 'Carte mondiale des deals déposés. Filtrez par géo, ticket, secteur, stade, qualité de dossier, score d\'opportunité.' },
            { n: 2, t: 'Due diligence', d: 'Consultez les dossiers complets (Invest Premium) : équipe, marché, traction, cap table, projections, valorisation proposée.' },
            { n: 3, t: 'Proposition d\'investissement', d: 'Soumettez votre offre avec curseur % equity (0–33 %) et ticket. Si vous refusez la valorisation proposée, faites une contre-proposition à valorisation différente — warning envoyé aux deux parties.' },
            { n: 4, t: 'Pipeline deal tracking', d: 'Suivez chaque deal étape par étape : dossier reçu → analyse → résultat → acceptation en l\'état / refus / contre-proposition → matching coordonnées.' },
            { n: 5, t: 'Contact direct', d: 'Après accord mutuel, récupérez les coordonnées de l\'entrepreneur pour finaliser hors plateforme (term sheet, due diligence juridique, closing).' },
          ].map((step) => (
            <div key={step.n} className="flex gap-4 items-start rounded-2xl p-5"
              style={{ background: '#0D1117', border: '1px solid rgba(96,165,250,0.08)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                style={{ background: 'rgba(96,165,250,0.15)', color: '#60A5FA', border: '1px solid rgba(96,165,250,0.3)' }}>
                {step.n}
              </div>
              <div>
                <h4 className="font-bold text-white mb-1">{step.t}</h4>
                <p className="text-sm text-gray-400 leading-relaxed">{step.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Valuation principles ─────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 py-10">
        <div className="rounded-2xl p-6 md:p-8"
          style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)' }}>
          <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
            <span className="text-xl">⚖️</span> Principes de valorisation
          </h3>
          <ul className="text-sm text-gray-300 space-y-2">
            <li className="flex items-start gap-2"><span className="text-[#A78BFA] mt-0.5">•</span>
              Entrée en capital <span className="text-white font-semibold">minoritaire uniquement (max 33 %)</span>. Au-delà, l'entrepreneur doit compléter avec de la dette ou réduire la taille du projet.
            </li>
            <li className="flex items-start gap-2"><span className="text-[#A78BFA] mt-0.5">•</span>
              La plateforme calcule une valorisation indicative basée sur le secteur, le CA projeté, l'EBITDA et le stade de l'entreprise.
            </li>
            <li className="flex items-start gap-2"><span className="text-[#A78BFA] mt-0.5">•</span>
              L'entrepreneur peut <span className="text-white font-semibold">refuser cette valorisation et imposer la sienne</span>. Dans ce cas, un <span className="text-[#F97316]">warning</span> est affiché aux deux parties.
            </li>
            <li className="flex items-start gap-2"><span className="text-[#A78BFA] mt-0.5">•</span>
              Vous pouvez <span className="text-white font-semibold">contre-proposer à une valorisation différente</span> — changement du ratio % equity / montant proposé.
            </li>
          </ul>
        </div>
      </section>

      {/* ── Premium features ─────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="rounded-3xl p-8 md:p-10"
          style={{
            background: 'linear-gradient(135deg, rgba(96,165,250,0.08), rgba(167,139,250,0.06))',
            border: '1px solid rgba(96,165,250,0.2)',
          }}>
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)' }}>⭐</div>
            <div>
              <h3 className="text-xl font-bold mb-1">Invest Premium</h3>
              <p className="text-sm text-gray-400">Accédez aux dossiers complets, pipeline deal tracking et outils de contre-proposition.</p>
            </div>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              'Visualisation des dossiers complets (équipe, cap table, projections, valorisation)',
              'Sauvegarde de dossiers favoris avec notes privées',
              'Propositions d\'investissement (curseur 0–33 % d\'equity)',
              'Contre-propositions à valorisation différente',
              'Pipeline deal tracking : analyse → acceptation/refus/counter → matching',
              'Récupération des coordonnées des entrepreneurs après accord',
              'Filtres avancés : stade, ticket, thèse, qualité de dossier',
              'Alertes deal flow selon votre thèse d\'investissement',
            ].map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-[#60A5FA] mt-0.5 shrink-0">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Link href="/pricing/funding?role=investisseur"
              className="inline-block px-5 py-2.5 rounded-xl font-bold text-sm"
              style={{ background: 'linear-gradient(135deg,#60A5FA,#A78BFA)', color: '#07090F' }}>
              Voir les tarifs Invest Premium →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer CTA ───────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">
          Prêt à explorer le deal flow ?
        </h2>
        <p className="text-gray-400 mb-6 max-w-xl mx-auto">
          La plateforme est ouverte aux business angels, fonds d'amorçage et Série A, family offices
          équity et corporate VC. Onboarding en 2 minutes.
        </p>
        {hasInvestorRole ? (
          <Link href="/invest/reports"
            className="inline-block px-6 py-3 rounded-xl font-bold text-sm"
            style={{ background: 'linear-gradient(135deg,#60A5FA,#A78BFA)', color: '#07090F' }}>
            🌍 Ouvrir la carte →
          </Link>
        ) : (
          <Link href="/invest/signup"
            className="inline-block px-6 py-3 rounded-xl font-bold text-sm"
            style={{ background: 'linear-gradient(135deg,#60A5FA,#A78BFA)', color: '#07090F' }}>
            Activer mon accès Investisseur →
          </Link>
        )}
      </section>
    </div>
  )
}
