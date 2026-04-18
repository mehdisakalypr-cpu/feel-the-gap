'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const C = {
  bg: '#07090F', card: '#0F172A', border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8',
  green: '#10B981', red: '#EF4444',
}

type Avatar = {
  id: string; name: string; prompt: string; image_url: string
  provider?: string; gender?: string; ethnicity?: string; age_range?: string; style?: string
  created_at: string
}

type Preview = { provider: string; url: string }

export default function AvatarFactoryPage() {
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [loading, setLoading] = useState(true)
  const [prompt, setPrompt] = useState('')
  const [name, setName] = useState('')
  const [style, setStyle] = useState<'photorealistic' | 'cinematic' | 'editorial' | 'studio' | 'natural-light'>('photorealistic')
  const [gender, setGender] = useState('')
  const [ethnicity, setEthnicity] = useState('')
  const [ageRange, setAgeRange] = useState('')
  const [generating, setGenerating] = useState(false)
  const [previews, setPreviews] = useState<Preview[]>([])
  const [selectedPreview, setSelectedPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const r = await fetch('/api/admin/ad-factory/avatars', { cache: 'no-store' })
      const d = await r.json()
      if (d.ok) setAvatars(d.avatars)
    } catch { /* silent */ }
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  async function generate() {
    if (prompt.trim().length < 10) { setError('prompt trop court (≥ 10 caractères)'); return }
    setGenerating(true); setError(null); setPreviews([]); setSelectedPreview(null)
    try {
      const r = await fetch('/api/admin/ad-factory/avatars/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style, variants: 4 }),
      })
      const d = await r.json()
      if (d.ok) setPreviews(d.variants)
      else setError(d.error || 'génération impossible')
    } catch (e) {
      setError((e as Error).message)
    }
    setGenerating(false)
  }

  async function save() {
    if (!selectedPreview) { setError('choisis une preview'); return }
    if (!name.trim()) { setError('nom requis'); return }
    const r = await fetch('/api/admin/ad-factory/avatars', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(), prompt, image_url: selectedPreview.url,
        provider: selectedPreview.provider, style, gender, ethnicity, age_range: ageRange,
      }),
    })
    const d = await r.json()
    if (d.ok) {
      setPrompt(''); setName(''); setPreviews([]); setSelectedPreview(null)
      void load()
    } else {
      setError(d.error || 'save failed')
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Supprimer "${name}" ?`)) return
    await fetch(`/api/admin/ad-factory/avatars?id=${id}`, { method: 'DELETE' })
    void load()
  }

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: C.accent, letterSpacing: '.2em', textTransform: 'uppercase' }}>Ad Factory</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: '4px 0 0' }}>Avatar Factory</h1>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
            <Link href="/admin/ad-factory" style={{ color: C.accent, textDecoration: 'none' }}>← Projets</Link>
          </div>
        </div>

        {/* Generator */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>1. Décris ton avatar</div>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Ex: Femme africaine 32 ans, peau brun foncé, fichu wax orange/rouge, regard confiant mais pensif, tenue simple en coton beige, plantation en arrière-plan."
            rows={3}
            style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: 12, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 12 }}>
            <select value={style} onChange={e => setStyle(e.target.value as typeof style)} style={fieldStyle}>
              <option value="photorealistic">Photoréaliste</option>
              <option value="cinematic">Cinématique</option>
              <option value="editorial">Éditorial</option>
              <option value="studio">Studio</option>
              <option value="natural-light">Lumière naturelle</option>
            </select>
            <input placeholder="Gender (M/F/NB)" value={gender} onChange={e => setGender(e.target.value)} style={fieldStyle} />
            <input placeholder="Ethnicity" value={ethnicity} onChange={e => setEthnicity(e.target.value)} style={fieldStyle} />
            <input placeholder="Age range (ex: 30-35)" value={ageRange} onChange={e => setAgeRange(e.target.value)} style={fieldStyle} />
          </div>
          <button onClick={generate} disabled={generating} style={primaryBtn(generating)}>
            {generating ? 'Génération en cours (3 providers cascade)…' : '✨ Générer 4 previews (nano-banana + Flux CF + Pollinations)'}
          </button>
        </div>

        {/* Previews */}
        {previews.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>2. Choisis ta preview</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {previews.map((p, i) => {
                const picked = selectedPreview?.url === p.url
                return (
                  <button key={i} onClick={() => setSelectedPreview(p)} style={{
                    background: 'transparent', border: `3px solid ${picked ? C.accent : C.border}`, borderRadius: 10,
                    padding: 4, cursor: 'pointer', transition: 'all .2s',
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`preview ${i}`} style={{ width: '100%', height: 'auto', borderRadius: 6, aspectRatio: '3/4', objectFit: 'cover' }} />
                    <div style={{ fontSize: 10, color: picked ? C.accent : C.muted, marginTop: 4, fontFamily: 'Menlo, monospace' }}>
                      {p.provider}{picked ? ' ✓' : ''}
                    </div>
                  </button>
                )
              })}
            </div>

            {selectedPreview && (
              <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input placeholder="Nom (ex: Aïssata CIV 32)" value={name} onChange={e => setName(e.target.value)} style={{ ...fieldStyle, flex: 1, minWidth: 200 }} />
                <button onClick={save} style={primaryBtn(false)}>💾 Sauvegarder l'avatar</button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239,68,68,.1)', border: `1px solid ${C.red}`, color: C.red, padding: 12, marginBottom: 16, fontSize: 13, borderRadius: 8 }}>
            {error}
          </div>
        )}

        {/* Library */}
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: C.muted, letterSpacing: '.1em', textTransform: 'uppercase' }}>
          Bibliothèque ({avatars.length})
        </div>
        {loading ? (
          <div style={{ color: C.muted, padding: 20 }}>Chargement…</div>
        ) : avatars.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 32, textAlign: 'center', color: C.muted, borderRadius: 10 }}>
            Aucun avatar. Crée ton premier ci-dessus.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {avatars.map(a => (
              <div key={a.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.image_url} alt={a.name} style={{ width: '100%', height: 'auto', borderRadius: 6, aspectRatio: '3/4', objectFit: 'cover' }} />
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: C.text }}>{a.name}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                  {a.provider ?? '?'} · {a.style ?? '-'} · {a.ethnicity ?? '-'}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4, maxHeight: 40, overflow: 'hidden' }}>
                  {a.prompt.slice(0, 80)}…
                </div>
                <button onClick={() => remove(a.id, a.name)} style={{
                  marginTop: 8, background: 'transparent', border: `1px solid ${C.red}`, color: C.red,
                  padding: '4px 10px', fontSize: 10, cursor: 'pointer', borderRadius: 4, width: '100%',
                }}>Supprimer</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const fieldStyle: React.CSSProperties = {
  background: '#07090F', border: '1px solid rgba(201,168,76,.2)', color: '#E2E8F0',
  padding: '8px 10px', fontSize: 13, fontFamily: 'inherit',
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    marginTop: 12, background: 'linear-gradient(135deg, #C9A84C, #E8C97A)', color: '#07090F',
    padding: '12px 24px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, width: '100%',
  }
}
