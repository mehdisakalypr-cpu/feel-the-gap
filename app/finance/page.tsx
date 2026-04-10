'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import Topbar from '@/components/Topbar'
import { createSupabaseBrowser } from '@/lib/supabase'

// Homepage /finance — destinée aux financeurs (banques, institutions de crédit,
// crowdlenders, family offices côté dette, fonds de garantie).
// Vocabulaire : deal flow, DSCR, covenants, seniority, ticket, duration,
// interest rate, collateral, risk tiering, due diligence crédit, pipeline, LGD.

export default function FinanceHomePage() {
  const [hasFinancierRole, setHasFinancierRole] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createSupabaseBrowser()
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setLoading(false); return }
      const { data: p } = await sb.from('profiles').select('roles').eq('id', data.user.id).single()
      const roles = (p?.roles ?? []) as string[]
      setHasFinancierRole(roles.includes('financeur'))
      setLoading(false)
    })
  }, [])

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <Topbar />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(ellipse at top, rgba(52,211,153,0.18), transparent 60%), radial-gradient(ellipse at bottom right, rgba(201,168,76,0.12), transparent 50%)',
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold mb-5"
            style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#34D399' }}>
            🏦 Portail Financeurs
          </div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4 max-w-3xl">
            Sourcez des dossiers de crédit<br />
            <span style={{ background: 'linear-gradient(135deg,#34D399,#10B981)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
              sur des marchés en tension.
            </span>
          </h1>
          <p className="text-gray-300 text-base md:text-lg max-w-2xl leading-relaxed mb-8">
            Feel The Gap identifie les opportunités d'import/export et de production sur 115 pays,
            puis accompagne les entrepreneurs dans la construction de dossiers de financement
            structurés selon les standards d'analyse crédit. <span className="text-white font-semibold">Vous accédez à un deal flow
            qualifié, où chaque dossier est scoré sur la qualité de l'opportunité et la solidité du plan.</span>
          </p>
          <div className="flex flex-wrap gap-3">
            {hasFinancierRole ? (
              <>
                <Link href="/finance/reports"
                  className="px-6 py-3 rounded-xl font-bold text-sm"
                  style={{ background: 'linear-gradient(135deg,#34D399,#10B981)', color: '#07090F' }}>
                  📍 Ouvrir la carte des marchés →
                </Link>
                <Link href="/finance/reports"
                  className="px-6 py-3 rounded-xl font-bold text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  Parcourir le deal flow
                </Link>
              </>
            ) : (
              <>
                <Link href="/finance/signup"
                  className="px-6 py-3 rounded-xl font-bold text-sm"
                  style={{ background: 'linear-gradient(135deg,#34D399,#10B981)', color: '#07090F' }}>
                  Activer mon accès Financeur →
                </Link>
                <Link href="/auth/login?role=financeur"
                  className="px-6 py-3 rounded-xl font-bold text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  Se connecter
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Value props ─────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: '🔍',
              title: 'Deal flow qualifié',
              body: 'Chaque dossier est standardisé selon les exigences d\'un comité de crédit : KYC, historique financier, projections, plan de trésorerie, garanties, risques. Vous gagnez sur le temps d\'analyse amont.',
              color: '#34D399',
            },
            {
              icon: '📊',
              title: 'Double scoring',
              body: 'Nous notons la qualité de l\'opportunité de marché (gap, tension, croissance sectorielle) ET la qualité du dossier (complétude, cohérence, solidité). Filtrez votre pipeline par risk profile.',
              color: '#60A5FA',
            },
            {
              icon: '🛡️',
              title: 'Risque structuré',
              body: 'Les entrepreneurs sont accompagnés étape par étape — de l\'identification du marché à la détection de clients et à la promotion des ventes. Approche business structurée et moins risquée standardisée.',
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
        <h2 className="text-2xl md:text-3xl font-bold mb-8">
          De l'opportunité au deal signé
        </h2>
        <div className="space-y-4">
          {[
            { n: 1, t: 'Sourcing', d: 'Accédez à la carte des marchés avec dossiers déposés. Filtrez par géo, ticket, secteur, risk tier.' },
            { n: 2, t: 'Due diligence', d: 'Consultez les dossiers complets (sur abonnement Finance Premium) : KYC, historique, projections, collateral, covenants proposés.' },
            { n: 3, t: 'Offre de financement', d: 'Soumettez votre proposition avec taux, durée, montant, assurance, frais de dossier. L\'entrepreneur voit votre offre et peut répondre.' },
            { n: 4, t: 'Pipeline de suivi', d: 'Tracez chaque deal étape par étape : dossier reçu → analyse → résultat → acceptation/refus/contre-proposition → matching coordonnées.' },
            { n: 5, t: 'Contact direct', d: 'Après accord mutuel sur la plateforme, récupérez les coordonnées de l\'entrepreneur pour finaliser hors plateforme.' },
          ].map((step) => (
            <div key={step.n} className="flex gap-4 items-start rounded-2xl p-5"
              style={{ background: '#0D1117', border: '1px solid rgba(52,211,153,0.08)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)' }}>
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

      {/* ── Premium features ─────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="rounded-3xl p-8 md:p-10"
          style={{
            background: 'linear-gradient(135deg, rgba(52,211,153,0.08), rgba(201,168,76,0.05))',
            border: '1px solid rgba(52,211,153,0.2)',
          }}>
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }}>⭐</div>
            <div>
              <h3 className="text-xl font-bold mb-1">Finance Premium</h3>
              <p className="text-sm text-gray-400">Débloquez l'accès aux dossiers complets et le pipeline deal tracking.</p>
            </div>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              'Visualisation des dossiers complets (identité, historique financier, collateral…)',
              'Sauvegarde de dossiers favoris avec notes privées',
              'Propositions de financement — partielles ou totales',
              'Pipeline de suivi des deals : analyse → acceptation/refus/contre-proposition → matching',
              'Récupération des coordonnées des entrepreneurs après accord',
              'Filtres avancés : secteur, ticket, risk tier, qualité de dossier',
            ].map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-[#34D399] mt-0.5 shrink-0">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Link href="/pricing?role=financeur"
              className="inline-block px-5 py-2.5 rounded-xl font-bold text-sm"
              style={{ background: 'linear-gradient(135deg,#34D399,#10B981)', color: '#07090F' }}>
              Voir les tarifs Finance Premium →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer CTA ───────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">
          Prêt à sourcer votre prochain deal ?
        </h2>
        <p className="text-gray-400 mb-6 max-w-xl mx-auto">
          La plateforme est ouverte aux institutions de crédit, crowdlenders, prêteurs privés et
          family offices côté dette. Onboarding en 2 minutes.
        </p>
        {hasFinancierRole ? (
          <Link href="/finance/reports"
            className="inline-block px-6 py-3 rounded-xl font-bold text-sm"
            style={{ background: 'linear-gradient(135deg,#34D399,#10B981)', color: '#07090F' }}>
            📍 Ouvrir la carte →
          </Link>
        ) : (
          <Link href="/finance/signup"
            className="inline-block px-6 py-3 rounded-xl font-bold text-sm"
            style={{ background: 'linear-gradient(135deg,#34D399,#10B981)', color: '#07090F' }}>
            Activer mon accès Financeur →
          </Link>
        )}
      </section>
    </div>
  )
}
