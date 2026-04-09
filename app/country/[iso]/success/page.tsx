'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Topbar from '@/components/Topbar'
import JourneySidebar from '@/components/JourneySidebar'
import PaywallGate from '@/components/PaywallGate'
import { useLang } from '@/components/LanguageProvider'
import { supabase } from '@/lib/supabase'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Country {
  id: string
  name: string
  name_fr: string
  flag: string
  region: string
}

interface Opportunity {
  id: string
  type: string
  opportunity_score: number
  gap_value_usd: number | null
  summary: string | null
  products: { name: string; category: string } | null
}

interface YoutubeInsight {
  id: string
  video_id: string
  title: string
  channel_name: string | null
  thumbnail_url: string | null
  published_at: string | null
  view_count: number | null
  relevance_score: number | null
}

interface JourneyState {
  interested_opp_ids?: string[]
  selected_modes?: string[]
}

// ─── i18n ───────────────────────────────────────────────────────────────────

type Lang = 'fr' | 'en'
const TR = {
  title: { fr: 'En route vers le succès', en: 'On the way to success' },
  subtitle: {
    fr: 'Récap de votre parcours, ressources de formation et plan d\'action IA pour concrétiser votre projet.',
    en: 'Your journey recap, training resources and AI action plan to make your project happen.',
  },
  recapTitle: { fr: 'Votre parcours', en: 'Your journey' },
  recapCountry: { fr: 'Pays ciblé', en: 'Target country' },
  recapOpps: { fr: 'Opportunités retenues', en: 'Selected opportunities' },
  recapModes: { fr: 'Approches choisies', en: 'Chosen approaches' },
  noOpps: { fr: 'Aucune opportunité cochée', en: 'No opportunities selected' },
  noModes: { fr: 'Aucune approche définie', en: 'No approach defined' },
  goBackReport: { fr: '→ Revenir au rapport', en: '→ Back to report' },
  goBackPlan: { fr: '→ Revenir au business plan', en: '→ Back to business plan' },
  trainingTitle: { fr: 'Ressources de formation', en: 'Training resources' },
  trainingDesc: {
    fr: 'Vidéos YouTube curées par nos agents IA sur ce pays et ce secteur.',
    en: 'YouTube videos curated by our AI agents for this country and sector.',
  },
  noTraining: {
    fr: 'Aucune vidéo de formation disponible pour le moment. Nos agents explorent en continu.',
    en: 'No training videos available yet. Our agents are exploring continuously.',
  },
  watchVideo: { fr: 'Regarder', en: 'Watch' },
  actionPlanTitle: { fr: 'Plan d\'action IA', en: 'AI Action Plan' },
  actionPlanDesc: {
    fr: 'Checklist personnalisée basée sur vos choix. Cochez chaque étape au fur et à mesure.',
    en: 'Personalized checklist based on your choices. Check each step as you go.',
  },
  generating: { fr: 'Génération du plan d\'action…', en: 'Generating action plan…' },
  regenerate: { fr: 'Régénérer', en: 'Regenerate' },
  adviseeTitle: { fr: 'Besoin d\'aide ?', en: 'Need help?' },
  adviseeDesc: {
    fr: 'Discutez avec l\'AI Advisor pour approfondir n\'importe quel point.',
    en: 'Chat with the AI Advisor to dig into any point.',
  },
  openAdvisor: { fr: 'Ouvrir l\'AI Advisor', en: 'Open AI Advisor' },
  affiliateTitle: { fr: 'Monétisez votre réussite', en: 'Monetize your success' },
  affiliateDesc: {
    fr: 'Partagez votre lien affilié et gagnez 70 % sur chaque conversion.',
    en: 'Share your affiliate link and earn 70% on each conversion.',
  },
  goAffiliate: { fr: 'Mon espace influenceur', en: 'My influencer space' },
  stepsFallback: {
    fr: 'Étapes génériques — remplissez le formulaire du business plan pour obtenir un plan détaillé.',
    en: 'Generic steps — fill out the business plan form to get a detailed plan.',
  },
} as const
const tx = (l: Lang) => (k: keyof typeof TR) => TR[k][l]

// ─── Mode meta (mirrors enriched-plan) ──────────────────────────────────────

const MODE_META: Record<string, { icon: string; fr: string; en: string }> = {
  import_sell: { icon: '📦', fr: 'Importer & revendre', en: 'Import & sell' },
  produce_locally: { icon: '🏭', fr: 'Produire localement', en: 'Produce locally' },
  train_locals: { icon: '🎓', fr: 'Former les locaux', en: 'Train locals' },
}

// ─── Fallback action steps ──────────────────────────────────────────────────

const FALLBACK_STEPS_FR: string[] = [
  'Vérifier les codes HS des produits ciblés et le régime douanier applicable',
  'Identifier 3 à 5 fournisseurs ou partenaires locaux (chambre de commerce, salons)',
  'Obtenir les certifications et licences d\'importation nécessaires',
  'Établir un prévisionnel de trésorerie à 12 mois',
  'Sécuriser un partenaire logistique (transitaire, entrepôt)',
  'Préparer la stratégie de distribution (B2B / B2C / marketplaces)',
  'Lancer une phase pilote de 3 mois pour valider le marché',
]

const FALLBACK_STEPS_EN: string[] = [
  'Verify HS codes for target products and applicable customs regime',
  'Identify 3–5 local suppliers or partners (chamber of commerce, trade shows)',
  'Obtain required certifications and import licenses',
  'Build a 12-month cash flow forecast',
  'Secure a logistics partner (freight forwarder, warehouse)',
  'Prepare distribution strategy (B2B / B2C / marketplaces)',
  'Launch a 3-month pilot phase to validate the market',
]

// ─── Page ───────────────────────────────────────────────────────────────────

export default function SuccessPage() {
  const { iso } = useParams<{ iso: string }>()
  const { lang } = useLang()
  const L: Lang = lang === 'en' ? 'en' : 'fr'
  const t = tx(L)

  const [country, setCountry] = useState<Country | null>(null)
  const [opps, setOpps] = useState<Opportunity[]>([])
  const [youtubeInsights, setYoutubeInsights] = useState<YoutubeInsight[]>([])
  const [journeyState, setJourneyState] = useState<JourneyState>({})
  const [userTier, setUserTier] = useState<string>('free')
  const [loading, setLoading] = useState(true)
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set())

  // Restore checked steps from localStorage
  useEffect(() => {
    if (!iso) return
    try {
      const saved = localStorage.getItem(`ftg_journey_${iso}`)
      if (saved) {
        const data: JourneyState & { success_checked?: number[] } = JSON.parse(saved)
        setJourneyState(data)
        if (Array.isArray(data.success_checked)) {
          setCheckedSteps(new Set(data.success_checked))
        }
      }
    } catch {}
  }, [iso])

  // Persist checked steps
  useEffect(() => {
    if (!iso) return
    try {
      const existing = JSON.parse(localStorage.getItem(`ftg_journey_${iso}`) ?? '{}')
      localStorage.setItem(
        `ftg_journey_${iso}`,
        JSON.stringify({ ...existing, success_checked: Array.from(checkedSteps) }),
      )
    } catch {}
  }, [checkedSteps, iso])

  // Fetch country + opps + user tier + youtube insights
  useEffect(() => {
    if (!iso) return
    const isoUpper = iso.toUpperCase()
    Promise.all([
      supabase.from('countries').select('id, name, name_fr, flag, region').eq('id', isoUpper).single(),
      supabase
        .from('opportunities')
        .select('id, type, opportunity_score, gap_value_usd, summary, products(name, category)')
        .eq('country_iso', isoUpper)
        .order('opportunity_score', { ascending: false })
        .limit(50),
      supabase.auth.getUser(),
      supabase
        .from('youtube_insights')
        .select('id, video_id, title, channel_name, thumbnail_url, published_at, view_count, relevance_score')
        .eq('country_iso', isoUpper)
        .order('relevance_score', { ascending: false, nullsFirst: false })
        .limit(8),
    ]).then(async ([{ data: c }, { data: o }, { data: authData }, { data: videos }]) => {
      if (c) setCountry(c as Country)
      setOpps(
        ((o ?? []) as unknown[]).map((raw) => {
          const x = raw as Opportunity & { products: Opportunity['products'] | Opportunity['products'][] }
          return { ...x, products: Array.isArray(x.products) ? x.products[0] ?? null : x.products }
        }),
      )
      setYoutubeInsights((videos ?? []) as YoutubeInsight[])
      if (authData.user) {
        const { data: profile } = await supabase.from('profiles').select('tier').eq('id', authData.user.id).single()
        if (profile?.tier) setUserTier(profile.tier)
      }
      setLoading(false)
    })
  }, [iso])

  const interestedOpps = useMemo(() => {
    if (!journeyState.interested_opp_ids?.length) return []
    const ids = new Set(journeyState.interested_opp_ids)
    return opps.filter((o) => ids.has(o.id))
  }, [journeyState.interested_opp_ids, opps])

  const selectedModes = journeyState.selected_modes ?? []

  const steps = L === 'fr' ? FALLBACK_STEPS_FR : FALLBACK_STEPS_EN

  const toggleStep = (i: number) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!country) {
    return (
      <div className="min-h-screen bg-[#07090F] flex flex-col">
        <Topbar />
        <div className="flex-1 flex items-center justify-center text-gray-400">
          {L === 'fr' ? 'Pays introuvable' : 'Country not found'}
        </div>
      </div>
    )
  }

  const countryName = L === 'fr' ? country.name_fr : country.name

  return (
    <div className="min-h-screen bg-[#07090F] flex flex-col">
      <Topbar />
      <JourneySidebar iso={iso.toUpperCase()} currentStep="success" userTier={userTier} />

      <div className="lg:pl-64 w-full">
        <main className="max-w-5xl mx-auto w-full px-4 py-8 space-y-8">
          {/* Hero */}
          <header className="relative rounded-2xl overflow-hidden border border-amber-500/30">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/15 via-orange-500/5 to-transparent" />
            <div className="relative px-6 py-8 sm:px-10 sm:py-12 flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="text-6xl shrink-0">🚀</div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{t('title')}</h1>
                <p className="text-sm text-gray-400 max-w-2xl">{t('subtitle')}</p>
              </div>
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                <span className="text-2xl">{country.flag}</span>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-500">{t('recapCountry')}</div>
                  <div className="text-sm font-semibold text-white">{countryName}</div>
                </div>
              </div>
            </div>
          </header>

          {/* Gate everything below for Strategy+ users */}
          <PaywallGate requiredTier="standard" featureName={t('title')}>
            <div className="space-y-8">
              {/* Recap card */}
              <section className="bg-[#0D1117] border border-white/10 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <span>📋</span> {t('recapTitle')}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Opportunities */}
                  <div>
                    <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">{t('recapOpps')}</div>
                    {interestedOpps.length === 0 ? (
                      <div className="text-sm text-gray-500 italic">
                        {t('noOpps')}{' '}
                        <Link href={`/reports/${iso}`} className="text-amber-400 hover:text-amber-300">
                          {t('goBackReport')}
                        </Link>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {interestedOpps.slice(0, 5).map((opp) => (
                          <li key={opp.id} className="flex items-start gap-2 text-sm">
                            <span className="text-emerald-400 mt-0.5">✓</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-white font-medium truncate">
                                {opp.products?.name ?? 'Product'}
                              </div>
                              {opp.summary && (
                                <div className="text-xs text-gray-500 line-clamp-1">{opp.summary}</div>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-amber-400 shrink-0">
                              {opp.opportunity_score}/100
                            </span>
                          </li>
                        ))}
                        {interestedOpps.length > 5 && (
                          <li className="text-xs text-gray-500">
                            + {interestedOpps.length - 5} {L === 'fr' ? 'autres' : 'more'}
                          </li>
                        )}
                      </ul>
                    )}
                  </div>

                  {/* Modes */}
                  <div>
                    <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">{t('recapModes')}</div>
                    {selectedModes.length === 0 ? (
                      <div className="text-sm text-gray-500 italic">
                        {t('noModes')}{' '}
                        <Link
                          href={`/country/${iso}/enriched-plan`}
                          className="text-amber-400 hover:text-amber-300"
                        >
                          {t('goBackPlan')}
                        </Link>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {selectedModes.map((m) => {
                          const meta = MODE_META[m]
                          if (!meta) return null
                          return (
                            <li
                              key={m}
                              className="flex items-center gap-2 text-sm bg-white/5 rounded-lg px-3 py-2"
                            >
                              <span className="text-lg">{meta.icon}</span>
                              <span className="text-white font-medium">{meta[L]}</span>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </section>

              {/* Action plan checklist */}
              <section className="bg-[#0D1117] border border-white/10 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  <span>✅</span> {t('actionPlanTitle')}
                </h2>
                <p className="text-xs text-gray-400 mb-5">{t('actionPlanDesc')}</p>

                <ul className="space-y-2">
                  {steps.map((step, i) => {
                    const checked = checkedSteps.has(i)
                    return (
                      <li key={i}>
                        <button
                          onClick={() => toggleStep(i)}
                          className={`w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors border ${
                            checked
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : 'bg-white/[.02] border-white/5 hover:border-white/15'
                          }`}
                        >
                          <div
                            className={`shrink-0 mt-0.5 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                              checked
                                ? 'bg-emerald-500 text-gray-950'
                                : 'bg-white/5 border border-white/20 text-transparent'
                            }`}
                          >
                            ✓
                          </div>
                          <span
                            className={`text-sm flex-1 ${
                              checked ? 'text-gray-400 line-through' : 'text-gray-200'
                            }`}
                          >
                            {step}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {checkedSteps.size} / {steps.length} {L === 'fr' ? 'complétées' : 'completed'}
                  </span>
                  <Link
                    href={`/country/${iso}/enriched-plan`}
                    className="text-amber-400 hover:text-amber-300"
                  >
                    {L === 'fr' ? 'Voir le plan détaillé →' : 'View detailed plan →'}
                  </Link>
                </div>
              </section>

              {/* Training resources */}
              <section className="bg-[#0D1117] border border-white/10 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  <span>🎓</span> {t('trainingTitle')}
                </h2>
                <p className="text-xs text-gray-400 mb-5">{t('trainingDesc')}</p>

                {youtubeInsights.length === 0 ? (
                  <div className="text-sm text-gray-500 italic bg-white/[.02] border border-white/5 rounded-lg px-4 py-6 text-center">
                    {t('noTraining')}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {youtubeInsights.map((v) => (
                      <a
                        key={v.id}
                        href={`https://www.youtube.com/watch?v=${v.video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group bg-white/[.02] border border-white/10 rounded-xl overflow-hidden hover:border-amber-500/40 transition-colors"
                      >
                        {v.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={v.thumbnail_url}
                            alt={v.title}
                            className="w-full aspect-video object-cover"
                          />
                        ) : (
                          <div className="w-full aspect-video bg-gradient-to-br from-red-500/10 to-red-600/5 flex items-center justify-center text-4xl">
                            ▶
                          </div>
                        )}
                        <div className="p-3">
                          <div className="text-sm font-semibold text-white line-clamp-2 group-hover:text-amber-400 transition-colors">
                            {v.title}
                          </div>
                          {v.channel_name && (
                            <div className="text-[11px] text-gray-500 mt-1 truncate">{v.channel_name}</div>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </section>

              {/* CTAs */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/30 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">✨</span>
                    <h3 className="font-bold text-white">{t('adviseeTitle')}</h3>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">{t('adviseeDesc')}</p>
                  <Link
                    href="/gemini"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/40 rounded-lg text-sm font-semibold text-blue-300 hover:bg-blue-500/30 transition-colors"
                  >
                    {t('openAdvisor')} →
                  </Link>
                </div>

                <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/30 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">💰</span>
                    <h3 className="font-bold text-white">{t('affiliateTitle')}</h3>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">{t('affiliateDesc')}</p>
                  <Link
                    href="/influencer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/40 rounded-lg text-sm font-semibold text-amber-300 hover:bg-amber-500/30 transition-colors"
                  >
                    {t('goAffiliate')} →
                  </Link>
                </div>
              </section>
            </div>
          </PaywallGate>
        </main>
      </div>
    </div>
  )
}
