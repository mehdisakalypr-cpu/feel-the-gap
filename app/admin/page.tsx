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
  const { countries, opportunities, users, events30d, recentRuns, topCountries } = await getStats()

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
