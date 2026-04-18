import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

/**
 * /admin/marketplace — observabilité flywheel Phase 2
 *
 * Server component : pull les KPIs depuis Supabase service role + liste des
 * 20 top matches par score. Tableau simple + bloc résumé GMV / Commission.
 */

type MatchRow = {
  id: string
  match_score: number
  proposed_quantity_kg: number
  proposed_price_eur_per_kg: number
  proposed_total_eur: number
  commission_amount_eur: number
  status: string
  created_at: string
}

type Counts = {
  volumes_total: number; volumes_open: number; volumes_matched: number
  demands_total: number; demands_open: number; demands_matched: number
  matches_total: number; matches_proposed: number; matches_accepted: number; matches_confirmed: number
  gmv_all: number; gmv_confirmed: number; commission_all: number; commission_confirmed: number
}

function fmtEur(v: number): string {
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M €'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k €'
  return v.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €'
}
function fmtKg(v: number): string {
  if (v >= 1000) return (v / 1000).toFixed(1) + ' t'
  return v.toLocaleString('fr-FR') + ' kg'
}

async function loadData(): Promise<{ counts: Counts; top: MatchRow[] }> {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const [volumesCounts, demandsCounts, matchesByStatus, matchesAgg, confirmedAgg, topMatches] = await Promise.all([
    db.from('production_volumes').select('status', { count: 'exact', head: false }),
    db.from('buyer_demands').select('status', { count: 'exact', head: false }),
    db.from('marketplace_matches').select('status'),
    db.from('marketplace_matches').select('proposed_total_eur, commission_amount_eur'),
    db.from('marketplace_matches').select('proposed_total_eur, commission_amount_eur').eq('status', 'confirmed'),
    db.from('marketplace_matches')
      .select('id, match_score, proposed_quantity_kg, proposed_price_eur_per_kg, proposed_total_eur, commission_amount_eur, status, created_at')
      .order('match_score', { ascending: false }).limit(20),
  ])

  const vols = (volumesCounts.data ?? []) as Array<{ status: string }>
  const dems = (demandsCounts.data ?? []) as Array<{ status: string }>
  const mts  = (matchesByStatus.data ?? []) as Array<{ status: string }>
  const allAgg = (matchesAgg.data ?? []) as Array<{ proposed_total_eur: number; commission_amount_eur: number }>
  const confAgg = (confirmedAgg.data ?? []) as Array<{ proposed_total_eur: number; commission_amount_eur: number }>

  const counts: Counts = {
    volumes_total:    vols.length,
    volumes_open:     vols.filter(v => v.status === 'open').length,
    volumes_matched:  vols.filter(v => v.status === 'matched').length,
    demands_total:    dems.length,
    demands_open:     dems.filter(d => d.status === 'open').length,
    demands_matched:  dems.filter(d => d.status === 'matched').length,
    matches_total:    mts.length,
    matches_proposed: mts.filter(m => m.status === 'proposed').length,
    matches_accepted: mts.filter(m => m.status === 'accepted_producer' || m.status === 'accepted_buyer').length,
    matches_confirmed:mts.filter(m => m.status === 'confirmed').length,
    gmv_all:        allAgg.reduce((s, r) => s + (Number(r.proposed_total_eur) || 0), 0),
    gmv_confirmed:  confAgg.reduce((s, r) => s + (Number(r.proposed_total_eur) || 0), 0),
    commission_all:       allAgg.reduce((s, r) => s + (Number(r.commission_amount_eur) || 0), 0),
    commission_confirmed: confAgg.reduce((s, r) => s + (Number(r.commission_amount_eur) || 0), 0),
  }

  return { counts, top: (topMatches.data ?? []) as MatchRow[] }
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposé', accepted_producer: 'Accepté P', accepted_buyer: 'Accepté A',
  confirmed: '🎉 Confirmé', rejected: 'Rejeté', expired: 'Expiré',
}

export default async function AdminMarketplacePage() {
  const { counts, top } = await loadData()
  const acceptanceRate = counts.matches_total
    ? Math.round((counts.matches_confirmed / counts.matches_total) * 100)
    : 0

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <div>
          <div className="text-xs uppercase tracking-wider text-[#C9A84C] mb-2">🌍 MARKETPLACE · ADMIN</div>
          <h1 className="text-3xl font-bold">Flywheel 2.5 %</h1>
          <p className="text-sm text-gray-400 mt-1">Observabilité live : offre × demande × matches × commission réalisée vs potentielle.</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Volumes déclarés"  value={counts.volumes_total.toString()}  sub={`${counts.volumes_open} ouverts · ${counts.volumes_matched} matchés`} />
          <Kpi label="Demandes publiées" value={counts.demands_total.toString()}  sub={`${counts.demands_open} ouvertes · ${counts.demands_matched} matchées`} />
          <Kpi label="Matches générés"   value={counts.matches_total.toString()}  sub={`${counts.matches_proposed} proposés · ${counts.matches_accepted} acceptés · ${counts.matches_confirmed} confirmés`} color="#C9A84C" />
          <Kpi label="Acceptance rate"   value={`${acceptanceRate}%`}              sub={`${counts.matches_confirmed} confirmés / ${counts.matches_total} matches`} color={acceptanceRate > 50 ? '#34D399' : acceptanceRate > 25 ? '#C9A84C' : '#9CA3AF'} />
        </div>

        {/* GMV & commission */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#0D1117] border border-[#C9A84C]/30 rounded-2xl p-6">
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">GMV</div>
            <div className="flex items-baseline gap-4 flex-wrap">
              <div>
                <div className="text-[10px] uppercase text-gray-500">Potentiel (tous matches)</div>
                <div className="text-2xl font-bold text-gray-300">{fmtEur(counts.gmv_all)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-gray-500">Réalisé (confirmés)</div>
                <div className="text-3xl font-bold text-[#C9A84C]">{fmtEur(counts.gmv_confirmed)}</div>
              </div>
            </div>
          </div>
          <div className="bg-[#0D1117] border border-emerald-500/30 rounded-2xl p-6">
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Commission 2.5 %</div>
            <div className="flex items-baseline gap-4 flex-wrap">
              <div>
                <div className="text-[10px] uppercase text-gray-500">Potentielle</div>
                <div className="text-2xl font-bold text-gray-300">{fmtEur(counts.commission_all)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-gray-500">Réalisée</div>
                <div className="text-3xl font-bold text-emerald-400">{fmtEur(counts.commission_confirmed)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Top matches */}
        <section>
          <h2 className="text-xl font-bold mb-3">Top 20 matches</h2>
          <div className="bg-[#0D1117] border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/[.02] text-[10px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3">Score</th>
                  <th className="text-right px-3 py-3">Volume</th>
                  <th className="text-right px-3 py-3">Prix / kg</th>
                  <th className="text-right px-3 py-3">Total</th>
                  <th className="text-right px-3 py-3">Commission</th>
                  <th className="text-left px-3 py-3">Statut</th>
                  <th className="text-right px-4 py-3">Créé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {top.map(m => (
                  <tr key={m.id} className="hover:bg-white/[.02]">
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C]/30 font-bold text-[#C9A84C]">{m.match_score}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">{fmtKg(m.proposed_quantity_kg)}</td>
                    <td className="px-3 py-2.5 text-right">{fmtEur(m.proposed_price_eur_per_kg)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-[#C9A84C]">{fmtEur(m.proposed_total_eur)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-emerald-400">{fmtEur(m.commission_amount_eur)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{STATUS_LABEL[m.status] ?? m.status}</td>
                    <td className="px-4 py-2.5 text-right text-[11px] text-gray-500">{new Date(m.created_at).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
                {top.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-500 text-sm">Aucun match pour l'instant. Lance un seed ou laisse le cron horaire tourner.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-white/5">
          <div>Cron matcher : <code className="text-gray-400">0 * * * *</code> (toutes les heures) · <code className="text-gray-400">/api/cron/marketplace-matcher</code></div>
          <Link href="/marketplace" className="text-[#C9A84C] hover:underline">Voir marketplace public →</Link>
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, color = '#C9A84C' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-[#0D1117] border border-white/10 rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</div>
      <div className="text-3xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}
