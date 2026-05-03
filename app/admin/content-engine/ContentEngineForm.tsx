'use client'

import { useState } from 'react'

const C = {
  bg: '#07090F', card: '#0F172A', border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8',
  red: '#EF4444', green: '#10B981',
}

const MODES = [
  { value: 'regenerate', label: 'Regénérer' },
  { value: 'modify-prompt', label: 'Modifier prompt' },
  { value: 'image-remix', label: 'Image remix' },
  { value: 'video-animate', label: 'Animer vidéo' },
  { value: 'theme-variants', label: 'Variantes thème' },
]

const SAAS_LIST = [
  { value: 'ftg', label: 'Feel The Gap' },
  // @admin-leak-allowed (form admin /admin/content-engine, founder-only)
  { value: 'ofa', label: 'One For All' },
  // @admin-leak-allowed
  { value: 'estate', label: 'The Estate' },
  { value: 'aici', label: 'AICI' },
  { value: 'aiplb', label: 'AIPLB' },
  { value: 'ancf', label: 'ANCF' },
]

const PERSONAS = [
  { value: 'entrepreneur', label: 'Entrepreneur' },
  { value: 'influenceur', label: 'Influenceur' },
  { value: 'investisseur', label: 'Investisseur' },
  { value: 'financeur', label: 'Financeur' },
]

interface Props {
  onJobTriggered: (runId: string, runUrl: string) => void
  adminEmail?: string
}

export default function ContentEngineForm({ onJobTriggered, adminEmail }: Props) {
  const [mode, setMode] = useState('regenerate')
  const [prompt, setPrompt] = useState('')
  const [assetUrl, setAssetUrl] = useState('')
  const [persona, setPersona] = useState('entrepreneur')
  const [targetSaas, setTargetSaas] = useState('ftg')
  const [variants, setVariants] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const needsAsset = mode === 'image-remix' || mode === 'video-animate'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/admin/content-engine/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          prompt,
          asset_url: assetUrl,
          persona,
          target_saas: targetSaas,
          variants,
          triggered_by: adminEmail,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Erreur inconnue')
        return
      }

      setSuccess(`Workflow déclenché — run #${json.runId}`)
      onJobTriggered(json.runId, json.runUrl)
      setPrompt('')
      setAssetUrl('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#0D1117',
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.text,
    padding: '0.5rem 0.75rem',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    color: C.muted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div>
        <label style={labelStyle}>Mode</label>
        <select value={mode} onChange={e => setMode(e.target.value)} style={inputStyle}>
          {MODES.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Prompt</label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Décrire le contenu à générer..."
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {needsAsset && (
        <div>
          <label style={labelStyle}>URL de l'asset source</label>
          <input
            type="url"
            value={assetUrl}
            onChange={e => setAssetUrl(e.target.value)}
            placeholder="https://..."
            style={inputStyle}
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Persona</label>
          <select value={persona} onChange={e => setPersona(e.target.value)} style={inputStyle}>
            {PERSONAS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>SaaS cible</label>
          <select value={targetSaas} onChange={e => setTargetSaas(e.target.value)} style={inputStyle}>
            {SAAS_LIST.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Nombre de variantes ({variants})</label>
        <input
          type="range"
          min={1}
          max={5}
          value={variants}
          onChange={e => setVariants(Number(e.target.value))}
          style={{ width: '100%', accentColor: C.accent }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.muted }}>
          <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
        </div>
      </div>

      {error && (
        <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: 12, color: C.red }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ background: `${C.green}15`, border: `1px solid ${C.green}40`, borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: 12, color: C.green }}>
          {success}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          background: loading ? C.muted : C.accent,
          color: '#07090F',
          fontWeight: 700,
          fontSize: 13,
          padding: '0.6rem 1rem',
          borderRadius: 8,
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {loading ? (
          <>
            <span style={{ width: 12, height: 12, border: '2px solid #07090F', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
            Déclenchement...
          </>
        ) : (
          'Declencher le workflow'
        )}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  )
}
