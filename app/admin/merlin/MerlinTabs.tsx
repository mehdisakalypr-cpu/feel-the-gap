'use client'
import { useState } from 'react'

const C = {
  card: '#0F172A', border: 'rgba(201,168,76,.2)', accent: '#C9A84C',
  text: '#E2E8F0', muted: '#94A3B8', green: '#10B981', red: '#EF4444',
  purple: '#A78BFA', blue: '#3B82F6',
}

type Idea = {
  id: string; title: string; tagline: string | null; pitch_60s: string | null
  category: string | null; target_audience: string | null; value_prop: string | null
  monetization_model: string | null; priority: number; urgency: string
  autonomy_score: number; time_to_live_days: number | null; budget_eur: number | null
  projections: any; differentiation: string | null; agents_leveraged: string[]
  activation_stack: any; status: string; kushina_review: any; tags: string[] | null
  action_plan: any
}

type Opt = {
  id: string; file_path: string; project: string
  before_lines: number; after_lines: number; savings_lines: number; savings_pct: number
  category: string; rationale: string; before_snippet: string; after_snippet: string
  status: string; created_at: string
}

const URGENCY_COLOR: Record<string, string> = { urgent: '#EF4444', normal: C.accent, later: C.muted }
const STATUS_COLOR: Record<string, string> = {
  proposed: C.accent, reviewed: C.blue, shortlisted: C.green, planning: C.purple,
  building: '#F59E0B', shipped: C.blue, killed: C.red,
}

export default function MerlinTabs({ ideas, opts }: { ideas: Idea[]; opts: Opt[] }) {
  const [tab, setTab] = useState<'ideas' | 'code'>('ideas')

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        <TabButton active={tab === 'ideas'} onClick={() => setTab('ideas')} label={`💡 Business Ideas (${ideas.length})`} />
        <TabButton active={tab === 'code'} onClick={() => setTab('code')} label={`⚡ Code Optimizations (${opts.length})`} />
      </div>

      {tab === 'ideas' ? <IdeasList ideas={ideas} /> : <OptsList opts={opts} />}
    </div>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      padding: '0.5rem 1rem',
      background: active ? `linear-gradient(135deg, ${C.accent}, #B8953A)` : 'transparent',
      color: active ? '#000' : C.accent,
      border: `1px solid ${C.accent}`,
      borderRadius: 6,
      fontWeight: 700,
      cursor: 'pointer',
    }}>{label}</button>
  )
}

function IdeasList({ ideas }: { ideas: Idea[] }) {
  if (!ideas.length) {
    return <Empty label="Aucune idée encore. Première run demain matin 11h UTC ou lance manuellement le cron." />
  }
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {ideas.map((i) => <IdeaCard key={i.id} idea={i} />)}
    </div>
  )
}

function IdeaCard({ idea }: { idea: Idea }) {
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function updateStatus(status: string) {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch(`/api/admin/merlin/${idea.id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'error')
      setMsg(`✓ ${status}`)
      setTimeout(() => window.location.reload(), 800)
    } catch (e: any) {
      setMsg(`✗ ${e.message}`)
    } finally { setBusy(false) }
  }

  async function generatePlan() {
    setBusy(true); setMsg('⌛ generating plan…')
    try {
      const res = await fetch(`/api/admin/merlin/${idea.id}/plan`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'error')
      setMsg('✓ plan ready')
      setTimeout(() => window.location.reload(), 1000)
    } catch (e: any) {
      setMsg(`✗ ${e.message}`)
    } finally { setBusy(false) }
  }

  const prio = idea.priority ?? 3
  const statusColor = STATUS_COLOR[idea.status] ?? C.muted

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${URGENCY_COLOR[idea.urgency] ?? C.accent}`,
      borderRadius: 8, padding: '1.25rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h3 style={{ margin: 0, fontSize: 17, color: C.text }}>{idea.title}</h3>
            <span style={{ fontSize: 10, background: `${statusColor}22`, color: statusColor, padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
              {idea.status}
            </span>
            <span style={{ fontSize: 10, color: C.muted }}>P{prio} · {idea.urgency}</span>
          </div>
          {idea.tagline && <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>{idea.tagline}</div>}
        </div>
        <button onClick={() => setExpanded(!expanded)} style={{
          background: 'transparent', border: `1px solid ${C.border}`, color: C.accent,
          borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
        }}>{expanded ? '▲' : '▼ détails'}</button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: 12, color: C.muted, flexWrap: 'wrap' }}>
        {idea.category && <span>📂 {idea.category}</span>}
        {idea.monetization_model && <span>💰 {idea.monetization_model}</span>}
        {idea.time_to_live_days && <span>⏱ {idea.time_to_live_days}j → revenue</span>}
        {idea.budget_eur != null && <span>💶 {idea.budget_eur}€</span>}
        <span>🤖 autonomy {idea.autonomy_score}/100</span>
        {idea.projections?.m3_revenue_eur && <span style={{ color: C.green, fontWeight: 600 }}>→ M3 {idea.projections.m3_revenue_eur}€</span>}
        {idea.projections?.m12_revenue_eur && <span style={{ color: C.green, fontWeight: 600 }}>M12 {idea.projections.m12_revenue_eur}€</span>}
      </div>

      {idea.kushina_review && (
        <div style={{
          marginTop: '0.75rem', padding: '0.5rem 0.75rem',
          background: idea.kushina_review.verdict === 'go' ? 'rgba(16,185,129,.1)' : idea.kushina_review.verdict === 'nogo' ? 'rgba(239,68,68,.1)' : 'rgba(245,158,11,.1)',
          borderRadius: 6, fontSize: 12,
        }}>
          🌀 Kushina score {idea.kushina_review.score}/100 · <strong>{idea.kushina_review.verdict?.toUpperCase()}</strong>
          {idea.kushina_review.pivot_suggestion && <span style={{ color: C.muted }}> — {idea.kushina_review.pivot_suggestion}</span>}
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: '1rem', fontSize: 13, lineHeight: 1.6 }}>
          {idea.value_prop && <p><strong style={{ color: C.accent }}>Value prop :</strong> {idea.value_prop}</p>}
          {idea.target_audience && <p><strong style={{ color: C.accent }}>Target :</strong> {idea.target_audience}</p>}
          {idea.differentiation && <p><strong style={{ color: C.accent }}>Edge :</strong> {idea.differentiation}</p>}
          {idea.pitch_60s && (
            <div style={{ margin: '1rem 0', padding: '0.75rem', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, whiteSpace: 'pre-wrap' }}>
              <div style={{ color: C.accent, marginBottom: 6, fontWeight: 700 }}>🎤 Pitch 60s</div>
              {idea.pitch_60s}
            </div>
          )}
          {idea.agents_leveraged?.length > 0 && (
            <div style={{ fontSize: 12 }}>
              <strong style={{ color: C.accent }}>Agents :</strong> {idea.agents_leveraged.join(' · ')}
            </div>
          )}
          {idea.activation_stack?.stack && (
            <div style={{ fontSize: 12 }}>
              <strong style={{ color: C.accent }}>Stack :</strong> {idea.activation_stack.stack.join(' + ')} on {idea.activation_stack.platform}
            </div>
          )}
          {idea.action_plan?.steps && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 6 }}>
              <div style={{ color: C.green, fontWeight: 700, marginBottom: 6 }}>✅ Plan d'action</div>
              <ol style={{ margin: 0, paddingLeft: '1.25rem', fontSize: 12 }}>
                {idea.action_plan.steps.map((s: any, i: number) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    <strong>{s.title ?? s}</strong>
                    {s.duration_days && <span style={{ color: C.muted }}> · {s.duration_days}j</span>}
                    {s.cost_eur && <span style={{ color: C.muted }}> · {s.cost_eur}€</span>}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: '0.75rem', flexWrap: 'wrap' }}>
        {idea.status === 'proposed' && (
          <>
            <button onClick={() => updateStatus('shortlisted')} disabled={busy} style={btn(C.green)}>★ Shortlist</button>
            <button onClick={() => updateStatus('killed')} disabled={busy} style={btn(C.red)}>✗ Tuer</button>
          </>
        )}
        {idea.status === 'shortlisted' && !idea.action_plan && (
          <button onClick={generatePlan} disabled={busy} style={btn(C.purple)}>📋 Générer plan</button>
        )}
        {idea.status === 'shortlisted' && idea.action_plan && (
          <button onClick={() => updateStatus('building')} disabled={busy} style={btn('#F59E0B')}>🔨 En construction</button>
        )}
        {idea.status === 'building' && (
          <button onClick={() => updateStatus('shipped')} disabled={busy} style={btn(C.blue)}>🚀 Shipped</button>
        )}
        {msg && <span style={{ fontSize: 11, color: msg.startsWith('✓') ? C.green : C.red }}>{msg}</span>}
      </div>
    </div>
  )
}

function OptsList({ opts }: { opts: Opt[] }) {
  if (!opts.length) return <Empty label="Aucune optimisation proposée encore. Cron Merlin s'exécute à 11h UTC." />
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {opts.map((o) => (
        <div key={o.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <code style={{ color: C.accent }}>{o.file_path}</code>
            <span style={{ color: C.muted, fontSize: 11 }}>
              {o.category} · -{o.savings_lines} lignes ({o.savings_pct}%)
            </span>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{o.rationale}</div>
          <details style={{ fontSize: 11 }}>
            <summary style={{ cursor: 'pointer', color: C.accent }}>Voir diff</summary>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
              <pre style={{ background: 'rgba(239,68,68,.05)', padding: 8, borderRadius: 4, overflow: 'auto', fontSize: 10 }}>{o.before_snippet}</pre>
              <pre style={{ background: 'rgba(16,185,129,.05)', padding: 8, borderRadius: 4, overflow: 'auto', fontSize: 10 }}>{o.after_snippet}</pre>
            </div>
          </details>
        </div>
      ))}
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 8, padding: '2rem', textAlign: 'center', color: C.muted }}>
      {label}
    </div>
  )
}

function btn(color: string): React.CSSProperties {
  return {
    padding: '4px 10px',
    background: `${color}22`,
    color,
    border: `1px solid ${color}44`,
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
  }
}
