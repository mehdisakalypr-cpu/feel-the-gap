import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import ContentGenerationPanel from './ContentGenerationPanel'

export const dynamic = 'force-dynamic'

/**
 * /admin/content-generation — trigger & observe background content agents.
 *
 * Server component: loads job queue stats + top countries + top opportunities.
 * Client component handles triggers (POST /api/admin/content-jobs).
 */

const C = {
  bg: '#07090F', card: '#0F172A', border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8',
  green: '#10B981', red: '#EF4444', yellow: '#F59E0B',
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function loadData() {
  const db = admin()

  const [jobsPending, jobsRunning, jobsDone, jobsFailed, contentReady, contentTotal, recentFails, countries, topOpps] = await Promise.all([
    db.from('ftg_content_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('ftg_content_jobs').select('*', { count: 'exact', head: true }).eq('status', 'running'),
    db.from('ftg_content_jobs').select('*', { count: 'exact', head: true }).eq('status', 'done'),
    db.from('ftg_content_jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    db.from('ftg_opportunity_content').select('*', { count: 'exact', head: true }).eq('status', 'ready'),
    db.from('ftg_opportunity_content').select('*', { count: 'exact', head: true }),
    db.from('ftg_content_jobs').select('id, job_type, country_iso, last_error, finished_at').eq('status', 'failed').order('finished_at', { ascending: false }).limit(10),
    db.from('countries').select('iso3, name_fr').order('iso3').limit(250),
    db.from('opportunities').select('id, product_name, country_iso, gap_value_usd').order('gap_value_usd', { ascending: false }).limit(100),
  ])

  const { data: costAgg } = await db
    .from('ftg_content_jobs')
    .select('cost_eur')
    .eq('status', 'done')
  const totalCost = (costAgg || []).reduce((sum, r) => sum + (r.cost_eur || 0), 0)

  return {
    stats: {
      pending: jobsPending.count ?? 0,
      running: jobsRunning.count ?? 0,
      done: jobsDone.count ?? 0,
      failed: jobsFailed.count ?? 0,
      ready: contentReady.count ?? 0,
      total: contentTotal.count ?? 0,
      totalCost,
    },
    recentFails: recentFails.data || [],
    countries: countries.data || [],
    topOpps: topOpps.data || [],
  }
}

export default async function ContentGenerationAdmin() {
  const { stats, recentFails, countries, topOpps } = await loadData()

  return (
    <main style={{ background: C.bg, color: C.text, minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Link href="/admin" style={{ color: C.muted, fontSize: 14, textDecoration: 'none' }}>← Admin</Link>
        <h1 style={{ fontSize: 28, margin: '1rem 0', color: C.accent }}>🌀 Content Generation (Shisui)</h1>
        <p style={{ color: C.muted, marginBottom: '2rem' }}>
          Pre-compute content pour chaque (opportunité × pays). 4 agents : Shikamaru (méthodes), Itachi (BP), Hancock (clients), Rock Lee (vidéos).
          <br/>
          <strong style={{ color: C.yellow }}>Rule:</strong> JAMAIS généré au runtime. Public pages = SELECT only.
        </p>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          <KPI label="Jobs Pending" value={stats.pending} color={C.yellow} />
          <KPI label="Running" value={stats.running} color={C.accent} />
          <KPI label="Done" value={stats.done} color={C.green} />
          <KPI label="Failed" value={stats.failed} color={C.red} />
          <KPI label="Content Ready" value={stats.ready} color={C.green} />
          <KPI label="Content Total" value={stats.total} color={C.text} />
          <KPI label="Cost Total €" value={stats.totalCost.toFixed(3)} color={C.accent} />
          <KPI label="Success Rate" value={stats.done + stats.failed > 0 ? `${Math.round(stats.done / (stats.done + stats.failed) * 100)}%` : '—'} color={C.text} />
        </div>

        {/* Triggers */}
        <ContentGenerationPanel countries={countries} topOpps={topOpps} />

        {/* Recent failures */}
        {recentFails.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '1.5rem', marginTop: '2rem' }}>
            <h2 style={{ fontSize: 18, color: C.red, marginBottom: '1rem' }}>⚠ Derniers échecs</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ color: C.muted, textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Type</th>
                  <th style={{ padding: '0.5rem' }}>Pays</th>
                  <th style={{ padding: '0.5rem' }}>Erreur</th>
                  <th style={{ padding: '0.5rem' }}>Quand</th>
                </tr>
              </thead>
              <tbody>
                {recentFails.map((f: any) => (
                  <tr key={f.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: '0.5rem' }}>{f.job_type}</td>
                    <td style={{ padding: '0.5rem' }}>{f.country_iso}</td>
                    <td style={{ padding: '0.5rem', color: C.red, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.last_error?.slice(0, 100)}</td>
                    <td style={{ padding: '0.5rem', color: C.muted }}>{new Date(f.finished_at).toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}

function KPI({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '1rem' }}>
      <div style={{ color: C.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ color, fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  )
}
