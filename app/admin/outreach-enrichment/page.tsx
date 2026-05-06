import { createClient } from '@supabase/supabase-js'
import OutreachEnrichmentClient from './OutreachEnrichmentClient'
import AutoEnrichButton from './AutoEnrichButton'

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

  // Enrichment hints: directory rows matching by (name, country_iso) — 2116/2833
  // rows have website_url, 717 have linkedin_url. Saves the user one lookup step.
  const directoryHints: Record<string, { website_url: string | null; linkedin_url: string | null; phone: string | null; whatsapp: string | null }> = {}
  const names = (demos ?? []).map((d) => d.full_name).filter(Boolean) as string[]
  if (names.length > 0) {
    const { data: hints } = await db
      .from('entrepreneurs_directory')
      .select('name, country_iso, website_url, linkedin_url, phone, whatsapp')
      .in('name', names)
    for (const h of hints ?? []) {
      if (!h.name || !h.country_iso) continue
      directoryHints[`${h.name.toLowerCase()}|${h.country_iso}`] = {
        website_url: h.website_url,
        linkedin_url: h.linkedin_url,
        phone: h.phone,
        whatsapp: h.whatsapp,
      }
    }
  }
  const enrichedDemos = (demos ?? []).map((d) => ({
    ...d,
    directory_hint: d.full_name && d.country_iso ? directoryHints[`${d.full_name.toLowerCase()}|${d.country_iso}`] ?? null : null,
  }))

  // Global counters for context strip.
  const [{ count: totalBlocked }, { count: totalSent }, { count: directoryContacts }] = await Promise.all([
    db.from('entrepreneur_demos').select('*', { count: 'exact', head: true })
      .eq('status', 'generated').is('outreach_sent_at', null).is('email', null),
    db.from('entrepreneur_demos').select('*', { count: 'exact', head: true })
      .not('outreach_sent_at', 'is', null),
    db.from('entrepreneurs_directory').select('*', { count: 'exact', head: true })
      .not('email', 'is', null),
  ])

  // Last 7 snapshots for trend strip
  const { data: snapshots } = await db
    .from('outreach_health_snapshots')
    .select('captured_at, demos_blocked_email, demos_sent_total, demos_sent_24h, demos_with_email, marketplace_matches_total, marketplace_matches_24h')
    .order('captured_at', { ascending: false })
    .limit(7)

  return {
    demos: enrichedDemos,
    totalBlocked: totalBlocked ?? 0,
    totalSent: totalSent ?? 0,
    directoryContacts: directoryContacts ?? 0,
    snapshots: (snapshots ?? []).reverse(),
  }
}

type Snapshot = {
  captured_at: string
  demos_blocked_email: number
  demos_sent_total: number
  demos_sent_24h: number
  demos_with_email: number
  marketplace_matches_total: number
  marketplace_matches_24h: number
}

export default async function OutreachEnrichmentPage() {
  const { demos, totalBlocked, totalSent, directoryContacts, snapshots } = await load()

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

        {snapshots.length > 0 && <TrendStrip snapshots={snapshots as Snapshot[]} />}

        <AutoEnrichButton />

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

function TrendStrip({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length === 0) return null
  const last = snapshots[snapshots.length - 1]
  const prev = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null
  const delta = (a: number, b: number | undefined) => {
    if (b == null) return ''
    const d = a - b
    if (d === 0) return ' ·  0'
    return ` · ${d > 0 ? '+' : ''}${d.toLocaleString()}`
  }
  return (
    <div style={{ marginBottom: '2rem', background: C.card, border: `1px solid ${C.border}`, padding: '1rem 1.25rem', borderRadius: 10 }}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
        📊 Trend 7 jours · dernier snapshot {new Date(last.captured_at).toLocaleString('fr-FR')}
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12, color: C.text }}>
        <span>Bloqués: <b style={{ color: '#EF4444' }}>{last.demos_blocked_email.toLocaleString()}</b><span style={{ color: C.muted }}>{delta(last.demos_blocked_email, prev?.demos_blocked_email)}</span></span>
        <span>Sent total: <b style={{ color: '#10B981' }}>{last.demos_sent_total.toLocaleString()}</b><span style={{ color: C.muted }}>{delta(last.demos_sent_total, prev?.demos_sent_total)}</span></span>
        <span>Sent 24h: <b style={{ color: C.accent }}>{last.demos_sent_24h.toLocaleString()}</b></span>
        <span>Enrichis: <b>{last.demos_with_email.toLocaleString()}</b><span style={{ color: C.muted }}>{delta(last.demos_with_email, prev?.demos_with_email)}</span></span>
        <span>Matches: <b>{last.marketplace_matches_total.toLocaleString()}</b> <span style={{ color: C.muted }}>(+{last.marketplace_matches_24h} /24h)</span></span>
      </div>
    </div>
  )
}
