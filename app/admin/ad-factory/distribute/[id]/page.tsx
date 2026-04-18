'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const C = { bg: '#07090F', card: '#0F172A', border: 'rgba(201,168,76,.2)', accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8', green: '#10B981', red: '#EF4444', blue: '#60A5FA' }

type Output = { id: string; aspect_ratio: string; resolution?: string; url: string; file_size_bytes?: number; format_kind?: string }
type Publication = { id: string; platform: string; status: string; caption?: string; scheduled_for?: string; published_at?: string; platform_post_id?: string; error?: string }

const PLATFORMS = [
  { id: 'meta-ig',  label: 'Instagram Business', icon: '📸' },
  { id: 'meta-fb',  label: 'Facebook Page',      icon: '📘' },
  { id: 'tiktok',   label: 'TikTok Business',    icon: '🎵' },
  { id: 'youtube',  label: 'YouTube Shorts',     icon: '▶️' },
  { id: 'linkedin', label: 'LinkedIn Company',   icon: '💼' },
  { id: 'twitter',  label: 'X / Twitter',        icon: '𝕏' },
  { id: 'ofa-site', label: 'OFA site client',    icon: '🌐' },
]

const ASPECTS = [
  { id: '16:9', label: '16:9 (YT/Web/LinkedIn)', res: '1920×1080' },
  { id: '9:16', label: '9:16 (TikTok/Reels)',    res: '1080×1920' },
  { id: '1:1',  label: '1:1 (IG feed)',          res: '1080×1080' },
  { id: '4:5',  label: '4:5 (IG portrait)',      res: '1080×1350' },
]

export default function DistributePage() {
  const params = useParams()
  const variantId = params?.id as string

  const [outputs, setOutputs] = useState<Output[]>([])
  const [pubs, setPubs] = useState<Publication[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [selectedAspects, setSelectedAspects] = useState<string[]>(['16:9', '9:16', '1:1', '4:5'])
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('feelthegap entrepreneur cötedivoire')
  const [scheduledFor, setScheduledFor] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const r = await fetch(`/api/admin/ad-factory/distribute?variant_id=${variantId}`, { cache: 'no-store' })
      const d = await r.json()
      if (d.ok) { setOutputs(d.outputs ?? []); setPubs(d.publications ?? []) }
    } catch {}
    setLoading(false)
  }
  useEffect(() => { void load() }, [variantId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function generateFormats() {
    setBusy(true); setError(null)
    const r = await fetch('/api/admin/ad-factory/distribute', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant_id: variantId, generateFormats: true, aspects: selectedAspects }),
    })
    const d = await r.json()
    setBusy(false)
    if (!d.ok) setError(d.error)
    void load()
  }

  async function publish() {
    if (selectedPlatforms.length === 0) { setError('sélectionne au moins une plateforme'); return }
    setBusy(true); setError(null)
    const r = await fetch('/api/admin/ad-factory/distribute', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variant_id: variantId,
        publish: {
          platforms: selectedPlatforms,
          caption,
          hashtags: hashtags.split(/\s+/).filter(Boolean),
          scheduledFor: scheduledFor || undefined,
        },
      }),
    })
    const d = await r.json()
    setBusy(false)
    if (!d.ok) setError(d.error)
    void load()
  }

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '30px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: C.accent, letterSpacing: '.2em', textTransform: 'uppercase' }}>Ad Factory · Distribute</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0' }}>Variant <code style={{ fontSize: 12 }}>{variantId.slice(0, 8)}…</code></h1>
          </div>
          <Link href="/admin/ad-factory" style={{ color: C.accent, fontSize: 13, textDecoration: 'none' }}>← Retour hub</Link>
        </div>

        {/* Format Factory */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>1. 📦 Format Factory (FFmpeg)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6, marginBottom: 12 }}>
            {ASPECTS.map(a => {
              const on = selectedAspects.includes(a.id)
              return (
                <button key={a.id} onClick={() => setSelectedAspects(on ? selectedAspects.filter(x => x !== a.id) : [...selectedAspects, a.id])}
                  style={chip(on)}>
                  <span style={{ fontWeight: 700 }}>{a.label}</span>
                  <div style={{ fontSize: 9, marginTop: 2, color: on ? C.bg : C.muted }}>{a.res}</div>
                </button>
              )
            })}
          </div>
          <button onClick={generateFormats} disabled={busy || selectedAspects.length === 0} style={btn(busy)}>
            {busy ? 'Génération FFmpeg…' : `Générer ${selectedAspects.length} format${selectedAspects.length > 1 ? 's' : ''}`}
          </button>

          {outputs.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Formats existants :</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {outputs.map(o => (
                  <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.bg, padding: '6px 10px', fontSize: 11, borderRadius: 4 }}>
                    <span><strong style={{ color: C.text }}>{o.aspect_ratio}</strong> <span style={{ color: C.muted }}>{o.resolution}</span></span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <a href={o.url} target="_blank" rel="noopener" style={{ color: C.accent, fontSize: 10, textDecoration: 'none' }}>Open</a>
                      <a href={o.url} download style={{ color: C.green, fontSize: 10, textDecoration: 'none' }}>↓ DL</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Publish */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>2. 🚀 Publish sur plateformes</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 6, marginBottom: 12 }}>
            {PLATFORMS.map(p => {
              const on = selectedPlatforms.includes(p.id)
              return (
                <button key={p.id} onClick={() => setSelectedPlatforms(on ? selectedPlatforms.filter(x => x !== p.id) : [...selectedPlatforms, p.id])}
                  style={{ ...chip(on), textAlign: 'left', padding: '10px 12px' }}>
                  <span style={{ fontSize: 16, marginRight: 6 }}>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              )
            })}
          </div>

          <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Caption (sera déclinée par plateforme)" rows={3} style={{ ...fs, resize: 'vertical' }} />
          <input value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="Hashtags séparés par espaces" style={{ ...fs, marginTop: 8 }} />
          <input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} style={{ ...fs, marginTop: 8 }} />
          <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>Vide = publie maintenant</div>

          <button onClick={publish} disabled={busy || selectedPlatforms.length === 0} style={{ ...btn(busy), marginTop: 12 }}>
            {busy ? 'Publication…' : `Publish on ${selectedPlatforms.length} platform${selectedPlatforms.length > 1 ? 's' : ''}`}
          </button>
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,.1)', border: `1px solid ${C.red}`, color: C.red, padding: 12, marginBottom: 16, fontSize: 13, borderRadius: 8 }}>{error}</div>}

        {/* Publications log */}
        {pubs.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: C.muted, letterSpacing: '.1em', textTransform: 'uppercase' }}>Publications</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {pubs.map(p => (
                <div key={p.id} style={{ background: C.card, border: `1px solid ${C.border}`, padding: 10, borderRadius: 6, fontSize: 11, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <strong style={{ color: C.text }}>{p.platform}</strong>
                    <span style={{ marginLeft: 8, color: p.status.startsWith('stub') ? C.muted : (p.status === 'published' ? C.green : p.status === 'failed' ? C.red : C.blue) }}>
                      {p.status}
                    </span>
                    {p.platform_post_id && <code style={{ marginLeft: 8, color: C.muted, fontFamily: 'Menlo', fontSize: 10 }}>{p.platform_post_id}</code>}
                  </div>
                  <div style={{ color: C.muted }}>
                    {p.published_at ? new Date(p.published_at).toLocaleString('fr-FR') : p.scheduled_for ? `scheduled ${new Date(p.scheduled_for).toLocaleString('fr-FR')}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const fs: React.CSSProperties = { width: '100%', background: '#07090F', border: '1px solid rgba(201,168,76,.2)', color: '#E2E8F0', padding: '10px 12px', fontSize: 12, fontFamily: 'inherit' }
function btn(disabled: boolean): React.CSSProperties {
  return { background: 'linear-gradient(135deg,#C9A84C,#E8C97A)', color: '#07090F', padding: '10px 20px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .6 : 1 }
}
function chip(on: boolean): React.CSSProperties {
  return { background: on ? '#C9A84C' : 'transparent', border: `1px solid ${on ? '#C9A84C' : 'rgba(201,168,76,.2)'}`, color: on ? '#07090F' : '#E2E8F0', padding: '8px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', borderRadius: 6 }
}
