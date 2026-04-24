import { createClient } from '@supabase/supabase-js'
import OutreachEnrichmentClient from './OutreachEnrichmentClient'

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

  // Top demos ready for outreach but missing email — prioritised by ROI.
  const { data: demos } = await db
    .from('entrepreneur_demos')
    .select('id, full_name, company_name, city, country_iso, sector, archetype, roi_monthly_eur, hero_message, token, linkedin_url, email, created_at')
    .eq('status', 'generated')
    .is('outreach_sent_at', null)
    .is('email', null)
    .order('roi_monthly_eur', { ascending: false, nullsFirst: false })
    .limit(50)

  // Global counters for context strip.
  const [{ count: totalBlocked }, { count: totalSent }, { count: directoryContacts }] = await Promise.all([
    db.from('entrepreneur_demos').select('*', { count: 'exact', head: true })
      .eq('status', 'generated').is('outreach_sent_at', null).is('email', null),
    db.from('entrepreneur_demos').select('*', { count: 'exact', head: true })
      .not('outreach_sent_at', 'is', null),
    db.from('entrepreneurs_directory').select('*', { count: 'exact', head: true })
      .not('email', 'is', null),
  ])

  return {
    demos: demos ?? [],
    totalBlocked: totalBlocked ?? 0,
    totalSent: totalSent ?? 0,
    directoryContacts: directoryContacts ?? 0,
  }
}

export default async function OutreachEnrichmentPage() {
  const { demos, totalBlocked, totalSent, directoryContacts } = await load()

  return (
    <main style={{ background: C.bg, color: C.text, minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ fontSize: 32, color: C.accent, marginBottom: '0.5rem' }}>
          📬 Outreach Enrichment
        </h1>
        <p style={{ color: C.muted, fontSize: 14, marginBottom: '2rem', maxWidth: 820 }}>
          Demos générés sans email — débloque l'outreach en renseignant le contact.
          Recherches LinkedIn/Google pré-remplies par ligne. Top 50 triés par ROI mensuel décroissant.
          Une saisie met à jour <code>entrepreneur_demos.email</code> + upsert <code>entrepreneurs_directory</code>.
        </p>

        <div style={{ display: 'flex', gap: 16, marginBottom: '2rem', fontSize: 14, flexWrap: 'wrap' }}>
          <Stat label="Bloqués (pas d'email)" value={totalBlocked} color="#EF4444" />
          <Stat label="Outreach envoyés" value={totalSent} color="#10B981" />
          <Stat label="Directory contacts email" value={directoryContacts} color={C.accent} />
        </div>

        <OutreachEnrichmentClient initialDemos={demos} />
      </div>
    </main>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: '0.75rem 1.25rem', borderRadius: 8, flex: '1 1 200px', minWidth: 200 }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value.toLocaleString()}</div>
    </div>
  )
}
