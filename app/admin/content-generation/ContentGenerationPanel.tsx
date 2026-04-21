'use client'
import { useEffect, useState } from 'react'

const C = {
  card: '#0F172A', border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8',
  green: '#10B981', red: '#EF4444', btn: 'linear-gradient(135deg, #C9A84C, #B8953A)',
}

type Country = { iso2?: string; iso3?: string; name_fr: string | null }
type Opp = { id: string; product_name?: string | null; product_id?: string | null; country_iso: string; gap_value_usd: number | null }

export default function ContentGenerationPanel({ countries, topOpps }: { countries: Country[]; topOpps: Opp[] }) {
  const [mode, setMode] = useState<'full' | 'per_country' | 'per_opportunity' | 'per_pair'>('per_pair')
  const [country, setCountry] = useState('')
  const [oppId, setOppId] = useState('')
  const [jobType, setJobType] = useState<'full' | 'production_methods' | 'business_plans' | 'potential_clients' | 'youtube_videos'>('full')
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Auto-refresh every 15s
  useEffect(() => {
    if (!autoRefresh) return
    const t = setInterval(() => window.location.reload(), 15000)
    return () => clearInterval(t)
  }, [autoRefresh])

  async function trigger() {
    setLoading(true); setStatus(null)
    try {
      const res = await fetch('/api/admin/content-jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode, country_iso: country, opp_id: oppId, job_type: jobType }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setStatus(`✅ ${json.enqueued} jobs enqueued`)
      setTimeout(() => window.location.reload(), 1500)
    } catch (e: any) {
      setStatus(`❌ ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function retryFailed() {
    if (!confirm('Retry tous les jobs en failed (reset attempts=0) ?')) return
    setRetrying(true); setStatus(null)
    try {
      const res = await fetch('/api/admin/content-jobs?action=retry_failed', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setStatus(`♻️ ${json.retried} jobs re-queued`)
      setTimeout(() => window.location.reload(), 1500)
    } catch (e: any) {
      setStatus(`❌ ${e.message}`)
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '1.5rem' }}>
      <h2 style={{ fontSize: 18, color: C.accent, marginBottom: '1rem' }}>Déclencher une génération</h2>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {([
          ['per_pair', '1 paire (country × opp)'],
          ['per_opportunity', 'Par opportunité'],
          ['per_country', 'Par pays'],
          ['full', 'Full (tout)'],
        ] as const).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '0.5rem 1rem',
              background: mode === m ? C.accent : 'transparent',
              color: mode === m ? '#000' : C.text,
              border: `1px solid ${C.border}`,
              borderRadius: 6, cursor: 'pointer', fontSize: 13,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Inputs per mode */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {(mode === 'per_country' || mode === 'per_pair') && (
          <div>
            <label style={{ display: 'block', fontSize: 12, color: C.muted, marginBottom: 4 }}>Pays</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', background: '#0B1220', color: C.text, border: `1px solid ${C.border}`, borderRadius: 6 }}>
              <option value="">— choisir —</option>
              {countries.map((c) => {
                const code = c.iso3 || c.iso2 || ''
                return <option key={code} value={code}>{code} — {c.name_fr}</option>
              })}
            </select>
          </div>
        )}

        {(mode === 'per_opportunity' || mode === 'per_pair') && (
          <div>
            <label style={{ display: 'block', fontSize: 12, color: C.muted, marginBottom: 4 }}>Opportunité (top 100 par gap value)</label>
            <select value={oppId} onChange={(e) => setOppId(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', background: '#0B1220', color: C.text, border: `1px solid ${C.border}`, borderRadius: 6 }}>
              <option value="">— choisir —</option>
              {topOpps
                .filter((o) => mode === 'per_opportunity' || !country || o.country_iso === country)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.country_iso} · {o.product_name || o.product_id || '?'} (${((o.gap_value_usd || 0) / 1e6).toFixed(1)}M)
                  </option>
                ))}
            </select>
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: 12, color: C.muted, marginBottom: 4 }}>Agent(s)</label>
          <select value={jobType} onChange={(e) => setJobType(e.target.value as any)}
            style={{ width: '100%', padding: '0.5rem', background: '#0B1220', color: C.text, border: `1px solid ${C.border}`, borderRadius: 6 }}>
            <option value="full">Full (Shikamaru + Itachi + Hancock + Rock Lee)</option>
            <option value="production_methods">Production methods (Shikamaru)</option>
            <option value="business_plans">Business plans (Itachi)</option>
            <option value="potential_clients">Potential clients (Hancock)</option>
            <option value="youtube_videos">YouTube videos (Rock Lee)</option>
          </select>
        </div>
      </div>

      {mode === 'full' && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: `1px solid ${C.red}`, color: C.red, padding: '0.75rem 1rem', borderRadius: 6, marginBottom: '1rem', fontSize: 13 }}>
          ⚠ Full refresh = toutes les opportunités × tous les pays actifs. Coût potentiel important (des milliers de jobs).
        </div>
      )}

      <button
        onClick={trigger}
        disabled={loading || (mode === 'per_country' && !country) || (mode === 'per_opportunity' && !oppId) || (mode === 'per_pair' && (!country || !oppId))}
        style={{
          background: C.btn, color: '#000', border: 'none', padding: '0.75rem 1.5rem',
          fontSize: 14, fontWeight: 700, borderRadius: 6, cursor: 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? '⏳ Enqueuing...' : '🌀 Enqueue jobs'}
      </button>

      {status && (
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: status.startsWith('✅') || status.startsWith('♻️') ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)', borderRadius: 6 }}>
          {status}
        </div>
      )}

      {/* Retry + auto-refresh controls */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: `1px solid ${C.border}`, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={retryFailed}
          disabled={retrying}
          style={{
            background: 'transparent', color: C.red, border: `1px solid ${C.red}`,
            padding: '0.5rem 1rem', fontSize: 13, borderRadius: 6, cursor: 'pointer',
            opacity: retrying ? 0.6 : 1,
          }}
        >
          {retrying ? '♻️ Resetting...' : '♻️ Retry failed jobs'}
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: C.muted, fontSize: 13 }}>
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          Auto-refresh 15s
        </label>
      </div>
    </div>
  )
}
