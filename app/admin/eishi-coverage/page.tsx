import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import CoverageControls from './CoverageControls'

export const dynamic = 'force-dynamic'

/**
 * 🍴 /admin/eishi-coverage — operational view of content cache filling
 *
 * Tracks the 3 caches (Rock Lee v2 videos + Eishi Layer 1 base content +
 * legacy per-opp content). Shows ready vs missing by commercial priority so
 * the team knows which top pairs are covered ahead of launch.
 */

const C = {
  bg: '#07090F', card: '#0F172A', border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8',
  green: '#10B981', yellow: '#F59E0B', red: '#EF4444',
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

interface CoverageStats {
  cache: string
  icon: string
  ready: number
  generating: number
  failed: number
  pending: number
  totalCost: number
}

async function loadCoverage() {
  const db = admin()

  const counts = async (table: string): Promise<Omit<CoverageStats, 'cache' | 'icon'>> => {
    const [ready, generating, failed, pending, cost] = await Promise.all([
      db.from(table).select('*', { count: 'exact', head: true }).eq('status', 'ready'),
      db.from(table).select('*', { count: 'exact', head: true }).eq('status', 'generating'),
      db.from(table).select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      db.from(table).select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      db.from(table).select('cost_eur'),
    ])
    const totalCost = (cost.data as Array<{ cost_eur: number | null }> | null)
      ?.reduce((sum, r) => sum + Number(r.cost_eur || 0), 0) ?? 0
    return {
      ready: ready.count ?? 0,
      generating: generating.count ?? 0,
      failed: failed.count ?? 0,
      pending: pending.count ?? 0,
      totalCost,
    }
  }

  const [videos, base, legacy] = await Promise.all([
    counts('ftg_product_country_videos'),
    counts('ftg_product_country_content'),
    counts('ftg_opportunity_content'),
  ])

  // Estimate total unique pairs from opportunity count / avg opps-per-pair
  const { count: totalOpps } = await db.from('opportunities').select('*', { count: 'exact', head: true })
  const totalPairs = Math.round((totalOpps ?? 0) / 20)  // heuristic ~20 opps/pair

  // Next 10 commercial priorities missing (videos)
  const { data: missingVideos } = await db.rpc('ftg_missing_product_country_pairs', { limit_count: 10 })
  const { data: missingBase } = await db.rpc('ftg_missing_product_country_content', { limit_count: 10, lang_filter: 'fr' })

  // Queue depth (priority jobs)
  const { count: priorityPending } = await db
    .from('ftg_content_jobs').select('*', { count: 'exact', head: true })
    .eq('status', 'pending').gte('priority', 100)

  const stats: CoverageStats[] = [
    { cache: 'ftg_product_country_videos (Rock Lee v2)', icon: '🎥', ...videos },
    { cache: 'ftg_product_country_content (Eishi Layer 1)', icon: '🍴', ...base },
    { cache: 'ftg_opportunity_content (legacy per-opp)', icon: '📦', ...legacy },
  ]

  return { stats, totalPairs, missingVideos: missingVideos ?? [], missingBase: missingBase ?? [], priorityPending: priorityPending ?? 0 }
}

async function loadTopReady() {
  const db = admin()
  const { data } = await db
    .from('ftg_product_country_videos')
    .select('product_id, country_iso, generated_at')
    .eq('status', 'ready')
    .order('generated_at', { ascending: false })
    .limit(15)
  return data ?? []
}

export default async function EishiCoveragePage() {
  const [coverage, topReady] = await Promise.all([loadCoverage(), loadTopReady()])
  const { stats, totalPairs, missingVideos, missingBase, priorityPending } = coverage

  return (
    <main style={{ background: C.bg, color: C.text, minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ fontSize: 32, color: C.accent, marginBottom: '0.5rem' }}>🍴 Eishi Coverage</h1>
        <p style={{ color: C.muted, marginBottom: '1rem', fontSize: 14 }}>
          Hybrid content cache (Layer 1 shared + Layer 2 per-opp + video dedup). Commercial priority ordering active.
          Total unique (product × country) pairs estimated at <strong style={{ color: C.text }}>{totalPairs.toLocaleString()}</strong>.
        </p>

        <CoverageControls />

        {/* Priority queue callout */}
        <div style={{
          background: priorityPending > 0 ? 'rgba(245,158,11,.1)' : C.card,
          border: `1px solid ${priorityPending > 0 ? C.yellow : C.border}`,
          borderRadius: 8, padding: '1rem 1.5rem', marginBottom: '2rem',
        }}>
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 4 }}>Priority=100 jobs pending (paid triggers)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: priorityPending > 0 ? C.yellow : C.text }}>
            {priorityPending}
          </div>
        </div>

        {/* Cache stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
          {stats.map((s) => {
            const pct = totalPairs > 0 ? Math.round((s.ready / totalPairs) * 100) : 0
            const total = s.ready + s.generating + s.failed + s.pending
            return (
              <div key={s.cache} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.muted, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{s.icon}</span>
                  <span>{s.cache}</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: C.accent, marginBottom: 2 }}>{s.ready.toLocaleString()}</div>
                <div style={{ color: C.muted, fontSize: 12, marginBottom: 12 }}>ready · {pct}% of est. total · {total.toLocaleString()} tracked</div>
                <div style={{ height: 6, background: 'rgba(201,168,76,.1)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: C.green }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted, marginTop: 8 }}>
                  <span>⚙ {s.generating} generating</span>
                  <span>⏳ {s.pending} pending</span>
                  <span style={{ color: s.failed > 0 ? C.red : C.muted }}>✗ {s.failed} failed</span>
                  <span>€ {s.totalCost.toFixed(2)}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Next top priorities */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '3rem' }}>
          <PairList title="🎥 Videos — prochaines (top value)" rows={missingVideos} empty="Cache vidéos 100% rempli 🎉" />
          <PairList title="🍴 Base content — prochaines (top value)" rows={missingBase} empty="Base LLM 100% remplie 🎉" />
        </div>

        {/* Last ready */}
        <h2 style={{ fontSize: 18, color: C.accent, marginBottom: '1rem' }}>Dernières paires vidéos générées</h2>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(201,168,76,.05)', color: C.muted, textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Product</th>
                <th style={{ padding: '0.75rem 1rem' }}>Country</th>
                <th style={{ padding: '0.75rem 1rem' }}>Ready at</th>
              </tr>
            </thead>
            <tbody>
              {topReady.map((r: any, i: number) => (
                <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: '0.5rem 1rem', fontFamily: 'monospace', fontSize: 12 }}>{r.product_id}</td>
                  <td style={{ padding: '0.5rem 1rem' }}>{r.country_iso}</td>
                  <td style={{ padding: '0.5rem 1rem', color: C.muted }}>{new Date(r.generated_at).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
              {topReady.length === 0 && (
                <tr><td colSpan={3} style={{ padding: '1.5rem', textAlign: 'center', color: C.muted }}>Aucune paire prête encore — revenir dans quelques min</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '2rem', fontSize: 12, color: C.muted }}>
          <p>Crons actifs :</p>
          <ul style={{ marginTop: 4, paddingLeft: '1.5rem' }}>
            <li>Rock Lee v2 videos — every 10 min (20 pairs × 5 concurrent)</li>
            <li>Eishi Layer 1 base — every 15 min (10 triples × 3 concurrent)</li>
            <li>Shisui per-opp orchestrator — every 5 min (20 jobs × 4 concurrent)</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            <Link href="/admin/content-generation" style={{ color: C.accent }}>→ Manual trigger panel</Link>
          </p>
        </div>
      </div>
    </main>
  )
}

function PairList({ title, rows, empty }: { title: string; rows: any[]; empty: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '1rem' }}>
      <h3 style={{ fontSize: 14, color: C.accent, marginBottom: '0.75rem' }}>{title}</h3>
      {rows.length === 0 ? (
        <div style={{ color: C.green, fontSize: 14, padding: '1rem 0' }}>{empty}</div>
      ) : (
        <ol style={{ paddingLeft: '1.5rem', fontSize: 12, lineHeight: 1.7, fontFamily: 'monospace' }}>
          {rows.slice(0, 10).map((r: any, i: number) => (
            <li key={i}>{r.product_id} × <strong>{r.country_iso}</strong></li>
          ))}
        </ol>
      )}
    </div>
  )
}
