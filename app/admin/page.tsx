import { supabaseAdmin } from '@/lib/supabase'

async function getStats() {
  const admin = supabaseAdmin()
  const [
    { count: countries },
    { count: opportunities },
    { count: users },
    { count: events30d },
    { data: recentRuns },
    { data: topSearches },
  ] = await Promise.all([
    admin.from('countries').select('*', { count: 'exact', head: true }),
    admin.from('opportunities').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('tracking_events').select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
    admin.from('agent_runs').select('*').order('created_at', { ascending: false }).limit(5),
    admin.from('tracking_events')
      .select('event_data')
      .eq('event_type', 'country_click')
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .limit(100),
  ])

  // Count top countries from recent searches
  const countryCounts: Record<string, number> = {}
  for (const e of (topSearches ?? [])) {
    const c = (e.event_data as any)?.country
    if (c) countryCounts[c] = (countryCounts[c] ?? 0) + 1
  }
  const topCountries = Object.entries(countryCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  return { countries, opportunities, users, events30d, recentRuns, topCountries }
}

async function getReportsStats() {
  const admin = supabaseAdmin()
  const { data: oppsCountries } = await admin.from('opportunities').select('country_iso')
  const uniqueWithOpps = [...new Set((oppsCountries ?? []).map(r => r.country_iso))]

  const { data: reportCountries } = await admin.from('reports').select('country_iso')
  const doneReports = new Set((reportCountries ?? []).map(r => r.country_iso))

  const [{ count: totalOpps }, { count: bpCount }] = await Promise.all([
    admin.from('opportunities').select('*', { count: 'exact', head: true }),
    admin.from('business_plans').select('*', { count: 'exact', head: true }),
  ])

  const { data: recentReports } = await admin
    .from('reports').select('country_iso, created_at')
    .order('created_at', { ascending: false }).limit(5)

  const allIsos = [...new Set([...(recentReports ?? []).map(r => r.country_iso), ...uniqueWithOpps])]
  const { data: names } = allIsos.length > 0
    ? await admin.from('countries').select('id, name_fr').in('id', allIsos) : { data: [] }
  const nameMap: Record<string, string> = {}
  for (const c of (names ?? [])) nameMap[c.id] = c.name_fr

  const missing = uniqueWithOpps.filter(iso => !doneReports.has(iso))
    .map(iso => ({ iso, name: nameMap[iso] ?? iso })).sort((a, b) => a.name.localeCompare(b.name))

  const rpPct = uniqueWithOpps.length > 0 ? Math.round((doneReports.size / uniqueWithOpps.length) * 100) : 0
  const bpPct = (totalOpps ?? 0) > 0 ? Math.round(((bpCount ?? 0) / (totalOpps ?? 1)) * 100) : 0

  return {
    reports: doneReports.size, totalWithOpps: uniqueWithOpps.length, rpPct,
    bpCount: bpCount ?? 0, totalOpps: totalOpps ?? 0, bpPct,
    recent: (recentReports ?? []).map(r => ({ iso: r.country_iso, name: nameMap[r.country_iso] ?? r.country_iso, date: r.created_at })),
    missing,
  }
}

function StatCard({ label, value, sub, color = '#C9A84C' }: {
  label: string; value: number | null; sub?: string; color?: string
}) {
  return (
    <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{(value ?? 0).toLocaleString()}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  )
}

const STATUS_COLOR: Record<string, string> = {
  completed: '#22C55E',
  running:   '#F59E0B',
  failed:    '#EF4444',
}

export default async function AdminPage() {
  const [{ countries, opportunities, users, events30d, recentRuns, topCountries }, rp] = await Promise.all([getStats(), getReportsStats()])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Platform health & key metrics</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Countries in DB"     value={countries}     sub="with trade data" />
        <StatCard label="Opportunities"       value={opportunities} sub="scored & ready" color="#22C55E" />
        <StatCard label="Registered Users"    value={users}         sub="all tiers" color="#60A5FA" />
        <StatCard label="Events (30 days)"    value={events30d}     sub="page views + interactions" color="#A78BFA" />
      </div>

      {/* Rapports IA */}
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Rapports IA</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Rapports pays</p>
            <p className="text-2xl font-bold text-[#C9A84C]">{rp.reports}<span className="text-sm font-normal text-gray-500"> / {rp.totalWithOpps}</span></p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Business plans</p>
            <p className="text-2xl font-bold text-[#A78BFA]">{rp.bpCount}<span className="text-sm font-normal text-gray-500"> / {rp.totalOpps}</span></p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Couverture rapports</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2.5 bg-[#1F2937] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[#C9A84C]" style={{ width: `${rp.rpPct}%` }} />
              </div>
              <span className="text-sm font-semibold text-[#C9A84C]">{rp.rpPct}%</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Couverture BP</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2.5 bg-[#1F2937] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[#A78BFA]" style={{ width: `${rp.bpPct}%` }} />
              </div>
              <span className="text-sm font-semibold text-[#A78BFA]">{rp.bpPct}%</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">5 derniers rapports</h3>
            {rp.recent.length === 0 ? <p className="text-xs text-gray-500">Aucun rapport encore.</p> : (
              <div className="space-y-2">
                {rp.recent.map(r => (
                  <div key={r.iso} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[#C9A84C] w-8">{r.iso}</span>
                      <span className="text-sm text-white">{r.name}</span>
                    </div>
                    <span className="text-[10px] text-gray-600">{new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pays sans rapport ({rp.missing.length})</h3>
            {rp.missing.length === 0 ? <p className="text-xs text-[#22C55E]">Tous les pays sont couverts !</p> : (
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {rp.missing.map(c => (
                  <span key={c.iso} className="px-2 py-0.5 bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20 rounded text-[10px] font-medium">{c.name}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent runs */}
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Recent Data Runs</h2>
          {(recentRuns ?? []).length === 0 ? (
            <p className="text-xs text-gray-500">No agent runs yet. Configure Supabase to start collecting data.</p>
          ) : (
            <div className="space-y-2">
              {(recentRuns ?? []).map((run: any) => (
                <div key={run.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm text-white">{run.agent}</p>
                    <p className="text-xs text-gray-500">
                      {run.countries_processed} countries · {run.records_inserted} records
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: STATUS_COLOR[run.status], background: STATUS_COLOR[run.status] + '22' }}>
                      {run.status}
                    </span>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {new Date(run.started_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top searched countries (7 days) */}
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Top Countries (7 days)</h2>
          {topCountries.length === 0 ? (
            <p className="text-xs text-gray-500">No tracking data yet. Add tracking script to go-live.</p>
          ) : (
            <div className="space-y-2">
              {topCountries.map(([iso, count]) => (
                <div key={iso} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#C9A84C] w-12">{iso}</span>
                  <div className="flex-1 h-2 bg-[#1F2937] rounded-full overflow-hidden">
                    <div className="h-full bg-[#C9A84C] rounded-full"
                      style={{ width: `${Math.round(count / topCountries[0][1] * 100)}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { label: '▶ Run Data Collector',  href: '/api/cron/collect', method: 'GET', color: '#22C55E' },
            { label: '📊 View Analytics',     href: '/admin/analytics', color: '#60A5FA' },
            { label: '👥 View CRM',           href: '/admin/crm', color: '#A78BFA' },
            { label: '✏️ Edit Content',       href: '/admin/cms', color: '#F59E0B' },
            { label: '🎬 Preview Demo',       href: '/demo', color: '#C9A84C' },
          ].map(a => (
            <a key={a.label} href={a.href} target={a.href.startsWith('/api') ? '_blank' : undefined}
              className="px-4 py-2 text-xs font-semibold rounded-lg border transition-colors hover:opacity-80"
              style={{ color: a.color, borderColor: a.color + '44', background: a.color + '12' }}>
              {a.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
