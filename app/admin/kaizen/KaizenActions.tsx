'use client'
import { useState } from 'react'

export default function KaizenActions({ rowId, idx }: { rowId: string; idx: number }) {
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle')
  const [err, setErr] = useState<string | null>(null)

  async function update(action: 'applied' | 'deferred' | 'rejected') {
    setState('busy')
    try {
      const res = await fetch(`/api/admin/kaizen/${rowId}/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, proposal_idx: idx }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'error')
      setState('ok')
    } catch (e: any) {
      setErr(e.message ?? 'error')
      setState('err')
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12, fontSize: 12 }}>
      <button onClick={() => update('applied')} disabled={state === 'busy'} style={btn('#10B981')}>
        {state === 'ok' ? '✓ applied' : '✓ Apply'}
      </button>
      <button onClick={() => update('deferred')} disabled={state === 'busy'} style={btn('#94A3B8')}>
        ⏸ Défère
      </button>
      <button onClick={() => update('rejected')} disabled={state === 'busy'} style={btn('#EF4444')}>
        ✗ Rejeter
      </button>
      {err && <span style={{ color: '#EF4444', fontSize: 11 }}>✗ {err}</span>}
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
