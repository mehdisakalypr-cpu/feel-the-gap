'use client'
import { useState } from 'react'

const C = {
  card: '#0F172A', border: 'rgba(201,168,76,.2)', accent: '#C9A84C',
  text: '#E2E8F0', muted: '#94A3B8', green: '#10B981', red: '#EF4444', blue: '#3B82F6',
}

type Lead = {
  id: string; full_name: string | null; email: string | null; linkedin_url: string | null
  title: string | null; company_name: string | null; company_country_iso: string | null
  segment: string | null; gap_match_score: number; gap_match_opps: any[] | null
  source: string; signals: any; tier_target: string | null; company_size_range: string | null
}

export default function LeadApprovalClient({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads)
  const [idx, setIdx] = useState(0)
  const [busy, setBusy] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const current = leads[idx]

  async function decide(action: 'approved' | 'rejected', targetIds?: string[]) {
    setBusy(true)
    try {
      const ids = targetIds ?? [current?.id].filter(Boolean)
      if (!ids.length) return
      const res = await fetch('/api/admin/leads/decision', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids, action }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'error')
      // Remove decided leads
      setLeads((prev) => prev.filter((l) => !ids.includes(l.id)))
      setSelected(new Set())
      if (idx >= leads.length - ids.length) setIdx(Math.max(0, leads.length - ids.length - 1))
    } catch (e: any) {
      alert(e.message ?? 'error')
    } finally {
      setBusy(false)
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  if (!leads.length) {
    return (
      <div style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 8, padding: '3rem', textAlign: 'center', color: C.muted }}>
        <div style={{ fontSize: 48 }}>🎉</div>
        <div style={{ marginTop: '1rem' }}>Tous les leads pending validés. Retour dans quelques heures quand Lead Intelligence aura ingéré la prochaine vague Apollo.</div>
      </div>
    )
  }

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        <button onClick={() => setBulkMode(false)} style={btn(!bulkMode ? C.accent : 'transparent', !bulkMode ? '#000' : C.accent)}>
          Swipe 1 par 1
        </button>
        <button onClick={() => setBulkMode(true)} style={btn(bulkMode ? C.accent : 'transparent', bulkMode ? '#000' : C.accent)}>
          Bulk ({leads.length})
        </button>
      </div>

      {bulkMode ? (
        <BulkView leads={leads} selected={selected} toggle={toggleSelect} decide={decide} busy={busy} />
      ) : (
        <SwipeView lead={current} total={leads.length} idx={idx} onPrev={() => setIdx(Math.max(0, idx - 1))}
          onNext={() => setIdx(Math.min(leads.length - 1, idx + 1))}
          onApprove={() => decide('approved')} onReject={() => decide('rejected')} busy={busy} />
      )}
    </div>
  )
}

function SwipeView({ lead, total, idx, onPrev, onNext, onApprove, onReject, busy }: {
  lead: Lead; total: number; idx: number
  onPrev: () => void; onNext: () => void
  onApprove: () => void; onReject: () => void; busy: boolean
}) {
  if (!lead) return null
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1.5rem' }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>Lead {idx + 1} / {total} · source {lead.source}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{lead.full_name ?? '(nom manquant)'}</div>
      {lead.title && <div style={{ color: C.muted, fontSize: 14 }}>{lead.title}{lead.company_name && ` · ${lead.company_name}`}</div>}

      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', fontSize: 12, color: C.muted }}>
        {lead.company_country_iso && <span>🌍 {lead.company_country_iso}</span>}
        {lead.company_size_range && <span>👥 {lead.company_size_range}</span>}
        {lead.segment && <span>🎯 {lead.segment}</span>}
        {lead.tier_target && <span>💎 {lead.tier_target}</span>}
        {lead.email && <span style={{ color: C.green }}>✉ email</span>}
        {lead.linkedin_url && <span style={{ color: C.blue }}>🔗 linkedin</span>}
      </div>

      <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(201,168,76,.05)', borderRadius: 6 }}>
        <div style={{ fontSize: 13, color: C.accent, fontWeight: 700 }}>Gap-match {lead.gap_match_score}/100</div>
        {lead.gap_match_opps?.slice(0, 3).map((o: any, i: number) => (
          <div key={i} style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
            • {o.product_name} × <strong>{o.country_iso}</strong>
            {o.gap_value_usd && <span> — gap ${(o.gap_value_usd / 1e6).toFixed(1)}M</span>}
            {o.opportunity_score && <span> · score {o.opportunity_score}/100</span>}
          </div>
        ))}
      </div>

      {lead.signals?.matched_keywords?.length > 0 && (
        <div style={{ marginTop: '0.75rem', fontSize: 11, color: C.muted }}>
          Signals : {lead.signals.matched_keywords.join(', ')}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: '1.5rem' }}>
        <button onClick={onReject} disabled={busy} style={{ ...btn(C.red, '#fff'), flex: 1, padding: '0.75rem' }}>
          ✗ Rejeter
        </button>
        <button onClick={onNext} disabled={busy} style={{ ...btn('transparent', C.muted), padding: '0.75rem 1rem' }}>
          ⏭ Skip
        </button>
        <button onClick={onApprove} disabled={busy} style={{ ...btn(C.green, '#fff'), flex: 2, padding: '0.75rem' }}>
          ✓ Approuver (entre dans sequences)
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: C.muted }}>
        <button onClick={onPrev} style={{ background: 'none', border: 0, color: C.muted, cursor: 'pointer' }}>← précédent</button>
        <span>raccourcis : ← / → skip · enter approve · escape reject</span>
      </div>
    </div>
  )
}

function BulkView({ leads, selected, toggle, decide, busy }: {
  leads: Lead[]; selected: Set<string>; toggle: (id: string) => void
  decide: (action: 'approved' | 'rejected', ids?: string[]) => void; busy: boolean
}) {
  const selectAll = () => selected.size === leads.length ? leads.forEach((l) => toggle(l.id)) : leads.filter(l => !selected.has(l.id)).forEach((l) => toggle(l.id))

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <button onClick={selectAll} style={btn('transparent', C.accent)}>
          {selected.size === leads.length ? 'Deselect all' : 'Select all'}
        </button>
        <span style={{ fontSize: 12, color: C.muted }}>{selected.size} / {leads.length} sélectionnés</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => decide('rejected', [...selected])} disabled={busy || !selected.size} style={btn(C.red, '#fff')}>
          ✗ Rejeter ({selected.size})
        </button>
        <button onClick={() => decide('approved', [...selected])} disabled={busy || !selected.size} style={btn(C.green, '#fff')}>
          ✓ Approuver ({selected.size})
        </button>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
        {leads.map((lead) => (
          <div key={lead.id} onClick={() => toggle(lead.id)} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem 1rem',
            borderBottom: `1px solid rgba(201,168,76,.08)`, cursor: 'pointer',
            background: selected.has(lead.id) ? 'rgba(16,185,129,.05)' : 'transparent',
          }}>
            <input type="checkbox" checked={selected.has(lead.id)} readOnly />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{lead.full_name ?? 'n/a'} · {lead.title ?? ''}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{lead.company_name} · {lead.company_country_iso} · {lead.segment}</div>
            </div>
            <div style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>{lead.gap_match_score}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function btn(bg: string, fg: string): React.CSSProperties {
  return {
    padding: '6px 14px', fontSize: 12, fontWeight: 600,
    background: bg,
    color: fg,
    border: `1px solid ${bg === 'transparent' ? fg : bg}`,
    borderRadius: 6, cursor: 'pointer',
  }
}
