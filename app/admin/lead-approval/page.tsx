import { createClient } from '@supabase/supabase-js'
import LeadApprovalClient from './LeadApprovalClient'

export const dynamic = 'force-dynamic'

const C = {
  bg: '#07090F', card: '#0F172A', border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8',
}

async function load() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const [pending, approved, rejected] = await Promise.all([
    db.from('ftg_leads')
      .select('id, full_name, email, linkedin_url, title, company_name, company_country_iso, segment, gap_match_score, gap_match_opps, source, signals, tier_target, company_size_range')
      .eq('approval_status', 'pending')
      .order('gap_match_score', { ascending: false })
      .limit(100),
    db.from('ftg_leads').select('*', { count: 'exact', head: true }).eq('approval_status', 'approved'),
    db.from('ftg_leads').select('*', { count: 'exact', head: true }).eq('approval_status', 'rejected'),
  ])
  return {
    pending: pending.data ?? [],
    approvedCount: approved.count ?? 0,
    rejectedCount: rejected.count ?? 0,
  }
}

export default async function LeadApprovalPage() {
  const { pending, approvedCount, rejectedCount } = await load()

  return (
    <main style={{ background: C.bg, color: C.text, minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: 32, color: C.accent, marginBottom: '0.5rem' }}>✅ Lead Approval Gate</h1>
        <p style={{ color: C.muted, fontSize: 14, marginBottom: '2rem' }}>
          Validation humaine avant que les agents engagent. Tu restes invisible — le produit parle via les personas d'outreach.
          Swipe ✓ / ✗ / ⏭. Les approuvés entrent dans les sequences actives.
        </p>

        <div style={{ display: 'flex', gap: 16, marginBottom: '2rem', fontSize: 14 }}>
          <Stat label="Pending" value={pending.length} color={C.accent} />
          <Stat label="Approved total" value={approvedCount} color="#10B981" />
          <Stat label="Rejected total" value={rejectedCount} color="#EF4444" />
        </div>

        <LeadApprovalClient initialLeads={pending as any} />
      </div>
    </main>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: '0.75rem 1.25rem', borderRadius: 8, flex: 1 }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value.toLocaleString()}</div>
    </div>
  )
}
