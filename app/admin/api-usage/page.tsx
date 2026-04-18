import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * /admin/api-usage — observabilité API Platform
 *
 * Server component : lit api_tokens + api_calls_log.
 * KPIs : tokens actifs/revoked × tier, calls 24h/7d/total, revenu estimé,
 * top paths, top tokens by usage.
 */

const C = {
  bg: '#07090F', card: '#0F172A', border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8', green: '#10B981', red: '#EF4444',
}

const TIER_PRICE_EUR_YEAR: Record<string, number> = {
  starter: 12_000, pro: 40_000, enterprise: 120_000, sovereign: 300_000,
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

type TokenRow = { id: string; name: string; tier: string; usage_total: number; revoked_at: string | null; owner_id: string; created_at: string; last_used_at: string | null }
type CallRow = { path: string; status: number; called_at: string }

async function loadData() {
  const db = admin()
  const sinceDay = new Date(Date.now() - 86400_000).toISOString()
  const sinceWeek = new Date(Date.now() - 7 * 86400_000).toISOString()

  const [tokensRes, callsDayRes, callsWeekRes, callsTotalRes, topPathsRes, seriesRes] = await Promise.all([
    db.from('api_tokens').select('id, name, tier, usage_total, revoked_at, owner_id, created_at, last_used_at').order('usage_total', { ascending: false }).limit(200),
    db.from('api_calls_log').select('*', { count: 'exact', head: true }).gte('called_at', sinceDay),
    db.from('api_calls_log').select('*', { count: 'exact', head: true }).gte('called_at', sinceWeek),
    db.from('api_calls_log').select('*', { count: 'exact', head: true }),
    db.from('api_calls_log').select('path, status').gte('called_at', sinceWeek).limit(1000),
    db.from('api_calls_log').select('called_at, status').gte('called_at', sinceWeek).order('called_at', { ascending: true }).limit(5000),
  ])

  const tokens = (tokensRes.data ?? []) as TokenRow[]
  const pathRows = (topPathsRes.data ?? []) as CallRow[]

  const byTier = tokens.reduce<Record<string, { active: number; revoked: number }>>((acc, t) => {
    const k = t.tier
    acc[k] = acc[k] ?? { active: 0, revoked: 0 }
    if (t.revoked_at) acc[k].revoked++
    else acc[k].active++
    return acc
  }, {})

  const revenueEurYear = Object.entries(byTier).reduce((sum, [tier, v]) => {
    return sum + (TIER_PRICE_EUR_YEAR[tier] ?? 0) * v.active
  }, 0)

  const pathCounts: Record<string, { total: number; errors: number }> = {}
  for (const r of pathRows) {
    const p = r.path
    pathCounts[p] = pathCounts[p] ?? { total: 0, errors: 0 }
    pathCounts[p].total++
    if (r.status >= 400) pathCounts[p].errors++
  }
  const topPaths = Object.entries(pathCounts)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)

  // Time series 7j groupée par jour
  const series: Array<{ date: string; ok: number; err: number }> = []
  const seriesRows = (seriesRes.data ?? []) as Array<{ called_at: string; status: number }>
  const byDay: Record<string, { ok: number; err: number }> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000)
    const key = d.toISOString().slice(0, 10)
    byDay[key] = { ok: 0, err: 0 }
  }
  for (const r of seriesRows) {
    const key = r.called_at.slice(0, 10)
    if (!byDay[key]) continue
    if (r.status >= 400) byDay[key].err++
    else byDay[key].ok++
  }
  for (const [date, v] of Object.entries(byDay).sort()) {
    series.push({ date, ok: v.ok, err: v.err })
  }

  return {
    tokens: tokens.slice(0, 25),
    byTier,
    revenueEurYear,
    callsDay: callsDayRes.count ?? 0,
    callsWeek: callsWeekRes.count ?? 0,
    callsTotal: callsTotalRes.count ?? 0,
    topPaths,
    series,
  }
}

function fmtEur(v: number): string {
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M €'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k €'
  return v.toLocaleString('fr-FR') + ' €'
}

function fmtNum(v: number): string {
  return v.toLocaleString('fr-FR')
}

export default async function AdminApiUsagePage() {
  const data = await loadData()

  const kpis = [
    { label: '24h', value: fmtNum(data.callsDay), unit: 'appels' },
    { label: '7 jours', value: fmtNum(data.callsWeek), unit: 'appels' },
    { label: 'Total', value: fmtNum(data.callsTotal), unit: 'appels' },
    { label: 'ARR API', value: fmtEur(data.revenueEurYear), unit: 'estimé (tokens actifs × prix tier)' },
  ]

  const tierOrder = ['starter', 'pro', 'enterprise', 'sovereign']

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ fontSize: 11, color: C.accent, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 6 }}>
          Admin · API Platform
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 28px' }}>Usage et revenu API</h1>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 28 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: '.15em', textTransform: 'uppercase' }}>{k.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.accent, marginTop: 6 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{k.unit}</div>
            </div>
          ))}
        </div>

        {/* Time series 7j */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: C.muted, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 14 }}>
            Appels 7 derniers jours
          </div>
          {(() => {
            const max = Math.max(1, ...data.series.map(s => s.ok + s.err))
            const barH = 140
            return (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: barH + 40 }}>
                {data.series.map(s => {
                  const totalH = Math.round((s.ok + s.err) / max * barH)
                  const errH = Math.round(s.err / max * barH)
                  const okH = Math.max(0, totalH - errH)
                  return (
                    <div key={s.date} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                      <div style={{ height: barH, display: 'flex', flexDirection: 'column-reverse', gap: 1 }}>
                        <div style={{ height: okH, background: C.green, borderRadius: '2px 2px 0 0' }} title={`${s.ok} ok`} />
                        {errH > 0 && <div style={{ height: errH, background: C.red }} title={`${s.err} errors`} />}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>
                        {new Date(s.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                      </div>
                      <div style={{ fontSize: 10, color: C.text, fontWeight: 600 }}>
                        {s.ok + s.err}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.muted, marginTop: 6, justifyContent: 'center' }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: C.green, marginRight: 4 }} />Succès 2xx</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: C.red, marginRight: 4 }} />Erreurs 4xx/5xx</span>
          </div>
        </div>

        {/* Tier breakdown */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: C.muted, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 14 }}>
            Tokens par tier
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tierOrder.length}, 1fr)`, gap: 12 }}>
            {tierOrder.map(t => {
              const stats = data.byTier[t] ?? { active: 0, revoked: 0 }
              const annual = (TIER_PRICE_EUR_YEAR[t] ?? 0) * stats.active
              return (
                <div key={t} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '.15em' }}>{t}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginTop: 4 }}>{stats.active}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>actifs{stats.revoked ? ` · ${stats.revoked} révoqués` : ''}</div>
                  {annual > 0 && <div style={{ fontSize: 12, color: C.green, marginTop: 6 }}>{fmtEur(annual)}/an</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Top paths + top tokens */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 16 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
            <div style={{ fontSize: 13, color: C.muted, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 14 }}>
              Top paths (7j)
            </div>
            {data.topPaths.length === 0 ? (
              <div style={{ color: C.muted, padding: 16, textAlign: 'center' }}>Aucun appel encore</div>
            ) : (
              <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                {data.topPaths.map(([path, v]) => (
                  <div key={path} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                    <code style={{ color: C.text, fontSize: 12, fontFamily: 'Menlo, monospace' }}>{path}</code>
                    <span style={{ color: C.muted }}>{fmtNum(v.total)}</span>
                    {v.errors > 0 && <span style={{ color: C.red }}>{v.errors} err</span>}
                    {v.errors === 0 && <span style={{ color: C.green }}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
            <div style={{ fontSize: 13, color: C.muted, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 14 }}>
              Top tokens (usage_total)
            </div>
            {data.tokens.length === 0 ? (
              <div style={{ color: C.muted, padding: 16, textAlign: 'center' }}>Aucun token créé</div>
            ) : (
              <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                {data.tokens.slice(0, 12).map(t => (
                  <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ color: t.revoked_at ? C.muted : C.text, textDecoration: t.revoked_at ? 'line-through' : 'none' }}>
                      {t.name}
                    </span>
                    <span style={{ color: C.accent, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em' }}>{t.tier}</span>
                    <span style={{ color: C.muted, fontFamily: 'Menlo, monospace' }}>{fmtNum(t.usage_total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: 12, color: C.muted, marginTop: 28, textAlign: 'center' }}>
          Data live depuis <code style={{ color: C.accent }}>api_tokens</code> + <code style={{ color: C.accent }}>api_calls_log</code>. ARR = somme des tiers actifs × prix annuel.
        </div>
      </div>
    </div>
  )
}
