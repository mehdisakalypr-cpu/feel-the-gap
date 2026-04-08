import { supabaseAdmin } from '@/lib/supabase'

async function getCRM() {
  const admin = supabaseAdmin()

  const [
    { data: users },
    { data: sessions },
    { data: savedSearches },
    { data: upgradeClicks },
  ] = await Promise.all([
    admin.from('profiles').select('*, is_billed, is_admin, demo_expires_at').order('created_at', { ascending: false }).limit(100),
    admin.from('user_sessions').select('*').order('last_seen_at', { ascending: false }).limit(100),
    admin.from('saved_searches').select('*').order('created_at', { ascending: false }).limit(50),
    admin.from('tracking_events')
      .select('session_id, event_data, created_at')
      .eq('event_type', 'upgrade_click')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  // Build session map
  const sessionMap: Record<string, any> = {}
  for (const s of (sessions ?? [])) sessionMap[s.id] = s

  // Upgrade intent by session
  const upgradeSet = new Set((upgradeClicks ?? []).map((e: any) => e.session_id))

  return { users, sessions, savedSearches, upgradeSet }
}

const TIER_COLOR: Record<string, string> = {
  free:       '#6B7280',
  basic:      '#60A5FA',
  standard:   '#C9A84C',
  premium:    '#A78BFA',
  enterprise: '#64748B',
}

export default async function CRMPage() {
  const { users, sessions, savedSearches, upgradeSet } = await getCRM()

  const totalSessions = sessions?.length ?? 0
  const convertedSessions = sessions?.filter((s: any) => s.converted).length ?? 0
  const savedCount = savedSearches?.length ?? 0
  const registeredCount = users?.length ?? 0

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">CRM</h1>
        <p className="text-sm text-gray-500 mt-1">Users · sessions · intent signals</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Registered',      value: registeredCount,  color: '#60A5FA' },
          { label: 'Sessions (all)',   value: totalSessions,    color: '#C9A84C' },
          { label: 'Converted',        value: convertedSessions, color: '#22C55E' },
          { label: 'Saved Searches',   value: savedCount,       color: '#A78BFA' },
        ].map(c => (
          <div key={c.label} className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{c.label}</p>
            <p className="text-3xl font-bold" style={{ color: c.color }}>{c.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Registered users table */}
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Registered Users</h2>
        {(users ?? []).length === 0 ? (
          <p className="text-xs text-gray-500">No registered users yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 text-gray-500 text-left">
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Tier</th>
                  <th className="pb-2 pr-4 font-medium">Company</th>
                  <th className="pb-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(users ?? []).map((u: any) => (
                  <tr key={u.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-2 pr-4 text-gray-300">{u.email ?? '—'}</td>
                    <td className="py-2 pr-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{
                          color: TIER_COLOR[u.tier ?? 'free'],
                          background: (TIER_COLOR[u.tier ?? 'free']) + '22',
                        }}>
                        {u.is_billed === false && !u.is_admin ? `Demo ${u.tier ?? 'free'}` : u.tier ?? 'free'}
                      </span>
                      {u.is_admin && (
                        <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#C9A84C]/10 text-[#C9A84C]">
                          ADMIN
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-gray-400">{u.company ?? '—'}</td>
                    <td className="py-2 text-gray-500">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upgrade intent — anonymous signals */}
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-1">Upgrade Intent (anonymous)</h2>
        <p className="text-xs text-gray-500 mb-4">Sessions that clicked an upgrade CTA</p>
        <p className="text-2xl font-bold text-[#EF4444]">{upgradeSet.size}</p>
        <p className="text-xs text-gray-600 mt-1">anonymous sessions showed upgrade intent · not yet converted</p>
      </div>

      {/* Saved searches */}
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Saved Searches</h2>
        {(savedSearches ?? []).length === 0 ? (
          <p className="text-xs text-gray-500">No saved searches yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 text-gray-500 text-left">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">User</th>
                  <th className="pb-2 pr-4 font-medium">Filters</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(savedSearches ?? []).map((ss: any) => (
                  <tr key={ss.id} className="hover:bg-white/5">
                    <td className="py-2 pr-4 text-gray-200">{ss.name}</td>
                    <td className="py-2 pr-4 text-gray-500 font-mono">{ss.user_id?.slice(0,8)}…</td>
                    <td className="py-2 pr-4 text-gray-500 truncate max-w-xs">
                      {JSON.stringify(ss.filters)}
                    </td>
                    <td className="py-2 text-gray-500">
                      {new Date(ss.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
