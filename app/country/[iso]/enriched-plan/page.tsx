'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Topbar from '@/components/Topbar';
import JourneySidebar from '@/components/JourneySidebar';
import { useLang } from '@/components/LanguageProvider';
import { supabase } from '@/lib/supabase';

// ─── i18n strings ───────────────────────────────────────────────────────────
type L = 'fr' | 'en';
const TR = {
  back: { fr: 'Retour pays', en: 'Back to country' },
  title: { fr: 'Business Plan Enrichi', en: 'Enriched Business Plan' },
  subtitle: {
    fr: 'Plan complet avec 3 scénarios comparés (artisanal, mécanisé, IA) — données issues de la recherche YouTube, réglementaire et coûts marché.',
    en: 'Full plan with 3 compared scenarios (artisanal, mechanized, AI) — based on YouTube research, regulations and market cost data.',
  },
  generating: { fr: 'Génération du business plan enrichi…', en: 'Generating the enriched business plan…' },
  generatingDesc: {
    fr: 'Analyse des données YouTube, réglementation, coûts production et logistique',
    en: 'Analyzing YouTube data, regulations, production costs and logistics',
  },
  error: { fr: 'Erreur', en: 'Error' },
  retry: { fr: 'Réessayer', en: 'Retry' },
  execSummary: { fr: 'Résumé exécutif', en: 'Executive Summary' },
  marketStudy: { fr: 'Étude de marché', en: 'Market Study' },
  marketSize: { fr: 'Taille marché', en: 'Market size' },
  annualGrowth: { fr: 'Croissance annuelle', en: 'Annual growth' },
  keyPlayers: { fr: 'Acteurs clés', en: 'Key players' },
  regulations: { fr: 'Réglementations', en: 'Regulations' },
  demandDrivers: { fr: 'Moteurs de demande', en: 'Demand drivers' },
  barriers: { fr: "Barrières à l'entrée", en: 'Barriers to entry' },
  fieldInsights: { fr: '💡 Insights terrain (vidéos YouTube)', en: '💡 Field insights (YouTube videos)' },
  scenariosTitle: { fr: 'Comparatif des 3 scénarios', en: '3-scenario comparison' },
  scenariosDesc: {
    fr: 'Avantages, inconvénients et projections financières — recommandation IA en bas.',
    en: 'Advantages, drawbacks and financial projections — AI recommendation at the bottom.',
  },
  recommended: { fr: 'RECOMMANDÉ', en: 'RECOMMENDED' },
  capex: { fr: 'CapEx', en: 'CapEx' },
  opex: { fr: 'OpEx/an', en: 'OpEx/year' },
  revenue: { fr: 'Revenus/an', en: 'Revenue/year' },
  grossMargin: { fr: 'Marge brute', en: 'Gross margin' },
  roi3y: { fr: 'ROI 3 ans', en: '3-year ROI' },
  payback: { fr: 'Payback', en: 'Payback' },
  paybackUnit: { fr: 'mois', en: 'months' },
  employees: { fr: 'employés', en: 'employees' },
  tonnesYear: { fr: 't/an — qualité', en: 't/yr — quality' },
  risk: { fr: 'Risque', en: 'Risk' },
  advantages: { fr: '✓ Avantages', en: '✓ Advantages' },
  disadvantages: { fr: '✗ Inconvénients', en: '✗ Drawbacks' },
  recommendedScenario: { fr: 'Scénario recommandé', en: 'Recommended scenario' },
  cheapest: { fr: '💰 Moins cher', en: '💰 Cheapest' },
  fastest: { fr: '⚡ Plus rapide', en: '⚡ Fastest' },
  bestMargin: { fr: '📈 Meilleure marge', en: '📈 Best margin' },
  avgCapex: { fr: '📊 CapEx moyen', en: '📊 Avg CapEx' },
  refineTitle: { fr: '🎯 Affiner le plan', en: '🎯 Refine the plan' },
  refineDesc: {
    fr: 'Plus tu remplis ce formulaire, plus ton business plan sera précis.',
    en: 'The more you fill out this form, the more accurate your business plan will be.',
  },
  hide: { fr: 'Masquer', en: 'Hide' },
  openForm: { fr: 'Ouvrir le formulaire', en: 'Open the form' },
  targetVolume: { fr: 'Production annuelle cible (tonnes)', en: 'Target annual production (tons)' },
  budget: { fr: 'Budget disponible (EUR)', en: 'Available budget (EUR)' },
  teamSize: { fr: "Taille de l'équipe déjà constituée", en: 'Existing team size' },
  region: { fr: 'Région ciblée (optionnel)', en: 'Target region (optional)' },
  expertise: { fr: "Niveau d'expertise", en: 'Expertise level' },
  selectPlaceholder: { fr: '— sélectionner —', en: '— select —' },
  novice: { fr: 'Novice', en: 'Novice' },
  intermediate: { fr: 'Intermédiaire', en: 'Intermediate' },
  expert: { fr: 'Expert', en: 'Expert' },
  targetQuality: { fr: 'Qualité visée', en: 'Target quality' },
  entryQ: { fr: 'Entry (bas de gamme)', en: 'Entry (low-end)' },
  midQ: { fr: 'Mid (milieu de gamme)', en: 'Mid (mid-range)' },
  premiumQ: { fr: 'Premium (haut de gamme)', en: 'Premium (high-end)' },
  horizon: { fr: 'Horizon (années)', en: 'Horizon (years)' },
  regenerate: { fr: 'Régénérer avec précisions', en: 'Regenerate with precision' },
  clear: { fr: 'Effacer', en: 'Clear' },
  actionPlan: { fr: "Plan d'action", en: 'Action plan' },
  phase: { fr: 'Phase', en: 'Phase' },
  budgetLabel: { fr: 'Budget', en: 'Budget' },
  months: { fr: 'mois', en: 'months' },
  risksTitle: { fr: 'Risques & mitigation', en: 'Risks & mitigation' },
  mitigation: { fr: '↳ Mitigation', en: '↳ Mitigation' },
  footer: {
    fr: 'Généré le',
    en: 'Generated on',
  },
  poweredBy: {
    fr: 'Propulsé par Gemini 2.5 Flash + recherche YouTube',
    en: 'Powered by Gemini 2.5 Flash + YouTube research',
  },
  chooseModesTitle: {
    fr: 'Vous pouvez saisir cette opportunité de différentes manières',
    en: 'You can seize this opportunity in several ways',
  },
  chooseModesSubtitle: {
    fr: 'Sélectionnez au moins une approche — votre business plan sera adapté à vos choix.',
    en: 'Select at least one approach — your business plan will be tailored to your choices.',
  },
  modeImportSellTitle: { fr: 'Importer & revendre', en: 'Import & sell' },
  modeImportSellDesc: {
    fr: 'Acheter à l\'international et distribuer sur le marché local',
    en: 'Buy internationally and distribute on the local market',
  },
  modeProduceLocallyTitle: { fr: 'Produire localement', en: 'Produce locally' },
  modeProduceLocallyDesc: {
    fr: 'Installer une unité de production sur place avec main d\'œuvre locale',
    en: 'Set up a local production unit with local workforce',
  },
  modeTrainLocalsTitle: { fr: 'Former les locaux', en: 'Train locals' },
  modeTrainLocalsDesc: {
    fr: 'Créer un programme de formation technique et transférer le savoir-faire',
    en: 'Create a technical training program and transfer know-how',
  },
  generatePlan: { fr: 'Générer le business plan', en: 'Generate the business plan' },
  changeModes: { fr: 'Changer mes choix', en: 'Change my choices' },
  selectedModes: { fr: 'Modes choisis', en: 'Selected modes' },
  atLeastOne: {
    fr: 'Vous devez choisir au moins une approche',
    en: 'You must choose at least one approach',
  },
} as const;
const tx = (l: L) => (k: keyof typeof TR) => TR[k][l];

const SCENARIO_LABELS: Record<L, { artisanal: string; mechanized: string; ai_automated: string }> = {
  fr: { artisanal: 'Artisanal', mechanized: 'Mécanisé', ai_automated: 'Automatisé IA' },
  en: { artisanal: 'Artisanal', mechanized: 'Mechanized', ai_automated: 'AI Automated' },
};

const PRODUCT_LABELS: Record<L, Record<string, string>> = {
  fr: {
    cacao: 'Cacao',
    cafe: 'Café',
    textile: 'Textile coton',
    anacarde: 'Anacarde',
    huile_palme: 'Huile de palme',
    mangue: 'Mangue',
  },
  en: {
    cacao: 'Cocoa',
    cafe: 'Coffee',
    textile: 'Cotton textile',
    anacarde: 'Cashew',
    huile_palme: 'Palm oil',
    mangue: 'Mango',
  },
};

// ─── Types ─────────────────────────────────────────────────────────────────
type Scenario = 'artisanal' | 'mechanized' | 'ai_automated';

interface ScenarioBlock {
  scenario: Scenario;
  label: string;
  description: string;
  capex_eur: number;
  opex_year_eur: number;
  revenue_year_eur: number;
  gross_margin_pct: number;
  net_margin_pct: number;
  payback_months: number;
  roi_3y_pct: number;
  employees: number;
  land_required_m2: number;
  production_capacity_tonnes_year: number;
  machinery_list?: Array<{ name: string; cost_eur: number; origin: string }>;
  quality_output: 'entry' | 'mid' | 'premium';
  advantages: string[];
  disadvantages: string[];
  risk_level: 'low' | 'medium' | 'high';
}

interface EnrichedPlan {
  country_iso: string;
  product: string;
  generated_at: string;
  executive_summary: string;
  market_study: {
    market_size_eur: number;
    growth_rate_pct: number;
    key_players: string[];
    demand_drivers: string[];
    barriers_to_entry: string[];
    regulations: Array<{ category: string; title: string; detail: string }>;
    logistics_corridors: Array<{ mode: string; cost_eur: number; transit_days: number }>;
    insights_from_field: string[];
  };
  scenarios: {
    artisanal: ScenarioBlock;
    mechanized: ScenarioBlock;
    ai_automated: ScenarioBlock;
  };
  scenarios_comparison: {
    best_for_low_capital: Scenario;
    best_for_speed: Scenario;
    best_for_margin: Scenario;
    average_capex_eur: number;
    average_roi_3y_pct: number;
    recommended_scenario: Scenario;
    recommendation_rationale: string;
  };
  action_plan: Array<{
    phase: number;
    name: string;
    duration_months: number;
    milestones: string[];
    budget_eur: number;
  }>;
  risks: Array<{
    risk: string;
    probability: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    mitigation: string;
  }>;
  precision_form_prompts: string[];
}

interface PrecisionInputs {
  target_volume_tonnes?: number;
  budget_eur?: number;
  team_size?: number;
  expertise_level?: 'novice' | 'intermediate' | 'expert';
  target_region?: string;
  horizon_years?: number;
  quality_tier?: 'entry' | 'mid' | 'premium';
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function fmtEur(v: number | undefined | null): string {
  if (v == null) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)} Md€`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)} M€`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)} k€`;
  return `${v.toFixed(0)} €`;
}

function fmtM2(v: number | undefined): string {
  if (v == null) return '—';
  if (v >= 1e6) return `${(v / 1e4).toFixed(0)} ha`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(1)} ha`;
  return `${v.toLocaleString()} m²`;
}

const SCENARIO_META: Record<Scenario, { emoji: string; label: string; color: string; gradient: string }> = {
  artisanal: {
    emoji: '🛠️',
    label: 'Artisanal',
    color: 'border-amber-500',
    gradient: 'from-amber-900/40 to-amber-950/80',
  },
  mechanized: {
    emoji: '⚙️',
    label: 'Industriel mécanisé',
    color: 'border-blue-500',
    gradient: 'from-blue-900/40 to-blue-950/80',
  },
  ai_automated: {
    emoji: '🤖',
    label: 'Automatisé IA',
    color: 'border-purple-500',
    gradient: 'from-purple-900/40 to-purple-950/80',
  },
};

const PRODUCT_SLUGS = ['cacao', 'cafe', 'textile', 'anacarde', 'huile_palme', 'mangue'];

const OPERATION_MODES = [
  { id: 'import_sell', icon: '📦', titleKey: 'modeImportSellTitle', descKey: 'modeImportSellDesc', color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/40' },
  { id: 'produce_locally', icon: '🏭', titleKey: 'modeProduceLocallyTitle', descKey: 'modeProduceLocallyDesc', color: 'from-amber-500/20 to-orange-500/10 border-amber-500/40' },
  { id: 'train_locals', icon: '🎓', titleKey: 'modeTrainLocalsTitle', descKey: 'modeTrainLocalsDesc', color: 'from-purple-500/20 to-pink-500/10 border-purple-500/40' },
] as const;

type ModeKey = typeof OPERATION_MODES[number]['titleKey'] | typeof OPERATION_MODES[number]['descKey'];

// ─── Page ───────────────────────────────────────────────────────────────────
export default function EnrichedPlanPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { lang } = useLang();
  const L: L = lang === 'en' ? 'en' : 'fr';
  const t = tx(L);
  const iso = (params.iso as string)?.toUpperCase() ?? 'CIV';
  const initialProduct = searchParams.get('product') ?? 'cacao';

  const [productSlug, setProductSlug] = useState(initialProduct);
  const [plan, setPlan] = useState<EnrichedPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrecisionForm, setShowPrecisionForm] = useState(false);
  const [precision, setPrecision] = useState<PrecisionInputs>({});
  const [userTier, setUserTier] = useState<string>('free');
  const [selectedModes, setSelectedModes] = useState<Set<string>>(new Set());
  const [modesConfirmed, setModesConfirmed] = useState(false);

  // Fetch user tier
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase.from('profiles').select('tier').eq('id', data.user.id).single();
      if (profile?.tier) setUserTier(profile.tier);
    });
  }, []);

  // Restore modes from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`ftg_journey_${iso}`);
      if (saved) {
        const data = JSON.parse(saved);
        if (Array.isArray(data.selected_modes) && data.selected_modes.length > 0) {
          setSelectedModes(new Set(data.selected_modes));
          setModesConfirmed(true);
        }
      }
    } catch {}
  }, [iso]);

  async function loadPlan(applyPrecision = false) {
    setLoading(true);
    setError(null);
    try {
      const res = applyPrecision
        ? await fetch('/api/reports/enriched-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country: iso, product: productSlug, precision, lang: L }),
          })
        : await fetch(`/api/reports/enriched-plan?country=${iso}&product=${productSlug}&lang=${L}`);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as EnrichedPlan;
      setPlan(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!modesConfirmed) return;
    loadPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso, productSlug, L, modesConfirmed]);

  const toggleMode = (id: string) => {
    setSelectedModes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmModes = () => {
    if (selectedModes.size === 0) return;
    try {
      const existing = JSON.parse(localStorage.getItem(`ftg_journey_${iso}`) ?? '{}');
      localStorage.setItem(
        `ftg_journey_${iso}`,
        JSON.stringify({ ...existing, selected_modes: Array.from(selectedModes) }),
      );
    } catch {}
    setModesConfirmed(true);
  };

  const resetModes = () => {
    setModesConfirmed(false);
    setPlan(null);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Topbar />
      <JourneySidebar iso={iso} currentStep="business_plan" userTier={userTier} />

      <div className="lg:pl-64 w-full">
      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <Link href={`/country/${iso}`} className="hover:text-amber-400">
              ← {t('back')} {iso}
            </Link>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            {t('title')} — {iso}
          </h1>
          <p className="text-gray-400">{t('subtitle')}</p>
        </div>

        {/* Product selector */}
        <div className="mb-8 flex flex-wrap gap-2">
          {PRODUCT_SLUGS.map((slug) => (
            <button
              key={slug}
              onClick={() => setProductSlug(slug)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                productSlug === slug
                  ? 'bg-amber-500 text-gray-950'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {PRODUCT_LABELS[L][slug] ?? slug}
            </button>
          ))}
        </div>

        {/* Mode selection — shown before plan generation */}
        {!modesConfirmed && (
          <section className="mb-8">
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 border border-amber-500/30 rounded-2xl p-6 sm:p-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-amber-400 mb-2 text-center">
                {t('chooseModesTitle')}
              </h2>
              <p className="text-gray-400 text-center mb-8">{t('chooseModesSubtitle')}</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {OPERATION_MODES.map((mode) => {
                  const checked = selectedModes.has(mode.id);
                  return (
                    <button
                      key={mode.id}
                      onClick={() => toggleMode(mode.id)}
                      className={`relative text-left rounded-2xl p-5 border-2 transition-all bg-gradient-to-br ${mode.color} ${
                        checked
                          ? 'ring-2 ring-amber-400 scale-[1.02]'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-md flex items-center justify-center"
                        style={{
                          background: checked ? '#C9A84C' : 'rgba(255,255,255,0.05)',
                          border: checked ? '2px solid #C9A84C' : '2px solid rgba(255,255,255,0.15)',
                        }}
                      >
                        {checked && <span className="text-gray-950 text-xs font-bold">✓</span>}
                      </div>
                      <div className="text-4xl mb-3">{mode.icon}</div>
                      <h3 className="text-lg font-bold text-white mb-1">
                        {TR[mode.titleKey][L]}
                      </h3>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        {TR[mode.descKey][L]}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="text-center">
                {selectedModes.size === 0 ? (
                  <p className="text-xs text-gray-500 mb-3">{t('atLeastOne')}</p>
                ) : (
                  <p className="text-xs text-gray-400 mb-3">
                    {t('selectedModes')}: <span className="text-amber-400 font-semibold">{selectedModes.size}</span>
                  </p>
                )}
                <button
                  onClick={confirmModes}
                  disabled={selectedModes.size === 0}
                  className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-gray-950 font-bold rounded-xl text-base hover:scale-[1.02] transition-transform disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  ✨ {t('generatePlan')}
                </button>
              </div>
            </div>
          </section>
        )}

        {modesConfirmed && (
          <div className="mb-4 flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-lg px-4 py-2">
            <div className="text-xs text-gray-400">
              {t('selectedModes')}:{' '}
              {Array.from(selectedModes).map((m) => {
                const mode = OPERATION_MODES.find((o) => o.id === m);
                return mode ? `${mode.icon} ${TR[mode.titleKey][L]}` : m;
              }).join(' · ')}
            </div>
            <button onClick={resetModes} className="text-xs text-amber-400 hover:text-amber-300">
              {t('changeModes')}
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mb-4" />
            <p className="text-gray-400">{t('generating')}</p>
            <p className="text-gray-500 text-sm mt-2">{t('generatingDesc')}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400 font-medium">{t('error')} : {error}</p>
            <button
              onClick={() => loadPlan()}
              className="mt-2 text-sm text-red-300 underline"
            >
              {t('retry')}
            </button>
          </div>
        )}

        {plan && !loading && (
          <div className="space-y-10">
            {/* Executive Summary */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-amber-400">{t('execSummary')}</h2>
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 leading-relaxed whitespace-pre-line">
                {plan.executive_summary}
              </div>
            </section>

            {/* Market Study */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-amber-400">{t('marketStudy')}</h2>
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-6">
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-2.5 md:p-4 min-w-0">
                  <div className="text-[10px] md:text-xs text-gray-400 uppercase leading-tight">{t('marketSize')}</div>
                  <div className="text-sm md:text-xl font-bold text-amber-400 mt-0.5 md:mt-1 leading-tight">
                    {fmtEur(plan.market_study.market_size_eur)}
                  </div>
                </div>
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-2.5 md:p-4 min-w-0">
                  <div className="text-[10px] md:text-xs text-gray-400 uppercase leading-tight">{t('annualGrowth')}</div>
                  <div className="text-sm md:text-xl font-bold text-green-400 mt-0.5 md:mt-1 leading-tight">
                    +{plan.market_study.growth_rate_pct}%
                  </div>
                </div>
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-2.5 md:p-4 min-w-0">
                  <div className="text-[10px] md:text-xs text-gray-400 uppercase leading-tight">{t('keyPlayers')}</div>
                  <div className="text-sm md:text-xl font-bold mt-0.5 md:mt-1 leading-tight">
                    {plan.market_study.key_players?.length ?? 0}
                  </div>
                </div>
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-2.5 md:p-4 min-w-0">
                  <div className="text-[10px] md:text-xs text-gray-400 uppercase leading-tight">{t('regulations')}</div>
                  <div className="text-sm md:text-xl font-bold mt-0.5 md:mt-1 leading-tight">
                    {plan.market_study.regulations?.length ?? 0}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
                  <h3 className="font-semibold mb-3 text-gray-200">{t('demandDrivers')}</h3>
                  <ul className="space-y-2 text-sm text-gray-300">
                    {plan.market_study.demand_drivers?.map((d, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-green-400">↗</span> {d}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
                  <h3 className="font-semibold mb-3 text-gray-200">{t('barriers')}</h3>
                  <ul className="space-y-2 text-sm text-gray-300">
                    {plan.market_study.barriers_to_entry?.map((b, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-orange-400">⚠</span> {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {plan.market_study.insights_from_field?.length > 0 && (
                <div className="mt-4 bg-gray-900/60 border border-gray-800 rounded-xl p-5">
                  <h3 className="font-semibold mb-3 text-gray-200">{t('fieldInsights')}</h3>
                  <ul className="space-y-2 text-sm text-gray-300">
                    {plan.market_study.insights_from_field.map((ins, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-amber-400">›</span> {ins}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* 🎯 3-scenario comparator — the heart of the document */}
            <section>
              <h2 className="text-2xl font-bold mb-2 text-amber-400">{t('scenariosTitle')}</h2>
              <p className="text-gray-400 text-sm mb-6">{t('scenariosDesc')}</p>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {(['artisanal', 'mechanized', 'ai_automated'] as Scenario[]).map((key) => {
                  const sc = plan.scenarios[key];
                  const meta = SCENARIO_META[key];
                  const recommended = plan.scenarios_comparison.recommended_scenario === key;

                  return (
                    <div
                      key={key}
                      className={`relative bg-gradient-to-br ${meta.gradient} border-2 ${
                        recommended ? 'border-amber-400 ring-2 ring-amber-400/30' : meta.color
                      } rounded-2xl p-6`}
                    >
                      {recommended && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-gray-950 px-3 py-1 rounded-full text-xs font-bold">
                          ⭐ {t('recommended')}
                        </div>
                      )}

                      <div className="text-center mb-4">
                        <div className="text-4xl mb-2">{meta.emoji}</div>
                        <h3 className="text-xl font-bold">{sc.label || SCENARIO_LABELS[L][key]}</h3>
                        <p className="text-xs text-gray-300 mt-1 min-h-[32px]">{sc.description}</p>
                      </div>

                      {/* Financials */}
                      <div className="space-y-2 mb-4 text-sm">
                        <Metric label={t('capex')} value={fmtEur(sc.capex_eur)} highlight />
                        <Metric label={t('opex')} value={fmtEur(sc.opex_year_eur)} />
                        <Metric label={t('revenue')} value={fmtEur(sc.revenue_year_eur)} />
                        <Metric label={t('grossMargin')} value={`${sc.gross_margin_pct}%`} color="text-green-400" />
                        <Metric label={t('roi3y')} value={`${sc.roi_3y_pct}%`} color="text-green-400" />
                        <Metric label={t('payback')} value={`${sc.payback_months} ${t('paybackUnit')}`} />
                      </div>

                      <div className="border-t border-gray-700 pt-3 space-y-1 text-xs text-gray-300 mb-4">
                        <div>👥 {sc.employees} {t('employees')}</div>
                        <div>📐 {fmtM2(sc.land_required_m2)}</div>
                        <div>📦 {sc.production_capacity_tonnes_year} {t('tonnesYear')} <span className="capitalize text-amber-300">{sc.quality_output}</span></div>
                        <div>⚠️ {t('risk')} : <span className={
                          sc.risk_level === 'low' ? 'text-green-400' :
                          sc.risk_level === 'medium' ? 'text-yellow-400' : 'text-red-400'
                        }>{sc.risk_level}</span></div>
                      </div>

                      {/* Advantages */}
                      <div className="mb-3">
                        <div className="text-xs font-semibold text-green-400 uppercase mb-1">{t('advantages')}</div>
                        <ul className="text-xs text-gray-300 space-y-1">
                          {sc.advantages?.slice(0, 3).map((a, i) => (
                            <li key={i}>• {a}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Disadvantages */}
                      <div>
                        <div className="text-xs font-semibold text-orange-400 uppercase mb-1">{t('disadvantages')}</div>
                        <ul className="text-xs text-gray-300 space-y-1">
                          {sc.disadvantages?.slice(0, 3).map((d, i) => (
                            <li key={i}>• {d}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recommendation explanation */}
              <div className="mt-6 bg-amber-950/30 border border-amber-500/50 rounded-xl p-5">
                <h3 className="font-bold text-amber-400 mb-2">
                  ⭐ {t('recommendedScenario')} : {SCENARIO_META[plan.scenarios_comparison.recommended_scenario]?.emoji} {SCENARIO_LABELS[L][plan.scenarios_comparison.recommended_scenario]}
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {plan.scenarios_comparison.recommendation_rationale}
                </p>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-gray-900/60 rounded px-3 py-2">
                    {t('cheapest')} : <strong className="text-amber-400">{SCENARIO_LABELS[L][plan.scenarios_comparison.best_for_low_capital]}</strong>
                  </div>
                  <div className="bg-gray-900/60 rounded px-3 py-2">
                    {t('fastest')} : <strong className="text-amber-400">{SCENARIO_LABELS[L][plan.scenarios_comparison.best_for_speed]}</strong>
                  </div>
                  <div className="bg-gray-900/60 rounded px-3 py-2">
                    {t('bestMargin')} : <strong className="text-amber-400">{SCENARIO_LABELS[L][plan.scenarios_comparison.best_for_margin]}</strong>
                  </div>
                  <div className="bg-gray-900/60 rounded px-3 py-2">
                    {t('avgCapex')} : <strong className="text-amber-400">{fmtEur(plan.scenarios_comparison.average_capex_eur)}</strong>
                  </div>
                </div>
              </div>
            </section>

            {/* Precision Form */}
            <section>
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-amber-400">{t('refineTitle')}</h2>
                    <p className="text-sm text-gray-400">{t('refineDesc')}</p>
                  </div>
                  <button
                    onClick={() => setShowPrecisionForm(!showPrecisionForm)}
                    className="text-sm bg-amber-500 text-gray-950 font-semibold px-4 py-2 rounded-lg hover:bg-amber-400"
                  >
                    {showPrecisionForm ? t('hide') : t('openForm')}
                  </button>
                </div>

                {showPrecisionForm && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      loadPlan(true);
                    }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <Input
                      label={t('targetVolume')}
                      type="number"
                      value={precision.target_volume_tonnes?.toString() ?? ''}
                      onChange={(v) => setPrecision({ ...precision, target_volume_tonnes: v ? Number(v) : undefined })}
                    />
                    <Input
                      label={t('budget')}
                      type="number"
                      value={precision.budget_eur?.toString() ?? ''}
                      onChange={(v) => setPrecision({ ...precision, budget_eur: v ? Number(v) : undefined })}
                    />
                    <Input
                      label={t('teamSize')}
                      type="number"
                      value={precision.team_size?.toString() ?? ''}
                      onChange={(v) => setPrecision({ ...precision, team_size: v ? Number(v) : undefined })}
                    />
                    <Input
                      label={t('region')}
                      value={precision.target_region ?? ''}
                      onChange={(v) => setPrecision({ ...precision, target_region: v || undefined })}
                    />
                    <Select
                      label={t('expertise')}
                      value={precision.expertise_level ?? ''}
                      options={[
                        { value: '', label: t('selectPlaceholder') },
                        { value: 'novice', label: t('novice') },
                        { value: 'intermediate', label: t('intermediate') },
                        { value: 'expert', label: t('expert') },
                      ]}
                      onChange={(v) => setPrecision({ ...precision, expertise_level: (v || undefined) as PrecisionInputs['expertise_level'] })}
                    />
                    <Select
                      label={t('targetQuality')}
                      value={precision.quality_tier ?? ''}
                      options={[
                        { value: '', label: t('selectPlaceholder') },
                        { value: 'entry', label: t('entryQ') },
                        { value: 'mid', label: t('midQ') },
                        { value: 'premium', label: t('premiumQ') },
                      ]}
                      onChange={(v) => setPrecision({ ...precision, quality_tier: (v || undefined) as PrecisionInputs['quality_tier'] })}
                    />
                    <Input
                      label={t('horizon')}
                      type="number"
                      value={precision.horizon_years?.toString() ?? ''}
                      onChange={(v) => setPrecision({ ...precision, horizon_years: v ? Number(v) : undefined })}
                    />
                    <div className="md:col-span-2 flex gap-2 mt-2">
                      <button
                        type="submit"
                        className="bg-amber-500 text-gray-950 font-semibold px-6 py-2 rounded-lg hover:bg-amber-400"
                      >
                        {t('regenerate')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrecision({})}
                        className="text-sm text-gray-400 hover:text-gray-200 px-4 py-2"
                      >
                        {t('clear')}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </section>

            {/* Action Plan */}
            {plan.action_plan?.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-4 text-amber-400">{t('actionPlan')}</h2>
                <div className="space-y-3">
                  {plan.action_plan.map((phase) => (
                    <div key={phase.phase} className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-xs text-gray-500 uppercase">{t('phase')} {phase.phase}</div>
                          <h3 className="text-lg font-semibold">{phase.name}</h3>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">{t('budgetLabel')}</div>
                          <div className="text-amber-400 font-semibold">{fmtEur(phase.budget_eur)}</div>
                          <div className="text-xs text-gray-500 mt-1">{phase.duration_months} {t('months')}</div>
                        </div>
                      </div>
                      <ul className="mt-3 text-sm text-gray-300 space-y-1">
                        {phase.milestones?.map((m, i) => (
                          <li key={i}>• {m}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Risks */}
            {plan.risks?.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-4 text-amber-400">{t('risksTitle')}</h2>
                <div className="space-y-3">
                  {plan.risks.map((r, i) => (
                    <div key={i} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{r.risk}</h3>
                            <RiskBadge label={`P: ${r.probability}`} level={r.probability} />
                            <RiskBadge label={`I: ${r.impact}`} level={r.impact} />
                          </div>
                          <p className="text-sm text-gray-400">
                            <span className="text-green-400">{t('mitigation')} :</span> {r.mitigation}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Footer */}
            <footer className="text-xs text-gray-500 border-t border-gray-800 pt-4">
              {t('footer')} {new Date(plan.generated_at).toLocaleString(L === 'en' ? 'en-US' : 'fr-FR')} • {t('poweredBy')}
            </footer>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────
function Metric({ label, value, highlight, color }: {
  label: string;
  value: string;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className={`${highlight ? 'text-lg' : 'text-sm'} font-semibold ${color ?? 'text-gray-100'}`}>
        {value}
      </span>
    </div>
  );
}

function Input({ label, type = 'text', value, onChange }: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-gray-400 uppercase">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
      />
    </label>
  );
}

function Select({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-gray-400 uppercase">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RiskBadge({ label, level }: { label: string; level: 'low' | 'medium' | 'high' }) {
  const classes = {
    low: 'bg-green-900/40 text-green-400',
    medium: 'bg-yellow-900/40 text-yellow-400',
    high: 'bg-red-900/40 text-red-400',
  }[level];
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded ${classes}`}>
      {label}
    </span>
  );
}
