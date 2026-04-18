'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const C = {
  bg: '#07090F', card: '#0F172A', border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8',
  green: '#10B981', red: '#EF4444', blue: '#60A5FA',
}

type Scene = {
  id: string; name: string; prompt?: string; image_url?: string; animated_mp4_url?: string
  source_type: string; motion_prompt?: string; provider_image?: string; provider_video?: string
  aspect_ratio?: string; duration_s?: number; category?: string
  seasonal_variant?: string; parent_id?: string; created_at: string
}

const CATEGORIES = ['restaurant', 'hotel', 'plantation', 'marché', 'boutique', 'bureau', 'atelier', 'autre']

export default function ScenesPage() {
  const [scenes, setScenes] = useState<Scene[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'from-prompt' | 'from-image'>('from-prompt')
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [motionPrompt, setMotionPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1' | '4:5'>('9:16')
  const [duration, setDuration] = useState(8)
  const [category, setCategory] = useState('restaurant')
  const [generating, setGenerating] = useState(false)
  const [imageVariants, setImageVariants] = useState<Array<{ provider: string; url: string }>>([])
  const [selectedImage, setSelectedImage] = useState<{ provider: string; url: string } | null>(null)
  const [animating, setAnimating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const r = await fetch('/api/admin/ad-factory/scenes', { cache: 'no-store' })
      const d = await r.json()
      if (d.ok) setScenes(d.scenes)
    } catch {}
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  async function genImageVariants() {
    if (mode !== 'from-prompt') return
    if (prompt.trim().length < 10) { setError('prompt ≥ 10 chars'); return }
    setGenerating(true); setError(null); setImageVariants([]); setSelectedImage(null)
    try {
      const r = await fetch('/api/admin/ad-factory/scenes/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, prompt, generateImageVariants: true, aspectRatio }),
      })
      const d = await r.json()
      if (d.ok) setImageVariants(d.imageVariants ?? [])
      else setError(d.error || 'gen failed')
    } catch (e) { setError((e as Error).message) }
    setGenerating(false)
  }

  async function animate() {
    if (!motionPrompt.trim()) { setError('motion prompt requis'); return }
    const src = mode === 'from-prompt' ? selectedImage?.url : sourceUrl
    if (!src) { setError('image source manquante'); return }
    setAnimating(true); setError(null)
    try {
      const r = await fetch('/api/admin/ad-factory/scenes/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || `scene-${Date.now()}`,
          sourceImageUrl: src,
          motionPrompt,
          aspectRatio,
          durationSeconds: duration,
          category,
        }),
      })
      const d = await r.json()
      if (!d.ok) { setError(d.error); setAnimating(false); return }

      // Save to library
      await fetch('/api/admin/ad-factory/scenes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || `scene-${Date.now()}`,
          prompt, image_url: d.imageUrl, animated_mp4_url: d.animatedMp4Url,
          source_type: mode === 'from-prompt' ? 'generated' : 'user_uploaded',
          motion_prompt: motionPrompt, aspect_ratio: aspectRatio,
          duration_s: d.duration_s, category,
        }),
      })

      // Reset
      setName(''); setPrompt(''); setMotionPrompt(''); setSourceUrl('')
      setImageVariants([]); setSelectedImage(null)
      void load()
    } catch (e) { setError((e as Error).message) }
    setAnimating(false)
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Supprimer "${name}" ?`)) return
    await fetch(`/api/admin/ad-factory/scenes?id=${id}`, { method: 'DELETE' })
    void load()
  }

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: C.accent, letterSpacing: '.2em', textTransform: 'uppercase' }}>Ad Factory</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: '4px 0 0' }}>Scene Factory</h1>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
            <Link href="/admin/ad-factory" style={{ color: C.accent, textDecoration: 'none' }}>← Retour hub</Link>
            <Link href="/admin/ad-factory/avatars" style={{ color: C.accent, textDecoration: 'none' }}>Avatars →</Link>
          </div>
        </div>

        {/* Mode switcher */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {([
            ['from-prompt', '✨ Depuis texte (nano-banana + Seedance)'],
            ['from-image', '🖼️ Depuis image existante (OFA hero upgrader)'],
          ] as const).map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, background: mode === m ? C.accent : 'transparent',
              color: mode === m ? C.bg : C.text,
              border: `1px solid ${mode === m ? C.accent : C.border}`,
              padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
          {/* Common fields */}
          <input placeholder="Nom (ex: resto-africain-soir-bistro)" value={name} onChange={e => setName(e.target.value)} style={fieldStyle} />

          {mode === 'from-prompt' ? (
            <>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Décris la scène. Ex: Salle de restaurant africain traditionnel en soirée, tables en bois, bougies allumées, murs couleur terre, faible éclairage chaleureux, ambiance intime."
                rows={3}
                style={{ ...fieldStyle, marginTop: 10, resize: 'vertical' }}
              />
              <button onClick={genImageVariants} disabled={generating} style={primaryBtn(generating)}>
                {generating ? 'Génération 4 previews…' : '1. Générer 4 previews image (pour choisir)'}
              </button>

              {imageVariants.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Choisis l'image préférée :</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                    {imageVariants.map((v, i) => {
                      const sel = selectedImage?.url === v.url
                      return (
                        <button key={i} onClick={() => setSelectedImage(v)} style={{
                          background: 'transparent', border: `3px solid ${sel ? C.accent : C.border}`,
                          borderRadius: 8, padding: 4, cursor: 'pointer',
                        }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={v.url} alt={`v${i}`} style={{ width: '100%', height: 'auto', borderRadius: 4, aspectRatio: '9/16', objectFit: 'cover' }} />
                          <div style={{ fontSize: 10, color: sel ? C.accent : C.muted, marginTop: 3, fontFamily: 'Menlo' }}>
                            {v.provider}{sel ? ' ✓' : ''}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <input placeholder="URL image source (site client, Drive, upload)" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} style={{ ...fieldStyle, marginTop: 10 }} />
          )}

          {/* Motion + options */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
            <textarea
              value={motionPrompt}
              onChange={e => setMotionPrompt(e.target.value)}
              placeholder="Quelle animation? Ex: Subtle breeze in the curtains, candle flames flickering softly, soft steam rising from dishes, warm atmosphere building."
              rows={2}
              style={{ ...fieldStyle, resize: 'vertical' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginTop: 8 }}>
              <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value as typeof aspectRatio)} style={fieldStyle}>
                <option value="9:16">9:16 (Stories/Reels)</option>
                <option value="16:9">16:9 (YouTube/Web)</option>
                <option value="1:1">1:1 (IG feed)</option>
                <option value="4:5">4:5 (IG portrait)</option>
              </select>
              <select value={duration} onChange={e => setDuration(Number(e.target.value))} style={fieldStyle}>
                <option value={5}>5s</option>
                <option value={8}>8s</option>
                <option value={10}>10s</option>
                <option value={15}>15s (max)</option>
              </select>
              <select value={category} onChange={e => setCategory(e.target.value)} style={fieldStyle}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <button
              onClick={animate}
              disabled={animating || (mode === 'from-prompt' && !selectedImage) || (mode === 'from-image' && !sourceUrl)}
              style={primaryBtn(animating)}
            >
              {animating ? 'Animation Seedance I2V en cours…' : '2. Animer + sauvegarder dans la library'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,.1)', border: `1px solid ${C.red}`, color: C.red, padding: 12, marginBottom: 16, fontSize: 13, borderRadius: 8 }}>
            {error}
          </div>
        )}

        {/* Library */}
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: C.muted, letterSpacing: '.1em', textTransform: 'uppercase' }}>
          Bibliothèque ({scenes.length})
        </div>
        {loading ? (
          <div style={{ color: C.muted, padding: 20 }}>Chargement…</div>
        ) : scenes.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 32, textAlign: 'center', color: C.muted, borderRadius: 10 }}>
            Aucune scène. Crée ta première ci-dessus.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {scenes.map(s => (
              <div key={s.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 10 }}>
                {s.animated_mp4_url ? (
                  <video src={s.animated_mp4_url} controls muted loop style={{ width: '100%', height: 'auto', borderRadius: 6 }} />
                ) : s.image_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={s.image_url} alt={s.name} style={{ width: '100%', height: 'auto', borderRadius: 6, aspectRatio: '9/16', objectFit: 'cover' }} />
                ) : null}
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700 }}>{s.name}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                  {s.source_type} · {s.category ?? '-'} · {s.aspect_ratio ?? '-'} · {s.duration_s ? `${s.duration_s}s` : '-'}
                </div>
                {s.motion_prompt && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4, maxHeight: 40, overflow: 'hidden' }}>
                    {s.motion_prompt.slice(0, 80)}…
                  </div>
                )}
                <button onClick={() => remove(s.id, s.name)} style={{
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
  width: '100%', background: '#07090F', border: '1px solid rgba(201,168,76,.2)', color: '#E2E8F0',
  padding: '10px 12px', fontSize: 13, fontFamily: 'inherit',
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    marginTop: 12, background: 'linear-gradient(135deg, #C9A84C, #E8C97A)', color: '#07090F',
    padding: '12px 24px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, width: '100%',
  }
}
