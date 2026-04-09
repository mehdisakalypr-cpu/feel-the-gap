'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Topbar from '@/components/Topbar';

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

const PRODUCT_OPTIONS = [
  { slug: 'cacao', label: 'Cacao' },
  { slug: 'cafe', label: 'Café' },
  { slug: 'textile', label: 'Textile coton' },
  { slug: 'anacarde', label: 'Anacarde' },
  { slug: 'huile_palme', label: 'Huile de palme' },
  { slug: 'mangue', label: 'Mangue' },
];

// ─── Page ───────────────────────────────────────────────────────────────────
export default function EnrichedPlanPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const iso = (params.iso as string)?.toUpperCase() ?? 'CIV';
  const initialProduct = searchParams.get('product') ?? 'cacao';

  const [productSlug, setProductSlug] = useState(initialProduct);
  const [plan, setPlan] = useState<EnrichedPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrecisionForm, setShowPrecisionForm] = useState(false);
  const [precision, setPrecision] = useState<PrecisionInputs>({});

  async function loadPlan(applyPrecision = false) {
    setLoading(true);
    setError(null);
    try {
      const res = applyPrecision
        ? await fetch('/api/reports/enriched-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country: iso, product: productSlug, precision }),
          })
        : await fetch(`/api/reports/enriched-plan?country=${iso}&product=${productSlug}`);

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
    loadPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso, productSlug]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Topbar />

      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <Link href={`/country/${iso}`} className="hover:text-amber-400">
              ← Retour pays {iso}
            </Link>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            Business Plan Enrichi — {iso}
          </h1>
          <p className="text-gray-400">
            Plan complet avec 3 scénarios comparés (artisanal, mécanisé, IA) — données issues de la recherche YouTube, réglementaire et coûts marché.
          </p>
        </div>

        {/* Product selector */}
        <div className="mb-8 flex flex-wrap gap-2">
          {PRODUCT_OPTIONS.map((p) => (
            <button
              key={p.slug}
              onClick={() => setProductSlug(p.slug)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                productSlug === p.slug
                  ? 'bg-amber-500 text-gray-950'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mb-4" />
            <p className="text-gray-400">Génération du business plan enrichi…</p>
            <p className="text-gray-500 text-sm mt-2">Analyse des données YouTube, réglementation, coûts production et logistique</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400 font-medium">Erreur : {error}</p>
            <button
              onClick={() => loadPlan()}
              className="mt-2 text-sm text-red-300 underline"
            >
              Réessayer
            </button>
          </div>
        )}

        {plan && !loading && (
          <div className="space-y-10">
            {/* Executive Summary */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-amber-400">Résumé exécutif</h2>
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 leading-relaxed whitespace-pre-line">
                {plan.executive_summary}
              </div>
            </section>

            {/* Market Study */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-amber-400">Étude de marché</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-400 uppercase">Taille marché</div>
                  <div className="text-xl font-bold text-amber-400 mt-1">
                    {fmtEur(plan.market_study.market_size_eur)}
                  </div>
                </div>
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-400 uppercase">Croissance annuelle</div>
                  <div className="text-xl font-bold text-green-400 mt-1">
                    +{plan.market_study.growth_rate_pct}%
                  </div>
                </div>
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-400 uppercase">Acteurs clés</div>
                  <div className="text-xl font-bold mt-1">
                    {plan.market_study.key_players?.length ?? 0}
                  </div>
                </div>
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-400 uppercase">Réglementations</div>
                  <div className="text-xl font-bold mt-1">
                    {plan.market_study.regulations?.length ?? 0}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
                  <h3 className="font-semibold mb-3 text-gray-200">Moteurs de demande</h3>
                  <ul className="space-y-2 text-sm text-gray-300">
                    {plan.market_study.demand_drivers?.map((d, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-green-400">↗</span> {d}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
                  <h3 className="font-semibold mb-3 text-gray-200">Barrières à l'entrée</h3>
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
                  <h3 className="font-semibold mb-3 text-gray-200">💡 Insights terrain (vidéos YouTube)</h3>
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
              <h2 className="text-2xl font-bold mb-2 text-amber-400">
                Comparatif des 3 scénarios
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                Avantages, inconvénients et projections financières — recommandation IA en bas.
              </p>

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
                          ⭐ RECOMMANDÉ
                        </div>
                      )}

                      <div className="text-center mb-4">
                        <div className="text-4xl mb-2">{meta.emoji}</div>
                        <h3 className="text-xl font-bold">{sc.label || meta.label}</h3>
                        <p className="text-xs text-gray-300 mt-1 min-h-[32px]">{sc.description}</p>
                      </div>

                      {/* Financials */}
                      <div className="space-y-2 mb-4 text-sm">
                        <Metric label="CapEx" value={fmtEur(sc.capex_eur)} highlight />
                        <Metric label="OpEx/an" value={fmtEur(sc.opex_year_eur)} />
                        <Metric label="Revenus/an" value={fmtEur(sc.revenue_year_eur)} />
                        <Metric label="Marge brute" value={`${sc.gross_margin_pct}%`} color="text-green-400" />
                        <Metric label="ROI 3 ans" value={`${sc.roi_3y_pct}%`} color="text-green-400" />
                        <Metric label="Payback" value={`${sc.payback_months} mois`} />
                      </div>

                      <div className="border-t border-gray-700 pt-3 space-y-1 text-xs text-gray-300 mb-4">
                        <div>👥 {sc.employees} employés</div>
                        <div>📐 {fmtM2(sc.land_required_m2)}</div>
                        <div>📦 {sc.production_capacity_tonnes_year} t/an — qualité <span className="capitalize text-amber-300">{sc.quality_output}</span></div>
                        <div>⚠️ Risque : <span className={
                          sc.risk_level === 'low' ? 'text-green-400' :
                          sc.risk_level === 'medium' ? 'text-yellow-400' : 'text-red-400'
                        }>{sc.risk_level}</span></div>
                      </div>

                      {/* Advantages */}
                      <div className="mb-3">
                        <div className="text-xs font-semibold text-green-400 uppercase mb-1">✓ Avantages</div>
                        <ul className="text-xs text-gray-300 space-y-1">
                          {sc.advantages?.slice(0, 3).map((a, i) => (
                            <li key={i}>• {a}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Disadvantages */}
                      <div>
                        <div className="text-xs font-semibold text-orange-400 uppercase mb-1">✗ Inconvénients</div>
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
                  ⭐ Scénario recommandé : {SCENARIO_META[plan.scenarios_comparison.recommended_scenario].emoji} {SCENARIO_META[plan.scenarios_comparison.recommended_scenario].label}
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {plan.scenarios_comparison.recommendation_rationale}
                </p>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-gray-900/60 rounded px-3 py-2">
                    💰 Moins cher : <strong className="text-amber-400">{SCENARIO_META[plan.scenarios_comparison.best_for_low_capital]?.label}</strong>
                  </div>
                  <div className="bg-gray-900/60 rounded px-3 py-2">
                    ⚡ Plus rapide : <strong className="text-amber-400">{SCENARIO_META[plan.scenarios_comparison.best_for_speed]?.label}</strong>
                  </div>
                  <div className="bg-gray-900/60 rounded px-3 py-2">
                    📈 Meilleure marge : <strong className="text-amber-400">{SCENARIO_META[plan.scenarios_comparison.best_for_margin]?.label}</strong>
                  </div>
                  <div className="bg-gray-900/60 rounded px-3 py-2">
                    📊 CapEx moyen : <strong className="text-amber-400">{fmtEur(plan.scenarios_comparison.average_capex_eur)}</strong>
                  </div>
                </div>
              </div>
            </section>

            {/* Precision Form */}
            <section>
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-amber-400">🎯 Affiner le plan</h2>
                    <p className="text-sm text-gray-400">Plus tu remplis ce formulaire, plus ton business plan sera précis.</p>
                  </div>
                  <button
                    onClick={() => setShowPrecisionForm(!showPrecisionForm)}
                    className="text-sm bg-amber-500 text-gray-950 font-semibold px-4 py-2 rounded-lg hover:bg-amber-400"
                  >
                    {showPrecisionForm ? 'Masquer' : 'Ouvrir le formulaire'}
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
                      label="Production annuelle cible (tonnes)"
                      type="number"
                      value={precision.target_volume_tonnes?.toString() ?? ''}
                      onChange={(v) => setPrecision({ ...precision, target_volume_tonnes: v ? Number(v) : undefined })}
                    />
                    <Input
                      label="Budget disponible (EUR)"
                      type="number"
                      value={precision.budget_eur?.toString() ?? ''}
                      onChange={(v) => setPrecision({ ...precision, budget_eur: v ? Number(v) : undefined })}
                    />
                    <Input
                      label="Taille de l'équipe déjà constituée"
                      type="number"
                      value={precision.team_size?.toString() ?? ''}
                      onChange={(v) => setPrecision({ ...precision, team_size: v ? Number(v) : undefined })}
                    />
                    <Input
                      label="Région ciblée (optionnel)"
                      value={precision.target_region ?? ''}
                      onChange={(v) => setPrecision({ ...precision, target_region: v || undefined })}
                    />
                    <Select
                      label="Niveau d'expertise"
                      value={precision.expertise_level ?? ''}
                      options={[
                        { value: '', label: '— sélectionner —' },
                        { value: 'novice', label: 'Novice' },
                        { value: 'intermediate', label: 'Intermédiaire' },
                        { value: 'expert', label: 'Expert' },
                      ]}
                      onChange={(v) => setPrecision({ ...precision, expertise_level: (v || undefined) as PrecisionInputs['expertise_level'] })}
                    />
                    <Select
                      label="Qualité visée"
                      value={precision.quality_tier ?? ''}
                      options={[
                        { value: '', label: '— sélectionner —' },
                        { value: 'entry', label: 'Entry (bas de gamme)' },
                        { value: 'mid', label: 'Mid (milieu de gamme)' },
                        { value: 'premium', label: 'Premium (haut de gamme)' },
                      ]}
                      onChange={(v) => setPrecision({ ...precision, quality_tier: (v || undefined) as PrecisionInputs['quality_tier'] })}
                    />
                    <Input
                      label="Horizon (années)"
                      type="number"
                      value={precision.horizon_years?.toString() ?? ''}
                      onChange={(v) => setPrecision({ ...precision, horizon_years: v ? Number(v) : undefined })}
                    />
                    <div className="md:col-span-2 flex gap-2 mt-2">
                      <button
                        type="submit"
                        className="bg-amber-500 text-gray-950 font-semibold px-6 py-2 rounded-lg hover:bg-amber-400"
                      >
                        Régénérer avec précisions
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrecision({})}
                        className="text-sm text-gray-400 hover:text-gray-200 px-4 py-2"
                      >
                        Effacer
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </section>

            {/* Action Plan */}
            {plan.action_plan?.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-4 text-amber-400">Plan d'action</h2>
                <div className="space-y-3">
                  {plan.action_plan.map((phase) => (
                    <div key={phase.phase} className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-xs text-gray-500 uppercase">Phase {phase.phase}</div>
                          <h3 className="text-lg font-semibold">{phase.name}</h3>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Budget</div>
                          <div className="text-amber-400 font-semibold">{fmtEur(phase.budget_eur)}</div>
                          <div className="text-xs text-gray-500 mt-1">{phase.duration_months} mois</div>
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
                <h2 className="text-2xl font-bold mb-4 text-amber-400">Risques & mitigation</h2>
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
                            <span className="text-green-400">↳ Mitigation :</span> {r.mitigation}
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
              Généré le {new Date(plan.generated_at).toLocaleString('fr-FR')} • Powered by Gemini 2.5 Flash + recherche YouTube
            </footer>
          </div>
        )}
      </main>
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
