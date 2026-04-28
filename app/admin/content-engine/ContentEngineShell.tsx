'use client'

import { useState } from 'react'
import ContentEngineForm from './ContentEngineForm'
import ResultGallery from './ResultGallery'

const C = {
  bg: '#07090F', card: '#0F172A', border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8',
}

interface Props {
  adminEmail?: string
  recentJobs: Array<{
    id: string
    workflow: string
    mode: string | null
    status: string
    created_at: string
    github_run_url: string | null
  }>
  totalJobs: number
}

export default function ContentEngineShell({ adminEmail, recentJobs, totalJobs }: Props) {
  const [triggeredJobIds, setTriggeredJobIds] = useState<string[]>([])

  function handleJobTriggered(runId: string, _runUrl: string) {
    setTriggeredJobIds(prev => [runId, ...prev])
  }

  const activeCount = recentJobs.filter(j => j.status === 'queued' || j.status === 'running').length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '40% 1fr', gap: 24, alignItems: 'start' }}>

      {/* LEFT — Form + Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Stats strip */}
        <div style={{ display: 'flex', gap: 10 }}>
          <StatBadge label="Total jobs" value={totalJobs} color={C.accent} />
          <StatBadge label="Actifs" value={activeCount} color={activeCount > 0 ? '#60A5FA' : C.muted} />
        </div>

        {/* Form card */}
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: '1.25rem',
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🎬</span>
            Déclencher un workflow
          </h2>
          <ContentEngineForm onJobTriggered={handleJobTriggered} adminEmail={adminEmail} />
        </div>

        {/* Jobs récents serveur (pre-loaded) */}
        {recentJobs.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1rem' }}>
            <h3 style={{ fontSize: 12, color: C.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Derniers jobs (serveur)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentJobs.slice(0, 5).map(job => (
                <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <StatusDot status={job.status} />
                  <span style={{ color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {job.mode ?? job.workflow} #{job.id.slice(-6)}
                  </span>
                  <span style={{ color: C.muted, flexShrink: 0 }}>
                    {new Date(job.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT — Gallery */}
      <div style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '1.25rem',
        minHeight: 400,
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🖼</span>
          Résultats & Bibliothèques
        </h2>
        <ResultGallery recentJobIds={triggeredJobIds} />
      </div>

      {/* Mobile: stack vertically */}
      <style>{`
        @media (max-width: 900px) {
          .content-engine-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: '#0D1117',
      border: `1px solid rgba(201,168,76,.15)`,
      borderRadius: 8,
      padding: '0.5rem 0.9rem',
      flex: 1,
    }}>
      <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

const STATUS_COLOR: Record<string, string> = {
  queued: '#F59E0B',
  running: '#60A5FA',
  success: '#10B981',
  failure: '#EF4444',
  cancelled: '#94A3B8',
}

function StatusDot({ status }: { status: string }) {
  return (
    <span style={{
      width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
      background: STATUS_COLOR[status] ?? '#94A3B8',
      boxShadow: status === 'running' ? `0 0 5px ${STATUS_COLOR.running}` : 'none',
    }} />
  )
}
