'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const C = { bg: '#07090F', card: '#0F172A', border: 'rgba(201,168,76,.2)', accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8', green: '#10B981', red: '#EF4444', blue: '#60A5FA' }

type Project = { id: string; name: string; description?: string; status: string; brief: { segments?: Segment[]; aspect_ratio?: string; total_duration_s?: number }; drive_folder_url?: string; image_refs?: unknown[] }
type Variant = { id: string; lang: string; hero_name?: string; product?: string; country_iso?: string; avatar_ids?: string[]; created_at: string }
type Job = { id: string; variant_id: string; status: string; progress_pct: number; final_mp4_url?: string; duration_s?: number; cost_eur?: number; error?: string; segments?: SegmentResult[] }
type SegmentResult = { index: number; provider: string; status: string; url?: string; duration_s?: number; error?: string }
type Segment = {
  index: number; kind: string; duration_s: number; prompt: string
  reference_urls?: string[]; dialogue?: Array<{ speaker: string; line: string; timing?: string }>
}

const LANGS = ['fr', 'en', 'de', 'es', 'ar', 'pt']

export default function StudioPage() {
  const params = useParams()
  const projectId = params?.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [variants, setVariants] = useState<Variant[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [activeSeg, setActiveSeg] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forkMatrix, setForkMatrix] = useState({ langs: ['fr'], products: ['oignon'], countries: ['CIV'], seasons: ['default'] })

  async function load() {
    try {
      const r = await fetch(`/api/admin/ad-factory/projects/${projectId}`, { cache: 'no-store' })
      const d = await r.json()
      if (d.ok) { setProject(d.project); setVariants(d.variants ?? []); setJobs(d.jobs ?? []) }
    } catch {}
    setLoading(false)
  }
  useEffect(() => { void load() }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveSegment(updated: Segment) {
    if (!project) return
    setSaving(true); setError(null)
    const segs = (project.brief.segments ?? []).map(s => s.index === updated.index ? updated : s)
    const patch = { brief: { ...project.brief, segments: segs } }
    const r = await fetch(`/api/admin/ad-factory/projects/${projectId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const d = await r.json()
    if (d.ok) setProject({ ...project, brief: patch.brief })
    else setError(d.error)
    setSaving(false)
  }

  async function fork() {
    const r = await fetch('/api/admin/ad-factory/variants/fork', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, matrix: forkMatrix }),
    })
    const d = await r.json()
    if (d.ok) { void load() }
    else setError(d.error)
  }

  async function queueRender(variantId: string) {
    const r = await fetch('/api/admin/ad-factory/jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant_ids: [variantId] }),
    })
    const d = await r.json()
    if (!d.ok) setError(d.error)
    else { setTimeout(load, 1500); setTimeout(load, 8000) }
  }

  if (loading) return <div style={{ background: C.bg, color: C.muted, minHeight: '100vh', padding: 40 }}>Chargement…</div>
  if (!project) return <div style={{ background: C.bg, color: C.red, minHeight: '100vh', padding: 40 }}>Projet introuvable</div>

  const segs = project.brief.segments ?? []
  const currentSeg = segs.find(s => s.index === activeSeg) ?? segs[0]

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '30px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: C.accent, letterSpacing: '.2em', textTransform: 'uppercase' }}>Ad Factory · Studio</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0' }}>{project.name}</h1>
            <div style={{ fontSize: 12, color: C.muted }}>
              {segs.length} segments · {project.brief.total_duration_s ?? '-'}s · {project.brief.aspect_ratio ?? '-'} · status: <strong style={{ color: C.accent }}>{project.status}</strong>
            </div>
          </div>
          <Link href="/admin/ad-factory/projects" style={{ color: C.accent, fontSize: 13, textDecoration: 'none' }}>← Projets</Link>
        </div>

        {/* 3 colonnes : timeline | preview | edit */}
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 340px', gap: 16, marginBottom: 24 }}>
          {/* TIMELINE */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 10 }}>Timeline</div>
            {segs.map(s => (
              <button key={s.index} onClick={() => setActiveSeg(s.index)} style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
                background: s.index === activeSeg ? 'rgba(201,168,76,.1)' : 'transparent',
                border: `1px solid ${s.index === activeSeg ? C.accent : 'transparent'}`,
                color: s.index === activeSeg ? C.accent : C.text,
                borderRadius: 6, cursor: 'pointer', marginBottom: 4, fontSize: 12,
              }}>
                <div style={{ fontWeight: 700 }}>SEG {s.index}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{s.kind} · {s.duration_s}s</div>
              </button>
            ))}
          </div>

          {/* PREVIEW */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 10 }}>Preview SEG {activeSeg}</div>
            <div style={{ background: '#000', aspectRatio: project.brief.aspect_ratio === '16:9' ? '16/9' : project.brief.aspect_ratio === '1:1' ? '1/1' : '9/16', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 12, borderRadius: 6 }}>
              (Preview sera générée après render)
            </div>
            {currentSeg && (
              <div style={{ marginTop: 10, padding: 10, background: C.bg, borderRadius: 6, fontSize: 11, color: C.muted, whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto' }}>
                {currentSeg.prompt.slice(0, 500)}{currentSeg.prompt.length > 500 ? '…' : ''}
                {currentSeg.dialogue && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                    {currentSeg.dialogue.map((d, i) => (
                      <div key={i}><strong style={{ color: C.accent }}>{d.speaker}</strong> [{d.timing}]: {d.line}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* EDIT */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 10 }}>Édition SEG {activeSeg}</div>
            {currentSeg && (
              <>
                <label style={lbl}>Type</label>
                <select value={currentSeg.kind} onChange={e => saveSegment({ ...currentSeg, kind: e.target.value })} style={fs}>
                  <option value="seedance-t2v">Seedance T2V</option>
                  <option value="seedance-i2v">Seedance I2V (avatar)</option>
                  <option value="heygen-dialogue">HeyGen dialogue</option>
                  <option value="ffmpeg-text">FFmpeg text morph</option>
                </select>
                <label style={lbl}>Durée (s)</label>
                <input type="number" min={1} max={15} value={currentSeg.duration_s} onChange={e => saveSegment({ ...currentSeg, duration_s: Number(e.target.value) })} style={fs} />
                <label style={lbl}>Prompt</label>
                <textarea value={currentSeg.prompt} onChange={e => saveSegment({ ...currentSeg, prompt: e.target.value })} rows={6} style={{ ...fs, resize: 'vertical' }} />
                {saving && <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>Sauvegarde…</div>}
              </>
            )}
          </div>
        </div>

        {/* FORK / INDUSTRIALIZE */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🚀 Industrialize — Fork en variants</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={lbl}>Langues</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {LANGS.map(l => {
                  const on = forkMatrix.langs.includes(l)
                  return (
                    <button key={l} onClick={() => setForkMatrix({ ...forkMatrix, langs: on ? forkMatrix.langs.filter(x => x !== l) : [...forkMatrix.langs, l] })} style={chip(on)}>
                      {l.toUpperCase()}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label style={lbl}>Produits (coma-séparés)</label>
              <input value={forkMatrix.products.join(',')} onChange={e => setForkMatrix({ ...forkMatrix, products: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} style={fs} />
            </div>
            <div>
              <label style={lbl}>Pays ISO3</label>
              <input value={forkMatrix.countries.join(',')} onChange={e => setForkMatrix({ ...forkMatrix, countries: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} style={fs} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
            → {forkMatrix.langs.length} × {forkMatrix.products.length} × {forkMatrix.countries.length} = <strong style={{ color: C.accent }}>{forkMatrix.langs.length * forkMatrix.products.length * forkMatrix.countries.length} variants</strong>
          </div>
          <button onClick={fork} style={btn(false)}>Fork & créer variants</button>
        </div>

        {/* VARIANTS + JOBS */}
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Variants ({variants.length})</div>
        {variants.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 24, textAlign: 'center', color: C.muted, borderRadius: 10 }}>
            Aucun variant. Utilise "Industrialize" ci-dessus pour en créer.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {variants.map(v => {
              const j = jobs.find(job => job.variant_id === v.id)
              return (
                <div key={v.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(96,165,250,.15)', color: C.blue, borderRadius: 999, letterSpacing: '.08em' }}>{v.lang.toUpperCase()}</span>
                    {v.product && <span style={{ fontSize: 11, color: C.text }}>{v.product}</span>}
                    {v.country_iso && <span style={{ fontSize: 11, color: C.muted }}>· {v.country_iso}</span>}
                    {j && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: j.status === 'completed' ? 'rgba(16,185,129,.15)' : j.status === 'failed' ? 'rgba(239,68,68,.15)' : 'rgba(201,168,76,.15)', color: j.status === 'completed' ? C.green : j.status === 'failed' ? C.red : C.accent }}>
                        {j.status} {j.progress_pct}%
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {j?.final_mp4_url && (
                      <a href={j.final_mp4_url} target="_blank" rel="noopener" style={{ fontSize: 10, color: C.accent, textDecoration: 'none', padding: '4px 8px', border: `1px solid ${C.accent}`, borderRadius: 4 }}>
                        📥 mp4
                      </a>
                    )}
                    <button onClick={() => queueRender(v.id)} style={{ fontSize: 10, background: C.accent, color: C.bg, border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>
                      {j ? '⟳ Re-render' : '▶ Render'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 16, background: 'rgba(239,68,68,.1)', border: `1px solid ${C.red}`, color: C.red, padding: 12, fontSize: 13, borderRadius: 8 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

const fs: React.CSSProperties = { width: '100%', background: '#07090F', border: '1px solid rgba(201,168,76,.2)', color: '#E2E8F0', padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', marginBottom: 8 }
const lbl: React.CSSProperties = { display: 'block', fontSize: 10, color: '#94A3B8', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 4, marginTop: 8 }
function btn(disabled: boolean): React.CSSProperties {
  return { background: 'linear-gradient(135deg,#C9A84C,#E8C97A)', color: '#07090F', padding: '10px 20px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .6 : 1 }
}
function chip(on: boolean): React.CSSProperties {
  return { background: on ? 'rgba(201,168,76,.15)' : 'transparent', border: `1px solid ${on ? '#C9A84C' : 'rgba(201,168,76,.2)'}`, color: on ? '#C9A84C' : '#94A3B8', padding: '4px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer', borderRadius: 999 }
}
