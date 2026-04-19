'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useLang } from '@/components/LanguageProvider'

type DossierRow = {
  id: string
  type: 'financement' | 'investissement'
  title: string | null
  amount_eur: number | null
  completion_pct: number | null
  status: string | null
  created_at: string
}

type Tier = 'explorer' | 'data' | 'strategy' | 'premium' | 'enterprise'

const DOSSIER_LIMITS: Record<Tier, { monthly: number | null; oneshot: number | null }> = {
  explorer:  { monthly: 0,    oneshot: 0 },   // doit acheter pack ou upgrade
  data:      { monthly: 1,    oneshot: 3 },
  strategy:  { monthly: 3,    oneshot: null }, // unlimited oneshot pack at same rate
  premium:   { monthly: null, oneshot: null },  // unlimited
  enterprise:{ monthly: null, oneshot: null },
}

function fmtEur(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' M€'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' k€'
  return n.toLocaleString('fr-FR') + ' €'
}

function fmtDate(iso: string, lang: string): string {
  try {
    return new Date(iso).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch { return iso }
}

export default function FundingHomePage() {
  const router = useRouter()
  const { lang } = useLang()
  const fr = lang === 'fr'
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [tier, setTier] = useState<Tier>('explorer')
  const [dossiers, setDossiers] = useState<DossierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    const sb = createSupabaseBrowser()
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setLoading(false); return }
      setUser({ id: data.user.id, email: data.user.email ?? '' })
      const { data: p } = await sb.from('profiles').select('tier').eq('id', data.user.id).single()
      setTier((p?.tier as Tier) ?? 'explorer')
      const { data: rows } = await sb
        .from('funding_dossiers')
        .select('id, type, title, amount_eur, completion_pct, status, created_at')
        .eq('user_id', data.user.id)
        .order('created_at', { ascending: false })
      setDossiers((rows ?? []) as DossierRow[])
      setLoading(false)
    })
  }, [])

  const limits = DOSSIER_LIMITS[tier]
  const thisMonthCount = dossiers.filter(d => {
    const dt = new Date(d.created_at)
    const now = new Date()
    return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear()
  }).length
  const canCreateFree = limits.monthly === null || thisMonthCount < (limits.monthly ?? 0)

  return (
    <div className="min-h-screen bg-[#07090F] text-white">

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-12 pb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold mb-4"
          style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#34D399' }}>
          🏦 {fr ? 'Portail Financement' : 'Funding Portal'}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-3 max-w-3xl">
          {fr ? (
            <>Des dossiers de levée <br />
              <span style={{ background: 'linear-gradient(135deg,#34D399,#60A5FA)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
                prêts pour due diligence
              </span>
            </>
          ) : (
            <>Funding files <br />
              <span style={{ background: 'linear-gradient(135deg,#34D399,#60A5FA)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
                ready for due diligence
              </span>
            </>
          )}
        </h1>
        <p className="text-gray-300 text-base max-w-2xl mb-6">
          {fr
            ? 'Générez des dossiers de financement ou de levée de fonds en 17 sections standards. Banques, business angels, VC, subventions — un seul format adapté à chaque lecteur.'
            : 'Generate full funding or fundraising files covering 17 standard sections. Banks, business angels, VC, grants — one format adapted per reader.'}
        </p>
        <div className="flex flex-wrap gap-3">
          {user ? (
            <button
              onClick={() => setShowNew(true)}
              className="px-6 py-3 rounded-xl font-bold text-sm"
              style={{ background: 'linear-gradient(135deg,#34D399,#10B981)', color: '#07090F' }}
            >
              + {fr ? 'Nouveau dossier' : 'New file'}
            </button>
          ) : (
            <Link href="/auth/login?redirect=/funding"
              className="px-6 py-3 rounded-xl font-bold text-sm"
              style={{ background: 'linear-gradient(135deg,#34D399,#10B981)', color: '#07090F' }}
            >
              {fr ? 'Se connecter pour commencer' : 'Sign in to start'}
            </Link>
          )}
          <Link href="/invest" className="px-6 py-3 rounded-xl font-bold text-sm border border-white/15 hover:bg-white/5 transition-colors">
            {fr ? 'Je suis investisseur →' : 'I am an investor →'}
          </Link>
        </div>
      </section>

      {/* User dossiers */}
      {user && (
        <section className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">{fr ? 'Mes dossiers' : 'My files'}</h2>
            {limits.monthly !== null && (
              <span className="text-xs text-gray-500">
                {thisMonthCount} / {limits.monthly} {fr ? 'ce mois-ci' : 'this month'} ({tier})
              </span>
            )}
            {limits.monthly === null && (
              <span className="text-xs text-[#34D399]">{fr ? 'Illimité' : 'Unlimited'} · {tier}</span>
            )}
          </div>

          {loading ? (
            <div className="text-gray-500 text-sm">{fr ? 'Chargement…' : 'Loading…'}</div>
          ) : dossiers.length === 0 ? (
            <div className="bg-[#0D1117] border border-dashed border-white/10 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-3">📄</div>
              <p className="text-gray-400 text-sm mb-4">
                {fr ? 'Aucun dossier pour l\'instant.' : 'No file yet.'}
              </p>
              <button
                onClick={() => setShowNew(true)}
                className="px-5 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: 'linear-gradient(135deg,#34D399,#10B981)', color: '#07090F' }}
              >
                + {fr ? 'Créer mon premier dossier' : 'Create my first file'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dossiers.map(d => (
                <Link key={d.id} href={`/funding/dossier/${d.id}`}
                  className="block bg-[#0D1117] border border-white/10 rounded-2xl p-5 hover:border-[#34D399]/40 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{
                        background: d.type === 'investissement' ? 'rgba(96,165,250,.12)' : 'rgba(52,211,153,.12)',
                        color: d.type === 'investissement' ? '#60A5FA' : '#34D399',
                      }}
                    >
                      {d.type === 'investissement' ? '📈 Investissement' : '🏦 Financement'}
                    </span>
                    <span className="text-[10px] text-gray-500">{fmtDate(d.created_at, lang)}</span>
                  </div>
                  <h3 className="font-semibold text-white mb-1 text-sm line-clamp-2">
                    {d.title || (fr ? 'Dossier sans titre' : 'Untitled file')}
                  </h3>
                  <div className="text-lg font-bold text-white mb-3">{fmtEur(d.amount_eur)}</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${d.completion_pct ?? 0}%`,
                          background: d.type === 'investissement' ? '#60A5FA' : '#34D399',
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 shrink-0">{d.completion_pct ?? 0}%</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Offer tiers */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-2">{fr ? 'Offres' : 'Plans'}</h2>
        <p className="text-sm text-gray-400 mb-6">
          {fr
            ? 'Chaque dossier = 17 sections, jusqu\'à 150 questions structurées, export PDF investisseur-ready.'
            : '17 standard sections per file, up to 150 structured questions, investor-ready PDF export.'}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { tier: 'pack', title: fr ? 'Pack dossier unique' : 'Single file pack', price: '49€', sub: fr ? 'paiement unique' : 'one-time', perks: [
              fr ? '1 dossier complet' : '1 full file',
              fr ? 'Export PDF investisseur-ready' : 'Investor-ready PDF',
              fr ? 'Structure DD v1 (17 sections)' : 'DD v1 structure (17 sections)',
              fr ? 'Sans abonnement' : 'No subscription',
            ]},
            { tier: 'strategy', title: 'Strategy', price: '99€/mo', sub: fr ? '3 dossiers/mois' : '3 files/month', perks: [
              fr ? '3 dossiers par mois' : '3 files per month',
              fr ? 'Export PDF + variantes bank/VC/grant' : 'PDF export + bank/VC/grant variants',
              fr ? 'Carte deal flow accessible' : 'Access to deal flow map',
              fr ? 'Inclut Data plan' : 'Data plan included',
            ], featured: true },
            { tier: 'premium', title: 'Premium', price: '149€/mo', sub: fr ? 'illimité' : 'unlimited', perks: [
              fr ? 'Dossiers illimités' : 'Unlimited files',
              fr ? 'Funding Boost: +99€ review humaine 24h' : 'Funding Boost: +€99 human review 24h',
              fr ? 'Matching direct investisseurs' : 'Direct investor matching',
              fr ? 'Inclut Strategy plan' : 'Strategy plan included',
            ]},
          ].map(p => (
            <div key={p.tier}
              className={`rounded-2xl p-6 ${p.featured ? 'border-2' : 'border'}`}
              style={{
                background: p.featured ? 'linear-gradient(180deg, rgba(52,211,153,.08), transparent)' : '#0D1117',
                borderColor: p.featured ? '#34D399' : 'rgba(255,255,255,.08)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-white">{p.title}</h3>
                {p.featured && (
                  <span className="text-[10px] font-bold text-[#34D399] bg-[#34D399]/10 px-2 py-0.5 rounded-full">
                    {fr ? 'RECOMMANDÉ' : 'RECOMMENDED'}
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold text-white mb-0.5">{p.price}</div>
              <div className="text-xs text-gray-500 mb-4">{p.sub}</div>
              <ul className="space-y-2 mb-5">
                {p.perks.map(pk => (
                  <li key={pk} className="flex items-start gap-2 text-xs text-gray-300">
                    <span className={p.featured ? 'text-[#34D399]' : 'text-[#60A5FA]'}>✓</span>
                    <span>{pk}</span>
                  </li>
                ))}
              </ul>
              <Link href={p.tier === 'pack' ? '/pricing?pack=funding_single' : `/pricing?plan=${p.tier}`}
                className={`block text-center px-4 py-2.5 rounded-xl font-bold text-sm ${p.featured ? 'bg-[#34D399] text-[#07090F] hover:bg-[#10B981]' : 'bg-white/5 hover:bg-white/10 border border-white/10'} transition-colors`}
              >
                {fr ? 'Choisir' : 'Choose'}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Funding Boost upsell */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <div className="rounded-2xl p-6 md:p-8"
          style={{ background: 'linear-gradient(135deg, rgba(201,168,76,.08), transparent)', border: '1px solid rgba(201,168,76,.25)' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">⚡</span>
            <h3 className="font-bold text-[#C9A84C]">Funding Boost</h3>
          </div>
          <p className="text-sm text-gray-300 mb-4">
            {fr
              ? 'Sur n\'importe quel dossier : review humaine par un expert financier en 24h, optimisation executive summary, coaching par visio 30 min.'
              : 'On any file: human review by a financial expert within 24h, executive summary optimization, 30-min video coaching.'}
          </p>
          <div className="flex items-center gap-4">
            <div className="text-2xl font-bold text-[#C9A84C]">+99€</div>
            <Link href="/pricing?addon=funding_boost"
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#C9A84C] text-[#07090F] hover:bg-[#E8C97A] transition-colors"
            >
              {fr ? 'Ajouter à un dossier' : 'Add to a file'}
            </Link>
          </div>
        </div>
      </section>

      {/* New dossier modal */}
      {showNew && user && (
        <NewDossierModal
          onClose={() => setShowNew(false)}
          canCreateFree={canCreateFree}
          fr={fr}
          onCreated={(id) => {
            setShowNew(false)
            router.push(`/funding/dossier/${id}`)
          }}
        />
      )}
    </div>
  )
}

// ── New dossier modal ─────────────────────────────────────────────────────────

function NewDossierModal({
  onClose,
  canCreateFree,
  fr,
  onCreated,
}: {
  onClose: () => void
  canCreateFree: boolean
  fr: boolean
  onCreated: (id: string) => void
}) {
  const [type, setType] = useState<'financement' | 'investissement'>('financement')
  const [title, setTitle] = useState('')
  const [amountEur, setAmountEur] = useState<string>('50000')
  const [country, setCountry] = useState('')
  const [sector, setSector] = useState('')
  const [stage, setStage] = useState<'idea' | 'mvp' | 'traction' | 'scaling'>('mvp')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!title.trim() || !amountEur) {
      setError(fr ? 'Titre et montant requis' : 'Title and amount required')
      return
    }
    if (!canCreateFree) {
      setError(fr
        ? 'Quota mensuel atteint. Passez en pack 49€ ou upgrade Strategy/Premium.'
        : 'Monthly quota reached. Upgrade or buy a single pack €49.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/funding/dossier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          amount_eur: Number(amountEur),
          country_iso: country.toUpperCase() || undefined,
          sector: sector || undefined,
          stage,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Error')
      if (j.id) onCreated(j.id)
      else throw new Error(fr ? 'Création échouée' : 'Creation failed')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        className="bg-[#0D1117] border border-[rgba(52,211,153,.3)] rounded-2xl p-6 max-w-lg w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-white mb-1">{fr ? 'Nouveau dossier' : 'New file'}</h2>
        <p className="text-sm text-gray-400 mb-5">
          {fr
            ? 'On génère la structure complète (17 sections) adaptée à votre contexte.'
            : 'We generate the full structure (17 sections) adapted to your context.'}
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">{fr ? 'Type' : 'Type'}</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setType('financement')}
                className={`p-3 rounded-xl border text-xs font-semibold transition-all ${type === 'financement' ? 'bg-[#34D399]/10 border-[#34D399] text-[#34D399]' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                🏦 {fr ? 'Financement' : 'Funding'}
                <div className="text-[10px] font-normal opacity-70 mt-0.5">{fr ? 'banque, dette, subvention' : 'bank, debt, grant'}</div>
              </button>
              <button type="button" onClick={() => setType('investissement')}
                className={`p-3 rounded-xl border text-xs font-semibold transition-all ${type === 'investissement' ? 'bg-[#60A5FA]/10 border-[#60A5FA] text-[#60A5FA]' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                📈 {fr ? 'Investissement' : 'Investment'}
                <div className="text-[10px] font-normal opacity-70 mt-0.5">{fr ? 'equity, BA, VC' : 'equity, angels, VC'}</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">{fr ? 'Titre du projet' : 'Project title'}*</label>
            <input
              type="text" required value={title} onChange={e => setTitle(e.target.value)}
              placeholder={fr ? 'Ex: Mini-usine de transformation d\'amandes au Maroc' : 'E.g. Almond processing unit in Morocco'}
              className="w-full px-3 py-2.5 bg-[#111827] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#34D399]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">{fr ? 'Montant (EUR)' : 'Amount (EUR)'}*</label>
              <input
                type="number" required min="1000" step="1000" value={amountEur} onChange={e => setAmountEur(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#111827] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#34D399]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">{fr ? 'Pays (ISO)' : 'Country (ISO)'}</label>
              <input
                type="text" maxLength={3} value={country} onChange={e => setCountry(e.target.value.toUpperCase())}
                placeholder="FRA"
                className="w-full px-3 py-2.5 bg-[#111827] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#34D399]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">{fr ? 'Secteur' : 'Sector'}</label>
              <input
                type="text" value={sector} onChange={e => setSector(e.target.value)}
                placeholder={fr ? 'agro, textile, tech…' : 'agri, textile, tech…'}
                className="w-full px-3 py-2.5 bg-[#111827] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#34D399]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">{fr ? 'Stade' : 'Stage'}</label>
              <select value={stage} onChange={e => setStage(e.target.value as typeof stage)}
                className="w-full px-3 py-2.5 bg-[#111827] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#34D399]"
              >
                <option value="idea">{fr ? 'Idée' : 'Idea'}</option>
                <option value="mvp">MVP</option>
                <option value="traction">{fr ? 'Traction' : 'Traction'}</option>
                <option value="scaling">{fr ? 'Scaling' : 'Scaling'}</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            {error}
          </div>
        )}

        <div className="mt-6 flex gap-2 justify-end">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            {fr ? 'Annuler' : 'Cancel'}
          </button>
          <button type="submit" disabled={submitting}
            className="px-5 py-2 text-sm font-bold rounded-lg bg-[#34D399] text-[#07090F] hover:bg-[#10B981] transition-colors disabled:opacity-50"
          >
            {submitting ? (fr ? 'Création…' : 'Creating…') : (fr ? 'Créer' : 'Create')}
          </button>
        </div>
      </form>
    </div>
  )
}
