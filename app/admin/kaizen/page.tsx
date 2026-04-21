import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import KaizenActions from './KaizenActions'

export const dynamic = 'force-dynamic'

const C = {
  bg: '#07090F', card: '#0F172A', border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8',
  green: '#10B981', yellow: '#F59E0B', red: '#EF4444', blue: '#3B82F6',
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

type Proposal = {
  title: string
  category: string
  rationale: string
  action_steps: string[]
  expected_impact: { metric: string; multiplier: string; horizon_days: number }
  requires: string[]
  priority: number
  estimated_cost_eur: number
}

type Row = {
  id: string
  generated_at: string
  day_tag: string
  source_signals: any
  proposals: { top_signal_of_the_week?: string; proposals: Proposal[]; external_signals_to_monitor?: string[]; kushina_note?: string }
  status: string
}

const CATEGORY_EMOJI: Record<string, string> = {
  acquisition: '🎯', conversion: '💎', content: '🌀', technical: '🛠️',
  pricing: '💰', partnerships: '🤝', external_signals: '📡',
}

export default async function KaizenPage() {
  const db = admin()
  const { data: rows } = await db
    .from('ftg_kaizen_proposals')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(14)

  const recent = (rows ?? []) as Row[]
  const today = recent[0]

  return (
    <main style={{ background: C.bg, color: C.text, minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '0.5rem' }}>
          <span style={{ fontSize: 40 }}>🌀</span>
          <h1 style={{ fontSize: 32, color: C.accent, margin: 0 }}>Kushina — Daily Kaizen</h1>
        </div>
        <p style={{ color: C.muted, fontSize: 14, marginBottom: '2rem' }}>
          Co-équipière de Minato. Chaque matin 08h UTC, elle analyse 7 jours de métriques + signaux externes
          et propose 3-5 améliorations concrètes pour pousser vers le palier €28k MRR. Sélectionne, applique, capitalise.
        </p>

        {!today ? (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '3rem', textAlign: 'center', color: C.muted,
          }}>
            <div style={{ fontSize: 48, marginBottom: '1rem' }}>⏳</div>
            <h2 style={{ color: C.accent }}>Kushina se prépare…</h2>
            <p>Première proposition demain matin 08h UTC. Reviens alors pour voir ses idées.</p>
          </div>
        ) : (
          <>
            {/* Top signal callout */}
            {today.proposals?.top_signal_of_the_week && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(201,168,76,.1), rgba(201,168,76,.02))',
                border: `1px solid ${C.accent}55`, borderRadius: 12,
                padding: '1.5rem', marginBottom: '2rem',
              }}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 6, letterSpacing: '0.1em' }}>📡 TOP SIGNAL DE LA SEMAINE</div>
                <div style={{ fontSize: 17, lineHeight: 1.5 }}>{today.proposals.top_signal_of_the_week}</div>
              </div>
            )}

            {/* Proposals grid */}
            <h2 style={{ fontSize: 20, color: C.accent, marginBottom: '1rem' }}>
              Actions du jour — {today.day_tag}
            </h2>
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '3rem' }}>
              {(today.proposals?.proposals ?? []).map((p, i) => (
                <ProposalCard key={i} proposal={p} rowId={today.id} idx={i} />
              ))}
            </div>

            {/* Kushina note */}
            {today.proposals?.kushina_note && (
              <div style={{
                background: 'rgba(16,185,129,.05)', border: `1px solid rgba(16,185,129,.2)`,
                borderRadius: 8, padding: '1.5rem', marginBottom: '2rem',
                fontStyle: 'italic', color: C.green, fontSize: 15,
              }}>
                🌀 « {today.proposals.kushina_note} »
              </div>
            )}

            {/* External signals watch */}
            {(today.proposals?.external_signals_to_monitor ?? []).length > 0 && (
              <div style={{ marginBottom: '3rem' }}>
                <h3 style={{ fontSize: 16, color: C.accent, marginBottom: '0.75rem' }}>📡 À surveiller cette semaine</h3>
                <ul style={{ color: C.muted, fontSize: 14, lineHeight: 1.8, paddingLeft: '1.5rem' }}>
                  {(today.proposals?.external_signals_to_monitor ?? []).map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}

            {/* History */}
            <h3 style={{ fontSize: 16, color: C.accent, marginBottom: '0.75rem' }}>Historique (14 derniers jours)</h3>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(201,168,76,.05)', color: C.muted, textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Proposals</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Appliquées</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.slice(1).map((r) => (
                    <tr key={r.id} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: '0.5rem 1rem' }}>{r.day_tag}</td>
                      <td style={{ padding: '0.5rem 1rem' }}>{r.proposals?.proposals?.length ?? 0}</td>
                      <td style={{ padding: '0.5rem 1rem', color: r.status === 'applied' ? C.green : C.muted }}>
                        {r.status === 'applied' ? '✓' : '—'}
                      </td>
                      <td style={{ padding: '0.5rem 1rem', color: C.muted, fontSize: 12 }}>
                        {r.proposals?.top_signal_of_the_week?.slice(0, 80) ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div style={{ marginTop: '3rem', fontSize: 12, color: C.muted }}>
          <p>Cron : <code>0 8 * * * /root/monitor/ftg-kushina-kaizen.sh</code></p>
          <p>Agent : <code>agents/kushina-kaizen.ts</code> · table <code>ftg_kaizen_proposals</code></p>
        </div>
      </div>
    </main>
  )
}

function ProposalCard({ proposal, rowId, idx }: { proposal: Proposal; rowId: string; idx: number }) {
  const prioColor = proposal.priority >= 4 ? C.green : proposal.priority >= 3 ? C.yellow : C.muted
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${prioColor}`,
      borderRadius: 8, padding: '1.25rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: 22 }}>{CATEGORY_EMOJI[proposal.category] ?? '💡'}</span>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: C.text, fontWeight: 700 }}>
            {proposal.title}
          </h3>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {proposal.category.replace('_', ' ')} · priority {proposal.priority}/5 ·
            impact attendu <strong style={{ color: C.accent }}>{proposal.expected_impact.multiplier}</strong> sur {proposal.expected_impact.metric}
            {proposal.estimated_cost_eur > 0 && ` · ~${proposal.estimated_cost_eur}€`}
          </div>
        </div>
      </div>

      <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.5, margin: '0.75rem 0' }}>
        {proposal.rationale}
      </p>

      <ol style={{ color: C.text, fontSize: 13, lineHeight: 1.7, paddingLeft: '1.25rem', marginTop: '0.5rem' }}>
        {proposal.action_steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: '0.75rem' }}>
        {proposal.requires?.map((r, i) => (
          <span key={i} style={{ fontSize: 10, background: 'rgba(201,168,76,.1)', color: C.accent, padding: '2px 8px', borderRadius: 4, letterSpacing: '.05em' }}>
            {r}
          </span>
        ))}
      </div>

      <KaizenActions rowId={rowId} idx={idx} />
    </div>
  )
}
