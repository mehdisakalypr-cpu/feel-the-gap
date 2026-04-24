// © 2025-2026 Feel The Gap — Admin CRM
// Shaka 2026-04-21 : vue unifiée users + marketplace pipeline + deal rooms + warm network.

import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type AnyRow = Record<string, unknown>

async function getCRM() {
  const admin = supabaseAdmin()

  const [
    { data: users },
    { data: sessions },
    { data: savedSearches },
    { data: upgradeClicks },
    { data: marketplaceMatches },
    { data: marketplaceSubscriptions },
    { data: dealRooms },
    { data: dealRoomLeads },
    { data: warmContacts },
    { data: warmReady },
    dirCnt,
    demosCnt,
    demosSentCnt,
    demosViewedCnt,
    scoutQueueRows,
    dirByCountry,
    dirRecent,
  ] = await Promise.all([
    admin.from('profiles').select('id, email, tier, company, country, is_billed, is_admin, demo_expires_at, created_at').order('created_at', { ascending: false }).limit(100),
    admin.from('user_sessions').select('id, converted, last_seen_at').order('last_seen_at', { ascending: false }).limit(200),
    admin.from('saved_searches').select('id, user_id, name, filters, created_at').order('created_at', { ascending: false }).limit(50),
    admin.from('tracking_events').select('session_id').eq('event_type', 'upgrade_click').limit(500),
    admin.from('marketplace_matches').select('id, status, proposed_total_eur, pricing_tier_label, pricing_tier_fee_eur, created_at, confirmed_at, identities_revealed_at').order('created_at', { ascending: false }).limit(200),
    admin.from('marketplace_subscriptions').select('id, user_id, tier, status, matches_per_month, matches_used_this_period, adjusted_price_eur_cents, created_at').order('created_at', { ascending: false }).limit(100),
    admin.from('deal_rooms').select('id, slug, seller_id, title, is_public, created_at').order('created_at', { ascending: false }).limit(50),
    admin.from('deal_room_leads').select('id, deal_room_id, email, created_at').order('created_at', { ascending: false }).limit(200),
    admin.from('personal_network_contacts').select('id, owner_profile_id, full_name, company, headline, assigned_persona, outreach_status, excluded, last_contact_at, created_at').order('created_at', { ascending: false }).limit(500),
    admin.from('v_warm_network_ready').select('id').limit(10_000),
    admin.from('entrepreneurs_directory').select('*', { count: 'exact', head: true }),
    admin.from('entrepreneur_demos').select('*', { count: 'exact', head: true }),
    admin.from('entrepreneur_demos').select('*', { count: 'exact', head: true }).not('outreach_sent_at', 'is', null),
    admin.from('entrepreneur_demos').select('*', { count: 'exact', head: true }).eq('status', 'viewed'),
    admin.from('scout_queue').select('status').limit(20000),
    admin.from('entrepreneurs_directory').select('country_iso').limit(20000),
    admin.from('entrepreneurs_directory').select('id, name, country_iso, sector, city, created_at, source').order('created_at', { ascending: false }).limit(15),
  ])

  const upgradeSet = new Set(((upgradeClicks ?? []) as AnyRow[]).map(e => String(e.session_id)))

  const sq = (scoutQueueRows.data ?? []) as AnyRow[]
  const scoutByStatus: Record<string, number> = { pending: 0, running: 0, done: 0, failed: 0 }
  for (const r of sq) scoutByStatus[String(r.status)] = (scoutByStatus[String(r.status)] ?? 0) + 1

  const byCountry: Record<string, number> = {}
  for (const r of (dirByCountry.data ?? []) as AnyRow[]) {
    const iso = String(r.country_iso ?? '??')
    byCountry[iso] = (byCountry[iso] ?? 0) + 1
  }
  const topCountries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10)

  return {
    users: users ?? [],
    sessions: sessions ?? [],
    savedSearches: savedSearches ?? [],
    upgradeSet,
    marketplaceMatches: marketplaceMatches ?? [],
    marketplaceSubscriptions: marketplaceSubscriptions ?? [],
    dealRooms: dealRooms ?? [],
    dealRoomLeads: dealRoomLeads ?? [],
    warmContacts: warmContacts ?? [],
    warmReadyCount: (warmReady ?? []).length,
    prospects: {
      directoryTotal: dirCnt.count ?? 0,
      demosTotal: demosCnt.count ?? 0,
      demosSent: demosSentCnt.count ?? 0,
      demosViewed: demosViewedCnt.count ?? 0,
      scoutByStatus,
      topCountries,
      recent: (dirRecent.data ?? []) as AnyRow[],
    },
  }
}

const TIER_COLOR: Record<string, string> = {
  free: '#6B7280', basic: '#60A5FA', standard: '#C9A84C', premium: '#A78BFA', enterprise: '#64748B',
}

const STATUS_COLOR: Record<string, string> = {
  proposed:           '#F59E0B',
  counter_proposed:   '#60A5FA',
  accepted_producer:  '#F59E0B',
  accepted_buyer:     '#F59E0B',
  confirmed:          '#10B981',
  paid:               '#10B981',
  rejected:           '#EF4444',
  expired:            '#6B7280',
}

const STATUS_LABEL: Record<string, string> = {
  proposed:           '🟠 Proposé',
  counter_proposed:   '🔵 Contre-offre',
  accepted_producer:  '🟠 Producer ok',
  accepted_buyer:     '🟠 Buyer ok',
  confirmed:          '🟢 Confirmé',
  paid:               '🟢 Payé',
  rejected:           '🔴 Refusé',
  expired:            '⚪ Expiré',
}

function Kpi({ label, value, hint, color }: { label: string; value: string | number; hint?: string; color?: string }) {
  return (
    <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5">
      <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold" style={{ color: color ?? '#C9A84C' }}>
        {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
      </p>
      {hint && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

function Section({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function sumCents(rows: AnyRow[], key: string): number {
  return rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0)
}

export default async function CRMPage() {
  const data = await getCRM()
  const {
    users, sessions, savedSearches, upgradeSet,
    marketplaceMatches, marketplaceSubscriptions,
    dealRooms, dealRoomLeads,
    warmContacts, warmReadyCount,
    prospects,
  } = data

  const TARGET_PROSPECTS = 500_000
  const pipelineTotal = prospects.directoryTotal + prospects.demosTotal
  const pctToTarget = Math.min(100, (pipelineTotal / TARGET_PROSPECTS) * 100)
  const funnelStages = [
    { label: '🎯 Scoutés DB', value: pipelineTotal, color: '#C9A84C' },
    { label: '📧 Avec contact', value: prospects.demosTotal, color: '#60A5FA' },
    { label: '✉️ Contactés', value: prospects.demosSent, color: '#A78BFA' },
    { label: '👁️ Démo vue', value: prospects.demosViewed, color: '#10B981' },
    { label: '✅ Signups', value: users.length, color: '#F59E0B' },
    { label: '💰 Marketplace', value: (marketplaceMatches as AnyRow[]).length, color: '#EF4444' },
  ]

  const totalSessions = sessions.length
  const convertedSessions = sessions.filter((s: AnyRow) => s.converted).length
  const registeredCount = users.length

  // Pipeline counts
  const pipelineCounts: Record<string, number> = {}
  for (const m of marketplaceMatches as AnyRow[]) {
    const s = String(m.status ?? 'unknown')
    pipelineCounts[s] = (pipelineCounts[s] ?? 0) + 1
  }

  const gmvTotal = (marketplaceMatches as AnyRow[]).reduce((acc, m) => acc + Number(m.proposed_total_eur ?? 0), 0)
  const feePaidCents = sumCents((marketplaceMatches as AnyRow[]).filter(m => m.status === 'paid'), 'pricing_tier_fee_eur')
  const feePendingCents = sumCents((marketplaceMatches as AnyRow[]).filter(m => m.status === 'confirmed'), 'pricing_tier_fee_eur')

  const activeSubs = (marketplaceSubscriptions as AnyRow[]).filter(s => s.status === 'active')
  const mrrCents = sumCents(activeSubs, 'adjusted_price_eur_cents')

  const dealRoomLeadCount = dealRoomLeads.length

  const warmTotal = warmContacts.length
  const warmExcluded = (warmContacts as AnyRow[]).filter(c => c.excluded).length
  const warmByStatus: Record<string, number> = {}
  for (const c of warmContacts as AnyRow[]) {
    if (c.excluded) continue
    const s = String(c.outreach_status ?? 'pending')
    warmByStatus[s] = (warmByStatus[s] ?? 0) + 1
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">CRM</h1>
        <p className="text-sm text-gray-500 mt-1">
          Users · marketplace pipeline · deal rooms · warm network · intent signals
        </p>
      </div>

      {/* ── Top KPIs ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Registered" value={registeredCount} color="#60A5FA" hint={`${convertedSessions}/${totalSessions} sessions converted`} />
        <Kpi label="Matches pipeline" value={(marketplaceMatches as AnyRow[]).length} color="#C9A84C" hint={`GMV sous matching €${(gmvTotal).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}`} />
        <Kpi label="Commissions payées" value={`€${(feePaidCents / 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}`} color="#10B981" hint={`${(marketplaceMatches as AnyRow[]).filter(m => m.status === 'paid').length} matches fee collectés`} />
        <Kpi label="MRR abos marketplace" value={`€${(mrrCents / 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}`} color="#A78BFA" hint={`${activeSubs.length} abos actifs`} />
      </div>

      {/* ── Prospects Funnel ──────────────────────────────────────── */}
      <Section
        title={`🎯 Prospects Pipeline — ${pipelineTotal.toLocaleString('fr-FR')} / 500 000 (${pctToTarget.toFixed(2)}%)`}
        subtitle="Funnel E2E auto : scout LLM cascade → enrichment → outreach → démo → signup → match. PM2 ftg-scout-loop + ftg-scout-loop-2 drainent 24/7."
        action={
          <div className="flex gap-2 text-[11px]">
            <Link href="/admin/outreach-enrichment" className="text-[#C9A84C] hover:underline">Enrich →</Link>
            <Link href="/admin/prospection" className="text-[#C9A84C] hover:underline">Prospection →</Link>
          </div>
        }
      >
        <div className="mb-4">
          <div className="h-3 rounded-full bg-[#111827] overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pctToTarget}%`, background: 'linear-gradient(90deg,#C9A84C,#F59E0B)' }} />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-gray-500">
            <span>0</span>
            <span>250 000 (milestone MRR ~€165k)</span>
            <span>500 000 target</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          {funnelStages.map((s, i) => (
            <div key={s.label} className="rounded-lg border border-white/5 bg-[#111827] px-3 py-2 text-center">
              <div className="text-[10px] text-gray-500">{s.label}</div>
              <div className="text-lg font-bold" style={{ color: s.color }}>{s.value.toLocaleString('fr-FR')}</div>
              {i > 0 && funnelStages[i - 1].value > 0 && (
                <div className="text-[9px] text-gray-600">
                  {((s.value / funnelStages[i - 1].value) * 100).toFixed(1)}%
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-white/5 bg-[#111827] p-3">
            <div className="text-[11px] text-gray-500 uppercase mb-2">Scout queue — état auto-drain</div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div><div className="text-[10px] text-gray-500">Pending</div><div className="text-lg font-bold text-[#F59E0B]">{prospects.scoutByStatus.pending}</div></div>
              <div><div className="text-[10px] text-gray-500">Running</div><div className="text-lg font-bold text-[#60A5FA]">{prospects.scoutByStatus.running}</div></div>
              <div><div className="text-[10px] text-gray-500">Done</div><div className="text-lg font-bold text-[#10B981]">{prospects.scoutByStatus.done}</div></div>
              <div><div className="text-[10px] text-gray-500">Failed</div><div className="text-lg font-bold text-[#EF4444]">{prospects.scoutByStatus.failed}</div></div>
            </div>
          </div>
          <div className="rounded-lg border border-white/5 bg-[#111827] p-3">
            <div className="text-[11px] text-gray-500 uppercase mb-2">Top 10 pays couverture directory</div>
            <div className="flex flex-wrap gap-1">
              {prospects.topCountries.map(([iso, n]) => (
                <span key={iso} className="text-[10px] px-2 py-0.5 rounded-full bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20">
                  {iso} <strong>{n}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>

        {prospects.recent.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <div className="text-[11px] text-gray-500 uppercase mb-2">15 derniers prospects scoutés</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 text-gray-500 text-left">
                  <th className="pb-2 pr-4 font-medium">Nom</th>
                  <th className="pb-2 pr-4 font-medium">Pays</th>
                  <th className="pb-2 pr-4 font-medium">Secteur</th>
                  <th className="pb-2 pr-4 font-medium">Ville</th>
                  <th className="pb-2 pr-4 font-medium">Source</th>
                  <th className="pb-2 font-medium">Scouté</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {prospects.recent.map(r => (
                  <tr key={String(r.id)} className="hover:bg-white/5">
                    <td className="py-1.5 pr-4 text-gray-300 truncate max-w-[200px]">{String(r.name ?? '—')}</td>
                    <td className="py-1.5 pr-4 text-gray-400">{String(r.country_iso ?? '—')}</td>
                    <td className="py-1.5 pr-4 text-gray-400">{String(r.sector ?? '—')}</td>
                    <td className="py-1.5 pr-4 text-gray-400">{String(r.city ?? '—')}</td>
                    <td className="py-1.5 pr-4 text-gray-500 font-mono text-[10px]">{String(r.source ?? '—').slice(0, 20)}</td>
                    <td className="py-1.5 text-gray-500">{r.created_at ? new Date(String(r.created_at)).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Marketplace pipeline ──────────────────────────────────── */}
      <Section
        title="Marketplace — pipeline des matches"
        subtitle="Offres générées par le matcher IA. Quand les 2 acceptent → commission due. 4 couleurs pour scanner vite."
        action={<Link href="/admin/marketplace" className="text-[11px] text-[#C9A84C] hover:underline">Ouvrir marketplace →</Link>}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
          {['proposed','counter_proposed','accepted_producer','accepted_buyer','confirmed','paid','rejected','expired'].map(s => (
            <div key={s} className="rounded-lg border border-white/5 bg-[#111827] px-3 py-2 text-center">
              <div className="text-[10px] text-gray-500">{STATUS_LABEL[s] ?? s}</div>
              <div className="text-lg font-bold" style={{ color: STATUS_COLOR[s] ?? '#C9A84C' }}>{pipelineCounts[s] ?? 0}</div>
            </div>
          ))}
        </div>
        {feePendingCents > 0 && (
          <div className="mb-3 rounded-lg border border-[#10B981]/40 bg-[#10B981]/10 px-3 py-2 text-xs text-[#10B981]">
            Commission à encaisser : <strong>€{(feePendingCents / 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}</strong> sur {(marketplaceMatches as AnyRow[]).filter(m => m.status === 'confirmed').length} matches confirmés (en attente paiement buyer).
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 text-left">
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Match</th>
                <th className="pb-2 pr-4 font-medium">Volume</th>
                <th className="pb-2 pr-4 font-medium">Tier</th>
                <th className="pb-2 pr-4 font-medium">Fee</th>
                <th className="pb-2 font-medium">Créé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(marketplaceMatches as AnyRow[]).slice(0, 20).map(m => (
                <tr key={String(m.id)} className="hover:bg-white/5">
                  <td className="py-2 pr-4">
                    <span style={{ color: STATUS_COLOR[String(m.status)] ?? '#C9A84C' }}>{STATUS_LABEL[String(m.status)] ?? String(m.status)}</span>
                  </td>
                  <td className="py-2 pr-4 font-mono text-gray-500">{String(m.id).slice(0, 8)}…</td>
                  <td className="py-2 pr-4 text-gray-300">€{Number(m.proposed_total_eur ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}</td>
                  <td className="py-2 pr-4 text-gray-500">{m.pricing_tier_label ? String(m.pricing_tier_label) : '—'}</td>
                  <td className="py-2 pr-4 text-gray-300">{m.pricing_tier_fee_eur ? `€${(Number(m.pricing_tier_fee_eur) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}` : '—'}</td>
                  <td className="py-2 text-gray-500">{m.created_at ? new Date(String(m.created_at)).toLocaleDateString('fr-FR') : '—'}</td>
                </tr>
              ))}
              {marketplaceMatches.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-gray-500">Aucun match pour l&apos;instant.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Deal rooms ────────────────────────────────────────────── */}
      <Section
        title="Deal rooms — mini-sites vendeurs"
        subtitle="Chaque seller peut publier une deal room sous notre domaine, capte les leads via formulaire."
        action={<Link href="/seller/deal-rooms" className="text-[11px] text-[#C9A84C] hover:underline">Vue seller →</Link>}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg border border-white/5 bg-[#111827] p-3">
            <div className="text-[10px] text-gray-500 uppercase">Rooms publiées</div>
            <div className="text-xl font-bold text-white">{dealRooms.length}</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-[#111827] p-3">
            <div className="text-[10px] text-gray-500 uppercase">Leads capturés</div>
            <div className="text-xl font-bold text-[#A78BFA]">{dealRoomLeadCount}</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-[#111827] p-3">
            <div className="text-[10px] text-gray-500 uppercase">Rooms publiques</div>
            <div className="text-xl font-bold text-[#10B981]">{(dealRooms as AnyRow[]).filter(d => d.is_public).length}</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 text-left">
                <th className="pb-2 pr-4 font-medium">Slug</th>
                <th className="pb-2 pr-4 font-medium">Titre</th>
                <th className="pb-2 pr-4 font-medium">Leads</th>
                <th className="pb-2 pr-4 font-medium">Public</th>
                <th className="pb-2 font-medium">Créé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(dealRooms as AnyRow[]).slice(0, 10).map(d => {
                const leadCount = (dealRoomLeads as AnyRow[]).filter(l => l.deal_room_id === d.id).length
                return (
                  <tr key={String(d.id)} className="hover:bg-white/5">
                    <td className="py-2 pr-4 text-gray-300 font-mono">{String(d.slug)}</td>
                    <td className="py-2 pr-4 text-gray-300">{String(d.title ?? '—')}</td>
                    <td className="py-2 pr-4 text-[#A78BFA] font-semibold">{leadCount}</td>
                    <td className="py-2 pr-4">{d.is_public ? '✓' : '—'}</td>
                    <td className="py-2 text-gray-500">{d.created_at ? new Date(String(d.created_at)).toLocaleDateString('fr-FR') : '—'}</td>
                  </tr>
                )
              })}
              {dealRooms.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-gray-500">Aucune deal room.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Warm network ──────────────────────────────────────────── */}
      <Section
        title="Warm network — contacts LinkedIn persos"
        subtitle="Contacts importés par chaque user, assignés à un persona outreach (alex / maria / thomas). User jamais visible comme sender."
        action={<Link href="/admin/prospection/personal-network" className="text-[11px] text-[#C9A84C] hover:underline">Ouvrir →</Link>}
      >
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-lg border border-white/5 bg-[#111827] p-3">
            <div className="text-[10px] text-gray-500 uppercase">Importés</div>
            <div className="text-xl font-bold text-white">{warmTotal}</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-[#111827] p-3">
            <div className="text-[10px] text-gray-500 uppercase">Ready-to-outreach</div>
            <div className="text-xl font-bold text-[#10B981]">{warmReadyCount}</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-[#111827] p-3">
            <div className="text-[10px] text-gray-500 uppercase">Exclus</div>
            <div className="text-xl font-bold text-[#EF4444]">{warmExcluded}</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-[#111827] p-3">
            <div className="text-[10px] text-gray-500 uppercase">Contactés</div>
            <div className="text-xl font-bold text-[#60A5FA]">{warmByStatus.contacted ?? 0}</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-[#111827] p-3">
            <div className="text-[10px] text-gray-500 uppercase">Répondu</div>
            <div className="text-xl font-bold text-[#A78BFA]">{warmByStatus.replied ?? 0}</div>
          </div>
        </div>
      </Section>

      {/* ── Registered users ───────────────────────────────────────── */}
      <Section title="Registered users" subtitle="100 derniers signups">
        {users.length === 0 ? (
          <p className="text-xs text-gray-500">No registered users yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 text-gray-500 text-left">
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Tier</th>
                  <th className="pb-2 pr-4 font-medium">Company</th>
                  <th className="pb-2 pr-4 font-medium">Country</th>
                  <th className="pb-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(users as AnyRow[]).map(u => {
                  const tier = String(u.tier ?? 'free')
                  return (
                    <tr key={String(u.id)} className="hover:bg-white/5">
                      <td className="py-2 pr-4 text-gray-300">{String(u.email ?? '—')}</td>
                      <td className="py-2 pr-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ color: TIER_COLOR[tier], background: TIER_COLOR[tier] + '22' }}>
                          {u.is_billed === false && !u.is_admin ? `Demo ${tier}` : tier}
                        </span>
                        {u.is_admin === true && (
                          <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#C9A84C]/10 text-[#C9A84C]">ADMIN</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-gray-400">{String(u.company ?? '—')}</td>
                      <td className="py-2 pr-4 text-gray-400">{String(u.country ?? '—')}</td>
                      <td className="py-2 text-gray-500">{u.created_at ? new Date(String(u.created_at)).toLocaleDateString('fr-FR') : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Upgrade intent + saved searches ─────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Upgrade intent (anonymous)" subtitle="Sessions ayant cliqué un CTA upgrade, non converties">
          <p className="text-2xl font-bold text-[#EF4444]">{upgradeSet.size}</p>
          <p className="text-xs text-gray-600 mt-1">sessions anonymes avec intention d&apos;upgrade</p>
        </Section>

        <Section title="Saved searches" subtitle="Les utilisateurs gardent quoi en tête">
          {savedSearches.length === 0 ? (
            <p className="text-xs text-gray-500">No saved searches yet.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {(savedSearches as AnyRow[]).slice(0, 10).map(ss => (
                <li key={String(ss.id)} className="border-b border-white/5 pb-1 text-gray-300">
                  <div className="font-medium">{String(ss.name ?? 'Sans nom')}</div>
                  <div className="text-[10px] text-gray-500 truncate">{JSON.stringify(ss.filters ?? {})}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  )
}
