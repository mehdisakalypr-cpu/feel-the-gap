'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const C = { bg: '#07090F', card: '#0F172A', border: 'rgba(201,168,76,.2)', accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8', green: '#10B981', red: '#EF4444' }

type Project = { id: string; name: string; description?: string; status: string; drive_folder_url?: string; created_at: string; updated_at: string }
type Stats = Record<string, { variants: number; jobs: number }>

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [stats, setStats] = useState<Stats>({})
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [driveUrl, setDriveUrl] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const r = await fetch('/api/admin/ad-factory/projects', { cache: 'no-store' })
      const d = await r.json()
      if (d.ok) { setProjects(d.projects); setStats(d.stats ?? {}) }
    } catch {}
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  async function create() {
    if (!name.trim()) { setError('nom requis'); return }
    setCreating(true); setError(null)
    const r = await fetch('/api/admin/ad-factory/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description, drive_folder_url: driveUrl || null }),
    })
    const d = await r.json()
    setCreating(false)
    if (d.ok) { setName(''); setDescription(''); setDriveUrl(''); void load() }
    else setError(d.error || 'création impossible')
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Supprimer projet "${name}" + tous ses variants/jobs ?`)) return
    await fetch(`/api/admin/ad-factory/projects?id=${id}`, { method: 'DELETE' })
    void load()
  }

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: C.accent, letterSpacing: '.2em', textTransform: 'uppercase' }}>Ad Factory</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: '4px 0 0' }}>Projets (scénarios)</h1>
          </div>
          <Link href="/admin/ad-factory" style={{ color: C.accent, fontSize: 13, textDecoration: 'none' }}>← Retour hub</Link>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Nouveau projet</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <input placeholder="Nom du projet (ex: L'Oignon CIV)" value={name} onChange={e => setName(e.target.value)} style={fs} />
            <textarea placeholder="Description courte (optionnel)" value={description} onChange={e => setDescription(e.target.value)} rows={2} style={{ ...fs, resize: 'vertical' }} />
            <input placeholder="Drive folder URL (références images/logos)" value={driveUrl} onChange={e => setDriveUrl(e.target.value)} style={fs} />
            <button onClick={create} disabled={creating} style={btn(creating)}>
              {creating ? 'Création…' : '+ Créer projet (brief L\'Oignon pré-rempli)'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
            Chaque nouveau projet part du scénario "L'Oignon" pré-rempli (4 segments). Tu l'édites ensuite dans le Studio.
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,.1)', border: `1px solid ${C.red}`, color: C.red, padding: 12, marginBottom: 16, fontSize: 13, borderRadius: 8 }}>
            {error}
          </div>
        )}

        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: C.muted, letterSpacing: '.1em', textTransform: 'uppercase' }}>
          Projets ({projects.length})
        </div>
        {loading ? (
          <div style={{ color: C.muted, padding: 20 }}>Chargement…</div>
        ) : projects.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 32, textAlign: 'center', color: C.muted, borderRadius: 10 }}>
            Aucun projet. Crée ton premier ci-dessus.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {projects.map(p => {
              const s = stats[p.id] ?? { variants: 0, jobs: 0 }
              return (
                <div key={p.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                        <Link href={`/admin/ad-factory/studio/${p.id}`} style={{ color: C.text, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
                          {p.name}
                        </Link>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(201,168,76,.1)', color: C.accent, letterSpacing: '.08em' }}>
                          {p.status}
                        </span>
                      </div>
                      {p.description && <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{p.description}</div>}
                      <div style={{ fontSize: 11, color: C.muted }}>
                        {s.variants} variants · créé {new Date(p.created_at).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link href={`/admin/ad-factory/studio/${p.id}`} style={{
                        background: C.accent, color: C.bg, padding: '6px 12px', fontSize: 11, fontWeight: 700,
                        borderRadius: 4, textDecoration: 'none',
                      }}>Studio →</Link>
                      <button onClick={() => remove(p.id, p.name)} style={{
                        background: 'transparent', border: `1px solid ${C.red}`, color: C.red,
                        padding: '6px 12px', fontSize: 11, cursor: 'pointer', borderRadius: 4,
                      }}>×</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const fs: React.CSSProperties = { width: '100%', background: '#07090F', border: '1px solid rgba(201,168,76,.2)', color: '#E2E8F0', padding: '10px 12px', fontSize: 13, fontFamily: 'inherit' }
function btn(disabled: boolean): React.CSSProperties {
  return { background: 'linear-gradient(135deg,#C9A84C,#E8C97A)', color: '#07090F', padding: '10px 18px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .6 : 1 }
}
