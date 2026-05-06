import { createClient } from '@supabase/supabase-js'
import { isAdmin, createSupabaseServer } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ContentEngineShell from './ContentEngineShell'

export const dynamic = 'force-dynamic'

const C = {
  bg: '#07090F', card: '#0F172A', border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8',
}

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function loadJobs() {
  const db = adminDb()
  const [
    { data: recentJobs },
    { count: totalJobs },
  ] = await Promise.all([
    db
      .from('content_jobs')
      .select('id, workflow, mode, status, created_at, github_run_url')
      .order('created_at', { ascending: false })
      .limit(20),
    db
      .from('content_jobs')
      .select('*', { count: 'exact', head: true }),
  ])

  return {
    recentJobs: recentJobs ?? [],
    totalJobs: totalJobs ?? 0,
  }
}

export default async function ContentEnginePage() {
  const authorized = await isAdmin()
  if (!authorized) redirect('/map')

  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()

  const { recentJobs, totalJobs } = await loadJobs()

  return (
    <main style={{ background: C.bg, color: C.text, minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: 28, color: C.accent, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>🎨</span> Content Engine
          </h1>
          <p style={{ color: C.muted, fontSize: 13, maxWidth: 700 }}>
            Déclenchez les workflows GitHub Actions du repo gapup-content-engine, suivez les jobs en temps réel et organisez les résultats dans des bibliothèques nommées.
          </p>
        </div>

        {/* Workflow info strip */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { label: 'daily-generate', time: '03:00', color: '#60A5FA' },
            { label: 'morning-publish', time: '09:00', color: '#34D399' },
            { label: 'evening-publish', time: '17:00', color: '#F59E0B' },
            { label: 'weekly-analytics', time: 'Lun 08:00', color: '#A78BFA' },
            { label: 'manual-create', time: 'Manuel', color: C.accent },
          ].map(wf => (
            <div key={wf.label} style={{
              background: '#0D1117',
              border: `1px solid ${wf.color}30`,
              borderRadius: 6,
              padding: '0.3rem 0.65rem',
              fontSize: 11,
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: wf.color, display: 'inline-block' }} />
              <span style={{ color: C.text }}>{wf.label}</span>
              <span style={{ color: C.muted }}>{wf.time}</span>
            </div>
          ))}
        </div>

        {/* Main split layout */}
        <ContentEngineShell
          adminEmail={user?.email}
          recentJobs={recentJobs}
          totalJobs={totalJobs}
        />
      </div>
    </main>
  )
}
