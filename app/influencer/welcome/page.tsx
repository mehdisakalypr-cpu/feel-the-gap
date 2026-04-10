'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import Topbar from '@/components/Topbar'
import { createSupabaseBrowser } from '@/lib/supabase'

// Landing "vendre du rêve" aux influenceurs.
// Accessible à tous (connecté ou non). Si l'user est déjà influenceur actif,
// CTA = "Ouvrir mon dashboard". Sinon CTA = "Activer mon accès influenceur".

export default function InfluencerWelcomePage() {
  const [isInfluencer, setIsInfluencer] = useState(false)
  const [isLogged, setIsLogged] = useState(false)
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const sb = createSupabaseBrowser()
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setIsLogged(true)
      const { data: p } = await sb.from('profiles').select('roles').eq('id', data.user.id).single()
      const roles = (p?.roles ?? []) as string[]
      setIsInfluencer(roles.includes('influenceur'))
    })
  }, [])

  async function activate() {
    setActivating(true)
    setError('')
    try {
      const res = await fetch('/api/funding/activate-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'influenceur' }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      window.location.href = '/influencer/catalog'
    } catch (err) {
      setError((err as Error).message)
      setActivating(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <Topbar />

      {/* ── Hero "vendre du rêve" ────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at top left, rgba(167,139,250,0.25), transparent 60%), radial-gradient(ellipse at bottom right, rgba(201,168,76,0.15), transparent 55%), radial-gradient(ellipse at center, rgba(236,72,153,0.1), transparent 70%)',
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 pt-20 pb-24 text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold mb-6"
            style={{
              background: 'rgba(167,139,250,0.12)',
              border: '1px solid rgba(167,139,250,0.35)',
              color: '#C4B5FD',
            }}
          >
            🎤 Pour les créateurs & influenceurs
          </div>

          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6 max-w-4xl mx-auto">
            Recommandez ce en quoi vous croyez.<br />
            <span
              style={{
                background: 'linear-gradient(135deg,#A78BFA,#EC4899,#C9A84C)',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Vivez de ce en quoi vous croyez.
            </span>
          </h1>

          <p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
            Rejoignez une communauté de créateurs qui gagnent des revenus récurrents en s'affiliant
            à des produits <span className="text-white font-semibold">éthiques, durables et transparents</span> — choisis
            par eux, pas imposés par un algorithme.
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            {isInfluencer ? (
              <>
                <Link
                  href="/influencer/catalog"
                  className="px-8 py-4 rounded-2xl font-bold text-base"
                  style={{
                    background: 'linear-gradient(135deg,#A78BFA,#EC4899)',
                    color: '#07090F',
                  }}
                >
                  🎨 Découvrir les produits →
                </Link>
                <Link
                  href="/influencer"
                  className="px-8 py-4 rounded-2xl font-bold text-base"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)' }}
                >
                  Mon dashboard
                </Link>
              </>
            ) : isLogged ? (
              <>
                <button
                  onClick={activate}
                  disabled={activating}
                  className="px-8 py-4 rounded-2xl font-bold text-base disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#A78BFA,#EC4899)', color: '#07090F' }}
                >
                  {activating ? 'Activation…' : '✨ Activer mon accès Créateur'}
                </button>
                <Link
                  href="/influencer/catalog"
                  className="px-8 py-4 rounded-2xl font-bold text-base"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)' }}
                >
                  Voir les produits
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/auth/register?redirect=/influencer/welcome"
                  className="px-8 py-4 rounded-2xl font-bold text-base"
                  style={{ background: 'linear-gradient(135deg,#A78BFA,#EC4899)', color: '#07090F' }}
                >
                  ✨ Commencer gratuitement
                </Link>
                <Link
                  href="/influencer/catalog"
                  className="px-8 py-4 rounded-2xl font-bold text-base"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)' }}
                >
                  Voir les produits
                </Link>
              </>
            )}
          </div>

          {error && <div className="text-red-400 text-sm mt-4">⚠️ {error}</div>}

          <p className="text-xs text-gray-600 mt-8">
            Aucun minimum de followers · Aucun engagement · Vous gardez <span className="text-[#C9A84C] font-bold">70 %</span> des commissions
          </p>
        </div>
      </section>

      {/* ── Revenue examples ───────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Combien vous pourriez gagner
        </h2>
        <p className="text-center text-gray-400 mb-12 max-w-2xl mx-auto">
          Les revenus affiliés passifs sont calculés sur des taux de commission réels observés sur
          les produits de notre catalogue. Vous touchez <span className="text-white font-semibold">70&nbsp;% de la commission brute</span>.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              tier: 'Nano',
              followers: '1 000 – 10 000',
              sales: '30 ventes/mois',
              avg: '25 €',
              commission_pct: 10,
              color: '#60A5FA',
            },
            {
              tier: 'Micro',
              followers: '10k – 100k',
              sales: '150 ventes/mois',
              avg: '28 €',
              commission_pct: 12,
              color: '#A78BFA',
            },
            {
              tier: 'Macro',
              followers: '100k+',
              sales: '800 ventes/mois',
              avg: '32 €',
              commission_pct: 12,
              color: '#EC4899',
            },
          ].map((tier) => {
            const salesNum = parseInt(tier.sales)
            const avgNum = parseInt(tier.avg)
            const gross = salesNum * avgNum * (tier.commission_pct / 100)
            const influencerShare = gross * 0.7
            return (
              <div
                key={tier.tier}
                className="rounded-3xl p-6 relative overflow-hidden"
                style={{
                  background: '#0D1117',
                  border: `1px solid ${tier.color}30`,
                }}
              >
                <div
                  className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20"
                  style={{ background: tier.color }}
                />
                <div className="relative">
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: tier.color }}
                  >
                    Créateur {tier.tier}
                  </div>
                  <div className="text-white font-bold text-lg mb-1">{tier.followers}</div>
                  <div className="text-xs text-gray-500 mb-6">followers</div>

                  <div className="space-y-2 text-xs text-gray-400 mb-6">
                    <div className="flex justify-between">
                      <span>Ventes estimées</span>
                      <span className="text-white">{tier.sales}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Panier moyen</span>
                      <span className="text-white">{tier.avg}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Commission produit</span>
                      <span className="text-white">{tier.commission_pct} %</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Votre part</span>
                      <span className="text-[#34D399] font-bold">70 %</span>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-4">
                    <div className="text-[10px] text-gray-500 uppercase mb-1">Revenu mensuel</div>
                    <div
                      className="text-3xl font-bold"
                      style={{
                        background: `linear-gradient(135deg,${tier.color},${tier.color}aa)`,
                        WebkitBackgroundClip: 'text',
                        color: 'transparent',
                      }}
                    >
                      {Math.round(influencerShare).toLocaleString('fr-FR')} €
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-600 text-center mt-6 max-w-2xl mx-auto">
          Estimations indicatives basées sur des taux de conversion et des commissions moyens du
          secteur. Les revenus réels dépendent de votre audience, de votre engagement et des
          produits choisis.
        </p>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          Trois étapes pour commencer
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              n: '01',
              icon: '🎨',
              title: 'Choisissez vos produits',
              body: 'Parcourez notre catalogue de produits soigneusement sélectionnés — cosmétique bio, alimentation éthique, mode durable, artisanat. Sauvegardez ceux en qui vous croyez.',
            },
            {
              n: '02',
              icon: '🔗',
              title: 'Partagez votre lien',
              body: 'Chaque produit a un lien d\'affiliation unique à votre nom. Partagez-le sur Instagram, TikTok, YouTube, newsletter, blog — sur tout ce qui vous fait vibrer.',
            },
            {
              n: '03',
              icon: '💸',
              title: 'Recevez vos commissions',
              body: 'Chaque vente est trackée automatiquement. Virements Stripe hebdomadaires dès 20 € de revenus. Vous gardez 70 % de la commission brute.',
            },
          ].map((s) => (
            <div
              key={s.n}
              className="rounded-3xl p-6"
              style={{
                background: '#0D1117',
                border: '1px solid rgba(167,139,250,0.15)',
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="text-5xl font-bold opacity-10"
                  style={{ color: '#A78BFA' }}
                >
                  {s.n}
                </span>
                <span className="text-3xl">{s.icon}</span>
              </div>
              <h3 className="font-bold text-white text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Values ─────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div
          className="rounded-3xl p-8 md:p-12 text-center"
          style={{
            background:
              'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(236,72,153,0.05))',
            border: '1px solid rgba(167,139,250,0.2)',
          }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Des produits qui ont du sens
          </h2>
          <p className="text-gray-300 leading-relaxed max-w-3xl mx-auto mb-8">
            Chaque produit de notre catalogue est validé manuellement. Nous privilégions les marques
            éthiques, les producteurs locaux, les circuits courts et les initiatives à impact.
            Votre audience mérite de l'authenticité.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {[
              '🌱 Bio & naturel',
              '♻️ Circuit court',
              '🤝 Commerce équitable',
              '🌍 Impact carbone faible',
              '✊ Producteurs locaux',
              '💎 Artisanat',
            ].map((tag) => (
              <span
                key={tag}
                className="px-4 py-2 rounded-full text-sm font-medium"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(167,139,250,0.3)',
                  color: '#d1d5db',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer CTA ─────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Prêt à transformer votre audience en revenus ?
        </h2>
        <p className="text-gray-400 mb-8">
          Pas de frais d'inscription. Pas de minimum d'audience. Pas d'engagement de durée.
        </p>
        {isInfluencer ? (
          <Link
            href="/influencer/catalog"
            className="inline-block px-8 py-4 rounded-2xl font-bold text-base"
            style={{ background: 'linear-gradient(135deg,#A78BFA,#EC4899)', color: '#07090F' }}
          >
            🎨 Découvrir les produits →
          </Link>
        ) : isLogged ? (
          <button
            onClick={activate}
            disabled={activating}
            className="px-8 py-4 rounded-2xl font-bold text-base disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#A78BFA,#EC4899)', color: '#07090F' }}
          >
            {activating ? 'Activation…' : '✨ Activer mon accès maintenant'}
          </button>
        ) : (
          <Link
            href="/auth/register?redirect=/influencer/welcome"
            className="inline-block px-8 py-4 rounded-2xl font-bold text-base"
            style={{ background: 'linear-gradient(135deg,#A78BFA,#EC4899)', color: '#07090F' }}
          >
            ✨ Commencer gratuitement
          </Link>
        )}
      </section>
    </div>
  )
}
