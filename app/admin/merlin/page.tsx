import { createClient } from '@supabase/supabase-js'
import MerlinTabs from './MerlinTabs'

export const dynamic = 'force-dynamic'

const C = {
  bg: '#07090F', card: '#0F172A', border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8',
  green: '#10B981', purple: '#A78BFA',
}

async function load() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const [ideasRes, optsRes] = await Promise.all([
    db.from('business_ideas').select('*').order('priority', { ascending: false }).order('created_at', { ascending: false }).limit(60),
    db.from('code_optimizations').select('*').order('created_at', { ascending: false }).limit(40),
  ])
  return { ideas: ideasRes.data ?? [], opts: optsRes.data ?? [] }
}

export default async function MerlinPage() {
  const { ideas, opts } = await load()

  const byStatus = {
    proposed: ideas.filter((i: any) => i.status === 'proposed').length,
    shortlisted: ideas.filter((i: any) => i.status === 'shortlisted').length,
    building: ideas.filter((i: any) => i.status === 'building').length,
    shipped: ideas.filter((i: any) => i.status === 'shipped').length,
    killed: ideas.filter((i: any) => i.status === 'killed').length,
  }

  return (
    <main style={{ background: C.bg, color: C.text, minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '0.5rem' }}>
          <span style={{ fontSize: 40 }}>🧙</span>
          <h1 style={{ fontSize: 32, color: C.accent, margin: 0 }}>Merlin — Sage Infinity</h1>
        </div>
        <p style={{ color: C.muted, fontSize: 14, marginBottom: '1.5rem', maxWidth: 900 }}>
          Générateur d'idées business + auditeur code. Chaque matin 11h UTC, Merlin propose 10-20 business
          activables par notre armée d'agents (Kushina review) + scanne les 8 plus gros fichiers FTG pour
          proposer des simplifications qui préservent sens/philosophie.
        </p>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
          <Stat label="Ideas proposed" value={byStatus.proposed} color={C.accent} />
          <Stat label="Shortlisted" value={byStatus.shortlisted} color={C.green} />
          <Stat label="Building" value={byStatus.building} color={C.purple} />
          <Stat label="Shipped" value={byStatus.shipped} color="#3B82F6" />
          <Stat label="Killed by Kushina" value={byStatus.killed} color="#EF4444" />
          <Stat label="Code opts" value={opts.length} color={C.muted} />
        </div>

        <MerlinTabs ideas={ideas as any} opts={opts as any} />

        <div style={{ marginTop: '2rem', fontSize: 12, color: C.muted }}>
          <p>Cron : <code>0 11 * * * /root/monitor/ftg-merlin.sh</code> (après Kushina 08h + Might Guy 10h)</p>
          <p>Agents : <code>agents/merlin-business-ideas.ts</code> + <code>agents/merlin-code-audit.ts</code></p>
        </div>
      </div>
    </main>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '1rem' }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}
