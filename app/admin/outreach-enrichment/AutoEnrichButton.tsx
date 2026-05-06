'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const C = {
  card: '#0F172A',
  border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C',
  text: '#E2E8F0',
  muted: '#94A3B8',
}

type Result = {
  ok: boolean
  processed?: number
  pushed_email?: number
  matched_company?: number
  matched_person?: number
  no_company?: number
  no_person?: number
  no_email?: number
  errors?: number
  duration_ms?: number
  error?: string
}

export default function AutoEnrichButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [limit, setLimit] = useState(200)
  const [dryRun, setDryRun] = useState(true)
  const [target, setTarget] = useState<'leads' | 'demos'>('leads')
  const [result, setResult] = useState<Result | null>(null)

  async function run() {
    setBusy(true)
    setResult(null)
    try {
      const apply = dryRun ? '0' : '1'
      const country = target === 'leads' ? 'FR,GB' : 'FRA,GBR'
      const res = await fetch(`/api/cron/demo-enrichment?apply=${apply}&limit=${limit}&country=${country}&target=${target}`, {
        cache: 'no-store',
      })
      const json = (await res.json()) as Result
      setResult(json)
      if (json.ok && !dryRun && (json.pushed_email ?? 0) > 0) {
        router.refresh()
      }
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginBottom: '2rem', background: C.card, border: `1px solid ${C.border}`, padding: '1rem 1.25rem', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, marginBottom: 2 }}>🤖 Auto-enrich (vault → demos)</div>
          <div style={{ fontSize: 11, color: C.muted, maxWidth: 520 }}>
            Pull les emails validés du leads vault (lv_persons + lv_contacts) et push sur les demos sans email.
            Le vault est rempli par les crons leads-vault-* (Companies House, INPI, email-permutator, mailscout).
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.text }}>
            target
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as 'leads' | 'demos')}
              style={{ padding: '4px 6px', background: '#07090F', color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}
            >
              <option value="leads">commerce_leads (FR/GB · 388k)</option>
              <option value="demos">entrepreneur_demos (émergents · 42k)</option>
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.text }}>
            limit
            <input
              type="number"
              min={1}
              max={500}
              value={limit}
              onChange={(e) => setLimit(Math.min(Math.max(1, Number(e.target.value) || 1), 500))}
              style={{ width: 64, padding: '4px 6px', background: '#07090F', color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.text }}>
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            dry-run
          </label>
          <button
            type="button"
            onClick={run}
            disabled={busy}
            style={{
              padding: '8px 16px',
              background: busy ? '#3a3a3a' : C.accent,
              color: '#07090F',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            {busy ? '⏳ Run…' : '▶ Run batch'}
          </button>
        </div>
      </div>
      {result && (
        <div style={{ marginTop: 12, padding: '8px 12px', background: '#07090F', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text, fontFamily: 'monospace' }}>
          {result.ok ? (
            <>
              <span style={{ color: C.accent }}>✓ {dryRun ? 'DRY-RUN' : 'APPLIED'}</span>
              {' · '}
              processed=<b>{result.processed}</b>
              {' · '}
              <span style={{ color: '#10B981' }}>pushed=<b>{result.pushed_email}</b></span>
              {' · '}
              matched_company=<b>{result.matched_company}</b>
              {' · '}
              matched_person=<b>{result.matched_person}</b>
              {' · '}
              <span style={{ color: '#EF4444' }}>
                no_company={result.no_company} no_person={result.no_person} no_email={result.no_email}
              </span>
              {' · '}
              {result.duration_ms}ms
              {result.errors ? <span style={{ color: '#EF4444' }}> · errors={result.errors}</span> : null}
            </>
          ) : (
            <span style={{ color: '#EF4444' }}>✗ {result.error ?? 'unknown error'}</span>
          )}
        </div>
      )}
    </div>
  )
}
