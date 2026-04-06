import { supabaseAdmin } from '@/lib/supabase'

async function getAnalytics() {
  const admin = supabaseAdmin()
  const since30d = new Date(Date.now() - 30 * 86400000).toISOString()
  const since7d  = new Date(Date.now() -  7 * 86400000).toISOString()

  const [
    { data: dailyRaw },
    { data: eventTypes },
    { data: topCountries },
    { data: topSearches },
    { data: conversionRaw },
    { data: recentSessions },
  ] = await Promise.all([
    // Daily events last 30 days
    admin.rpc('analytics_daily_events' as any, { since: since30d }).select('*'),
    // Event type breakdown
    admin.from('tracking_events')
      .select('event_type')
      .gte('created_at', since30d),
    // Top clicked countries 7d
    admin.from('tracking_events')
      .select('event_data')
      .eq('event_type', 'country_click')
      .gte('created_at', since7d)
      .limit(200),
    // Top search queries 7d
    admin.from('tracking_events')
      .select('event_data')
      .eq('event_type', 'search')
      .gte('created_at', since7d)
      .limit(200),
    // Conversion funnel
    admin.from('tracking_events')
      .select('event_type')
      .in('event_type', ['session_start', 'country_click', 'plan_view', 'upgrade_click'])
      .gte('created_at', since30d),
    // Recent sessions
    admin.from('user_sessions')
      .select('*')
      .order('last_seen_at', { ascending: false })
      .limit(20),
  ])

  // Aggregate event types
  const typeCounts: Record<string, number> = {}
  for (const e of (eventTypes ?? [])) {
    typeCounts[e.event_type] = (typeCounts[e.event_type] ?? 0) + 1
  }

  // Top countries
  const countryCounts: Record<string, number> = {}
  for (const e of (topCountries ?? [])) {
    const c = (e.event_data as any)?.country
    if (c) countryCounts[c] = (countryCounts[c] ?? 0) + 1
  }
  const topCountriesList = Object.entries(countryCounts).sort(([,a],[,b]) => b - a).slice(0, 10)

  // Top searches
  const searchCounts: Record<string, number> = {}
  for (const e of (topSearches ?? [])) {
    const q = (e.event_data as any)?.query
    if (q) searchCounts[q] = (searchCounts[q] ?? 0) + 1
  }
  const topSearchList = Object.entries(searchCounts).sort(([,a],[,b]) => b - a).slice(0, 8)

  // Funnel
  const funnelCounts: Record<string, number> = {}
  for (const e of (conversionRaw ?? [])) {
    funnelCounts[e.event_type] = (funnelCounts[e.event_type] ?? 0) + 1
  }
  const funnel = [
    { label: 'Sessions',      key: 'session_start',  color: '#60A5FA' },
    { label: 'Country Views', key: 'country_click',  color: '#C9A84C' },
    { label: 'Plan Views',    key: 'plan_view',       color: '#22C55E' },
    { label: 'Upgrade Clicks',key: 'upgrade_click',  color: '#EF4444' },
  ].map(f => ({ ...f, count: funnelCounts[f.key] ?? 0 }))

  return { typeCounts, topCountriesList, topSearchList, funnel, recentSessions }
}

export default async function AnalyticsPage() {
  const { typeCounts, topCountriesList, topSearchList, funnel, recentSessions } = await getAnalytics()

  const totalEvents = Object.values(typeCounts).reduce((a, b) => a + b, 0)
  const funnelMax = funnel[0]?.count || 1

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">User behaviour · last 30 days</p>
      </div>

      {/* Funnel */}
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Conversion Funnel (30 days)</h2>
        <div className="space-y-3">
          {funnel.map((step, i) => {
            const pct = Math.round(step.count / funnelMax * 100)
            const cvr = i > 0 ? Math.round(step.count / (funnel[i-1].count || 1) * 100) : 100
            return (
              <div key={step.key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">{step.label}</span>
                  <span style={{ color: step.color }}>{step.count.toLocaleString()}
                    {i > 0 && <span className="text-gray-600 ml-2">({cvr}%)</span>}
                  </span>
                </div>
                <div className="h-2.5 bg-[#1F2937] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: step.color }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Event breakdown */}
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Event Breakdown</h2>
          <p className="text-xs text-gray-500 mb-4">{totalEvents.toLocaleString()} events total</p>
          {totalEvents === 0 ? (
            <p className="text-xs text-gray-500">No events yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(typeCounts).sort(([,a],[,b]) => b - a).map(([type, count]) => (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-400 w-36 truncate">{type}</span>
                  <div className="flex-1 h-2 bg-[#1F2937] rounded-full overflow-hidden">
                    <div className="h-full bg-[#C9A84C] rounded-full"
                      style={{ width: `${Math.round(count / Math.max(...Object.values(typeCounts)) * 100)}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 w-10 text-right">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top countries */}
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Top Countries (7 days)</h2>
          <p className="text-xs text-gray-500 mb-4">Most clicked on the map</p>
          {topCountriesList.length === 0 ? (
            <p className="text-xs text-gray-500">No clicks yet.</p>
          ) : (
            <div className="space-y-2">
              {topCountriesList.map(([iso, count]) => (
                <div key={iso} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#C9A84C] w-12">{iso}</span>
                  <div className="flex-1 h-2 bg-[#1F2937] rounded-full overflow-hidden">
                    <div className="h-full bg-[#22C55E] rounded-full"
                      style={{ width: `${Math.round(count / topCountriesList[0][1] * 100)}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top searches */}
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Top Searches (7 days)</h2>
          <p className="text-xs text-gray-500 mb-4">Search bar queries</p>
          {topSearchList.length === 0 ? (
            <p className="text-xs text-gray-500">No searches yet.</p>
          ) : (
            <ol className="space-y-1.5">
              {topSearchList.map(([query, count], i) => (
                <li key={query} className="flex items-center gap-3 text-xs">
                  <span className="text-gray-600 w-4">{i+1}.</span>
                  <span className="flex-1 text-gray-300 truncate">{query}</span>
                  <span className="text-gray-500">{count}×</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Recent sessions */}
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Recent Sessions</h2>
          <p className="text-xs text-gray-500 mb-4">Last 20 visitor sessions</p>
          {(recentSessions ?? []).length === 0 ? (
            <p className="text-xs text-gray-500">No sessions yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-auto">
              {(recentSessions ?? []).map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 font-mono truncate">{s.id.slice(0,8)}…</p>
                    <p className="text-[10px] text-gray-600">
                      {new Date(s.last_seen_at).toLocaleString()}
                    </p>
                  </div>
                  {s.converted && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#22C55E22] text-[#22C55E]">converted</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
