import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const C = {
  bg: '#07090F', card: '#0F172A', border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8',
  green: '#10B981', red: '#EF4444', amber: '#F59E0B', blue: '#3B82F6',
}

const TYPE_META: Record<string, { label: string; color: string; severity: 'high' | 'med' | 'low' }> = {
  'charge.dispute.created':         { label: 'Dispute opened',     color: C.red,   severity: 'high' },
  'charge.dispute.closed':          { label: 'Dispute closed',     color: C.muted, severity: 'low' },
  'radar.early_fraud_warning.created': { label: 'EFW',             color: C.red,   severity: 'high' },
  'review.opened':                  { label: 'Review opened',      color: C.amber, severity: 'med' },
  'review.closed':                  { label: 'Review closed',      color: C.muted, severity: 'low' },
  'evidence_submitted':             { label: 'Evidence prefilled', color: C.blue,  severity: 'low' },
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

interface FraudRow {
  id: string
  stripe_event_id: string
  event_type: string
  payment_intent_id: string | null
  charge_id: string | null
  reason: string | null
  amount_cents: number | null
  currency: string | null
  livemode: boolean | null
  created_at: string
}

async function loadData() {
  const db = admin()
  const since7 = new Date(Date.now() - 7 * 86400_000).toISOString()
  const since1 = new Date(Date.now() - 86400_000).toISOString()

  const [rowsRes, dayRes] = await Promise.all([
    db.from('store_fraud_events')
      .select('id, stripe_event_id, event_type, payment_intent_id, charge_id, reason, amount_cents, currency, livemode, created_at')
      .gte('created_at', since7)
      .order('created_at', { ascending: false })
      .limit(500),
    db.from('store_fraud_events')
      .select('event_type', { count: 'exact', head: false })
      .gte('created_at', since1),
  ])

  const rows = (rowsRes.data ?? []) as FraudRow[]
  const day = (dayRes.data ?? []) as Array<{ event_type: string }>

  // Series 7d × type
  const series: Record<string, Record<string, number>> = {}
  for (let i = 6; i >= 0; i--) {
    const key = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10)
    series[key] = {}
  }
  for (const r of rows) {
    const key = r.created_at.slice(0, 10)
    if (!series[key]) continue
    series[key][r.event_type] = (series[key][r.event_type] ?? 0) + 1
  }

  const counts24h: Record<string, number> = {}
  for (const r of day) counts24h[r.event_type] = (counts24h[r.event_type] ?? 0) + 1
  const total24h = day.length
  const totalDisputes24h = (counts24h['charge.dispute.created'] ?? 0)
    + (counts24h['radar.early_fraud_warning.created'] ?? 0)

  // Counts 7d
  const counts7d: Record<string, number> = {}
  for (const r of rows) counts7d[r.event_type] = (counts7d[r.event_type] ?? 0) + 1

  return {
    rows: rows.slice(0, 80),
    series,
    counts24h, total24h, totalDisputes24h,
    counts7d,
    alertHigh: totalDisputes24h > 5,
  }
}

function fmtAmt(cents: number | null, ccy: string | null): string {
  if (!cents) return '-'
  return `${(cents / 100).toFixed(2)} ${ccy ?? ''}`.trim()
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default async function AdminFraudEventsPage() {
  const data = await loadData()

  // KPIs
  const kpis = [
    { label: '24h total', value: data.total24h, color: C.text },
    { label: 'Disputes + EFW 24h', value: data.totalDisputes24h, color: data.alertHigh ? C.red : C.text },
    { label: 'Reviews 24h', value: (data.counts24h['review.opened'] ?? 0), color: C.amber },
    { label: '7j total', value: Object.values(data.counts7d).reduce((a, b) => a + b, 0), color: C.text },
  ]

  // Stack chart 7d
  const dates = Object.keys(data.series).sort()
  const allTypes = Array.from(new Set(dates.flatMap(d => Object.keys(data.series[d]))))
  const max = Math.max(1, ...dates.map(d => Object.values(data.series[d]).reduce((a, b) => a + b, 0)))
  const barH = 160

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ fontSize: 11, color: C.accent, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 6 }}>
          Admin · Stripe Radar
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 8px' }}>Fraud events</h1>
        <p style={{ color: C.muted, margin: '0 0 24px', fontSize: 14 }}>
          Disputes, Early Fraud Warnings et Reviews. Source : <code style={{ color: C.accent }}>store_fraud_events</code>.
        </p>

        {data.alertHigh && (
          <div style={{ background: 'rgba(239,68,68,.1)', border: `1px solid ${C.red}`, color: C.red, padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
            ⚠️ Pic anormal — {data.totalDisputes24h} disputes/EFW dans les dernières 24h (seuil 5).
            Vérifier Stripe Dashboard et Radar rules.
          </div>
        )}

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 28 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: '.15em', textTransform: 'uppercase' }}>{k.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: k.color, marginTop: 6 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Chart 7d stacked */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: C.muted, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 14 }}>
            Événements 7 derniers jours
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: barH + 50 }}>
            {dates.map(d => {
              const dayTotal = Object.values(data.series[d]).reduce((a, b) => a + b, 0)
              return (
                <div key={d} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                  <div style={{ height: barH, display: 'flex', flexDirection: 'column-reverse', gap: 1 }}>
                    {allTypes.map(t => {
                      const n = data.series[d][t] ?? 0
                      if (n === 0) return null
                      const h = Math.round((n / max) * barH)
                      const meta = TYPE_META[t] ?? { label: t, color: C.muted, severity: 'low' as const }
                      return <div key={t} title={`${meta.label}: ${n}`} style={{ height: h, background: meta.color, borderRadius: 0 }} />
                    })}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>
                    {new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  </div>
                  <div style={{ fontSize: 10, color: C.text, fontWeight: 600 }}>{dayTotal}</div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.muted, marginTop: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {allTypes.map(t => {
              const meta = TYPE_META[t] ?? { label: t, color: C.muted }
              return (
                <span key={t}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, background: meta.color, marginRight: 4 }} />
                  {meta.label}
                </span>
              )
            })}
          </div>
        </div>

        {/* Recent events table */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
          <div style={{ fontSize: 13, color: C.muted, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 14 }}>
            Derniers événements (max 80)
          </div>
          {data.rows.length === 0 ? (
            <div style={{ color: C.muted, padding: 16, textAlign: 'center' }}>Aucun événement Radar/dispute sur les 7 derniers jours.</div>
          ) : (
            <div style={{ display: 'grid', gap: 6, fontSize: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 200px 160px 100px 1fr', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.border}`, color: C.muted, textTransform: 'uppercase', letterSpacing: '.1em', fontSize: 10 }}>
                <span>Date</span>
                <span>Type</span>
                <span>PI / Charge</span>
                <span>Montant</span>
                <span>Reason</span>
              </div>
              {data.rows.map(r => {
                const meta = TYPE_META[r.event_type] ?? { label: r.event_type, color: C.muted, severity: 'low' as const }
                const ref = r.payment_intent_id || r.charge_id || '-'
                return (
                  <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '120px 200px 160px 100px 1fr', gap: 10, padding: '6px 0', borderBottom: `1px solid rgba(255,255,255,.04)`, alignItems: 'center' }}>
                    <span style={{ color: C.muted }}>{fmtDate(r.created_at)}</span>
                    <span style={{ color: meta.color, fontWeight: 600 }}>
                      {meta.label}
                      {r.livemode === false && <span style={{ marginLeft: 6, color: C.muted, fontSize: 10 }}>(test)</span>}
                    </span>
                    <code style={{ color: C.text, fontFamily: 'Menlo, monospace', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ref}>{ref.slice(0, 20)}…</code>
                    <span style={{ color: C.text }}>{fmtAmt(r.amount_cents, r.currency)}</span>
                    <span style={{ color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.reason ?? ''}>{r.reason ?? '-'}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ fontSize: 12, color: C.muted, marginTop: 28, textAlign: 'center' }}>
          Cron <code style={{ color: C.accent }}>/api/cron/disputes-evidence</code> (06h UTC) pré-remplit les preuves dispute automatiquement.
          Soumission finale : décision humaine via Stripe Dashboard.
        </div>
      </div>
    </div>
  )
}
