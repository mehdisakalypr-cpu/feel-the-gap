'use client'
import { useEffect, useState } from 'react'

// Auto-refresh + Run-now controls for the Eishi coverage dashboard.
export default function CoverageControls() {
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [running, setRunning] = useState<null | 'videos' | 'base'>(null)
  const [lastRun, setLastRun] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(30)

  useEffect(() => {
    if (!autoRefresh) return
    const tick = setInterval(() => {
      setCountdown((s) => {
        if (s <= 1) {
          window.location.reload()
          return 30
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [autoRefresh])

  async function runNow(kind: 'videos' | 'base') {
    setRunning(kind)
    setLastRun(null)
    try {
      const res = await fetch(`/api/admin/eishi-run-now?kind=${kind}`, { method: 'POST' })
      const json = await res.json()
      setLastRun(json.ok
        ? `✓ ${kind} launched (pid ${json.pid}) — refresh dans 60s`
        : `✗ ${json.error ?? 'error'}`)
    } catch (e: any) {
      setLastRun(`✗ ${e.message}`)
    } finally {
      setRunning(null)
    }
  }

  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
      background: 'rgba(201,168,76,.05)', border: '1px solid rgba(201,168,76,.2)',
      padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1.5rem', fontSize: 13,
    }}>
      <button
        onClick={() => runNow('videos')}
        disabled={running === 'videos'}
        style={btnStyle(running === 'videos')}>
        {running === 'videos' ? '⌛ Running…' : '🎥 Run Rock Lee v2 now'}
      </button>
      <button
        onClick={() => runNow('base')}
        disabled={running === 'base'}
        style={btnStyle(running === 'base')}>
        {running === 'base' ? '⌛ Running…' : '🍴 Run Eishi Layer 1 now'}
      </button>

      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#94A3B8', cursor: 'pointer' }}>
        <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
        Auto-refresh 30s {autoRefresh && <span style={{ color: '#C9A84C', fontVariantNumeric: 'tabular-nums' }}>({countdown}s)</span>}
      </label>

      {lastRun && (
        <span style={{ color: lastRun.startsWith('✓') ? '#10B981' : '#EF4444', fontSize: 12 }}>{lastRun}</span>
      )}
    </div>
  )
}

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.5rem 1rem',
    background: disabled ? 'rgba(201,168,76,.2)' : 'linear-gradient(135deg, #C9A84C, #B8953A)',
    color: disabled ? '#94A3B8' : '#07090F',
    border: 0,
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
