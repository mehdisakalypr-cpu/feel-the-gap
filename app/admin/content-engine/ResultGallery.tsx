'use client'

import { useState, useEffect, useCallback } from 'react'

const C = {
  bg: '#07090F', card: '#0F172A', border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8',
  green: '#10B981', red: '#EF4444', yellow: '#F59E0B',
}

interface ContentJob {
  id: string
  workflow: string
  mode: string | null
  status: string
  inputs: Record<string, unknown> | null
  triggered_by: string | null
  github_run_url: string | null
  artifacts_path: string | null
  created_at: string
  finished_at: string | null
}

interface Library {
  id: string
  name: string
  slug: string
  description: string | null
}

interface Artifact {
  id: number
  name: string
  size_in_bytes: number
  archive_download_url: string
}

interface JobDetail {
  job: ContentJob
  artifacts: Artifact[]
}

const STATUS_COLOR: Record<string, string> = {
  queued: '#F59E0B',
  running: '#60A5FA',
  success: '#10B981',
  failure: '#EF4444',
  cancelled: '#94A3B8',
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'En file',
  running: 'En cours',
  success: 'Terminé',
  failure: 'Échec',
  cancelled: 'Annulé',
}

interface Props {
  recentJobIds: string[]
}

export default function ResultGallery({ recentJobIds }: Props) {
  const [tab, setTab] = useState<'recents' | 'libraries'>('recents')
  const [jobs, setJobs] = useState<ContentJob[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null)
  const [libraries, setLibraries] = useState<Library[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [targetLibrary, setTargetLibrary] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [polling, setPolling] = useState<NodeJS.Timeout | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchJobs = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/admin/content-engine/jobs?limit=30')
      if (res.ok) {
        const json = await res.json()
        setJobs(json.jobs ?? [])
      }
    } finally {
      setRefreshing(false)
    }
  }, [])

  const fetchLibraries = useCallback(async () => {
    const res = await fetch('/api/admin/content-engine/libraries')
    if (res.ok) {
      const json = await res.json()
      setLibraries(json.libraries ?? [])
    }
  }, [])

  useEffect(() => {
    fetchJobs()
    fetchLibraries()
  }, [fetchJobs, fetchLibraries])

  // Auto-refresh job list when new job IDs arrive
  useEffect(() => {
    if (recentJobIds.length > 0) {
      fetchJobs()
    }
  }, [recentJobIds, fetchJobs])

  // Poll active jobs every 5s
  useEffect(() => {
    const hasActive = jobs.some(j => j.status === 'queued' || j.status === 'running')
    if (hasActive) {
      const t = setInterval(fetchJobs, 5000)
      setPolling(t)
      return () => clearInterval(t)
    } else {
      if (polling) { clearInterval(polling); setPolling(null) }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs])

  async function loadJobDetail(jobId: string) {
    if (selectedJobId === jobId) { setSelectedJobId(null); setJobDetail(null); return }
    setSelectedJobId(jobId)
    setLoadingDetail(true)
    setJobDetail(null)
    try {
      const res = await fetch(`/api/admin/content-engine/jobs/${jobId}`)
      if (res.ok) {
        const json = await res.json()
        setJobDetail(json)
        // Update job in list
        setJobs(prev => prev.map(j => j.id === jobId ? json.job : j))
      }
    } finally {
      setLoadingDetail(false)
    }
  }

  function toggleItem(key: string) {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function saveToLibrary() {
    if (!targetLibrary || selectedItems.size === 0 || !jobDetail) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const promises = Array.from(selectedItems).map(key => {
        const artifact = jobDetail.artifacts.find(a => String(a.id) === key)
        if (!artifact) return Promise.resolve()
        return fetch('/api/admin/content-engine/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            library_id: targetLibrary,
            job_id: jobDetail.job.id,
            variant_id: artifact.name,
            media_url: artifact.archive_download_url,
            persona: (jobDetail.job.inputs as Record<string, unknown>)?.persona as string ?? null,
            target_saas: (jobDetail.job.inputs as Record<string, unknown>)?.target_saas as string ?? null,
          }),
        })
      })
      await Promise.all(promises)
      setSaveMsg(`${selectedItems.size} élément(s) sauvegardé(s)`)
      setSelectedItems(new Set())
    } catch {
      setSaveMsg('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.4rem 0.9rem',
    fontSize: 12,
    fontWeight: active ? 700 : 400,
    color: active ? C.accent : C.muted,
    background: 'none',
    border: 'none',
    borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent',
    cursor: 'pointer',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}` }}>
        <button style={tabStyle(tab === 'recents')} onClick={() => setTab('recents')}>Récents</button>
        <button style={tabStyle(tab === 'libraries')} onClick={() => setTab('libraries')}>Bibliothèques</button>
        <button
          onClick={fetchJobs}
          disabled={refreshing}
          style={{ marginLeft: 'auto', fontSize: 11, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem 0.5rem', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          {refreshing ? (
            <span style={{ width: 10, height: 10, border: `1.5px solid ${C.muted}`, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
          ) : '↻'}
          Actualiser
        </button>
      </div>

      {tab === 'recents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {jobs.length === 0 ? (
            <p style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '2rem 0' }}>
              Aucun job encore. Déclenchez un workflow ci-contre.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {jobs.map(job => (
                <div key={job.id}>
                  <button
                    onClick={() => loadJobDetail(job.id)}
                    style={{
                      width: '100%',
                      background: selectedJobId === job.id ? `${C.accent}10` : '#0D1117',
                      border: `1px solid ${selectedJobId === job.id ? C.accent + '40' : C.border}`,
                      borderRadius: 8,
                      padding: '0.65rem 0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: STATUS_COLOR[job.status] ?? C.muted,
                      boxShadow: job.status === 'running' ? `0 0 6px ${STATUS_COLOR.running}` : 'none',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: C.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {job.mode ?? job.workflow} — #{job.id.slice(-6)}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted }}>
                        {new Date(job.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: STATUS_COLOR[job.status] ?? C.muted, flexShrink: 0 }}>
                      {STATUS_LABEL[job.status] ?? job.status}
                    </span>
                    {job.github_run_url && (
                      <a
                        href={job.github_run_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: 10, color: C.muted, flexShrink: 0, textDecoration: 'none' }}
                      >
                        GH ↗
                      </a>
                    )}
                  </button>

                  {selectedJobId === job.id && (
                    <div style={{ background: '#0A0E18', border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '0.75rem' }}>
                      {loadingDetail ? (
                        <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '1rem 0' }}>Chargement des artefacts...</p>
                      ) : jobDetail ? (
                        <JobDetailPanel
                          jobDetail={jobDetail}
                          libraries={libraries}
                          selectedItems={selectedItems}
                          targetLibrary={targetLibrary}
                          saving={saving}
                          saveMsg={saveMsg}
                          onToggleItem={toggleItem}
                          onTargetLibraryChange={setTargetLibrary}
                          onSave={saveToLibrary}
                        />
                      ) : (
                        <p style={{ fontSize: 12, color: C.muted }}>Impossible de charger les détails.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'libraries' && (
        <LibrariesPanel libraries={libraries} onRefresh={fetchLibraries} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function JobDetailPanel({
  jobDetail,
  libraries,
  selectedItems,
  targetLibrary,
  saving,
  saveMsg,
  onToggleItem,
  onTargetLibraryChange,
  onSave,
}: {
  jobDetail: JobDetail
  libraries: Library[]
  selectedItems: Set<string>
  targetLibrary: string
  saving: boolean
  saveMsg: string | null
  onToggleItem: (key: string) => void
  onTargetLibraryChange: (v: string) => void
  onSave: () => void
}) {
  const { job, artifacts } = jobDetail

  if (job.status === 'queued' || job.status === 'running') {
    return (
      <div style={{ textAlign: 'center', padding: '1rem', fontSize: 12, color: C.muted }}>
        <div style={{ width: 20, height: 20, border: `2px solid ${C.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 0.5rem' }} />
        Workflow en cours... Les artefacts seront disponibles après la fin.
      </div>
    )
  }

  if (job.status === 'failure') {
    return (
      <div style={{ fontSize: 12, color: C.red, padding: '0.5rem' }}>
        Le workflow a échoué.{' '}
        {job.github_run_url && (
          <a href={job.github_run_url} target="_blank" rel="noopener noreferrer" style={{ color: C.accent }}>
            Voir les logs GitHub ↗
          </a>
        )}
      </div>
    )
  }

  if (artifacts.length === 0) {
    return (
      <p style={{ fontSize: 12, color: C.muted, padding: '0.5rem' }}>
        Aucun artefact disponible pour ce job.
      </p>
    )
  }

  const inputsMeta = job.inputs as Record<string, unknown> | null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {inputsMeta && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
          {Boolean(inputsMeta.persona) && <Tag label="Persona" value={String(inputsMeta.persona)} />}
          {Boolean(inputsMeta.target_saas) && <Tag label="SaaS" value={String(inputsMeta.target_saas)} />}
          {Boolean(inputsMeta.mode) && <Tag label="Mode" value={String(inputsMeta.mode)} />}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
        {artifacts.map(artifact => {
          const key = String(artifact.id)
          const checked = selectedItems.has(key)
          const isVideo = artifact.name.endsWith('.mp4') || artifact.name.includes('video')
          return (
            <div
              key={artifact.id}
              onClick={() => onToggleItem(key)}
              style={{
                background: checked ? `${C.accent}15` : '#0D1117',
                border: `1.5px solid ${checked ? C.accent : C.border}`,
                borderRadius: 8,
                padding: 8,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                position: 'relative',
              }}
            >
              <div style={{
                width: '100%', aspectRatio: '1', background: '#1F2937', borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24,
              }}>
                {isVideo ? '🎬' : '🖼'}
              </div>
              <div style={{ fontSize: 10, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {artifact.name}
              </div>
              <div style={{ fontSize: 9, color: C.muted }}>
                {(artifact.size_in_bytes / 1024).toFixed(1)} KB
              </div>
              {checked && (
                <div style={{
                  position: 'absolute', top: 4, right: 4,
                  background: C.accent, borderRadius: '50%',
                  width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: '#07090F', fontWeight: 700,
                }}>
                  ✓
                </div>
              )}
            </div>
          )
        })}
      </div>

      {selectedItems.size > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={targetLibrary}
            onChange={e => onTargetLibraryChange(e.target.value)}
            style={{
              flex: 1, minWidth: 140, background: '#0D1117', border: `1px solid ${C.border}`,
              borderRadius: 8, color: C.text, padding: '0.45rem 0.7rem', fontSize: 12,
            }}
          >
            <option value="">-- Choisir une bibliothèque --</option>
            {libraries.map(lib => (
              <option key={lib.id} value={lib.id}>{lib.name}</option>
            ))}
          </select>
          <button
            onClick={onSave}
            disabled={saving || !targetLibrary}
            style={{
              background: targetLibrary ? C.accent : C.muted,
              color: '#07090F', fontWeight: 700, fontSize: 12,
              padding: '0.45rem 0.9rem', borderRadius: 8, border: 'none',
              cursor: saving || !targetLibrary ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {saving ? 'Sauvegarde...' : `Ajouter ${selectedItems.size} à la biblio`}
          </button>
        </div>
      )}

      {saveMsg && (
        <div style={{ fontSize: 11, color: C.green, padding: '0.4rem 0.6rem', background: `${C.green}10`, borderRadius: 6 }}>
          {saveMsg}
        </div>
      )}
    </div>
  )
}

function Tag({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ background: `${C.accent}15`, color: C.accent, border: `1px solid ${C.accent}30`, borderRadius: 4, padding: '1px 6px', fontSize: 10 }}>
      {label}: <b>{value}</b>
    </span>
  )
}

function LibrariesPanel({ libraries, onRefresh }: { libraries: Library[]; onRefresh: () => void }) {
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function createLibrary() {
    if (!name || !slug) return
    setCreating(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/content-engine/libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, description }),
      })
      if (res.ok) {
        setMsg('Bibliothèque créée')
        setName(''); setSlug(''); setDescription('')
        setShowCreate(false)
        onRefresh()
      } else {
        const json = await res.json()
        setMsg(json.error ?? 'Erreur')
      }
    } finally {
      setCreating(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#0D1117',
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.text,
    padding: '0.45rem 0.7rem',
    fontSize: 12,
    boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: C.muted }}>{libraries.length} bibliothèque(s)</span>
        <button
          onClick={() => setShowCreate(v => !v)}
          style={{ background: C.accent, color: '#07090F', fontWeight: 700, fontSize: 11, padding: '0.35rem 0.75rem', borderRadius: 6, border: 'none', cursor: 'pointer' }}
        >
          + Nouvelle bibliothèque
        </button>
      </div>

      {showCreate && (
        <div style={{ background: '#0D1117', border: `1px solid ${C.border}`, borderRadius: 8, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom" style={inputStyle} />
          <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="slug-unique" style={inputStyle} />
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optionnel)" style={inputStyle} />
          {msg && <p style={{ fontSize: 11, color: C.green }}>{msg}</p>}
          <button
            onClick={createLibrary}
            disabled={creating || !name || !slug}
            style={{ background: name && slug ? C.accent : C.muted, color: '#07090F', fontWeight: 700, fontSize: 12, padding: '0.4rem 0.8rem', borderRadius: 6, border: 'none', cursor: 'pointer' }}
          >
            {creating ? 'Création...' : 'Créer'}
          </button>
        </div>
      )}

      {libraries.length === 0 ? (
        <p style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '1.5rem 0' }}>
          Aucune bibliothèque. Créez-en une pour organiser vos contenus.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {libraries.map(lib => (
            <div
              key={lib.id}
              style={{ background: '#0D1117', border: `1px solid ${C.border}`, borderRadius: 8, padding: '0.65rem 0.9rem', display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{lib.name}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{lib.slug}</div>
                {lib.description && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{lib.description}</div>}
              </div>
              <a
                href={`/api/admin/content-engine/libraries/${lib.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 10, color: C.accent, textDecoration: 'none' }}
              >
                Voir ↗
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
