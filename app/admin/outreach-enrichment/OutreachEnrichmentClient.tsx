'use client'
import { useState } from 'react'

const C = {
  card: '#0F172A', border: 'rgba(201,168,76,.2)', accent: '#C9A84C',
  text: '#E2E8F0', muted: '#94A3B8', green: '#10B981', red: '#EF4444', blue: '#3B82F6',
}

type Demo = {
  id: string
  full_name: string | null
  company_name: string | null
  city: string | null
  country_iso: string | null
  sector: string | null
  archetype: string | null
  roi_monthly_eur: number | null
  hero_message: string | null
  token: string | null
  linkedin_url: string | null
  email: string | null
  created_at: string
}

type LineState = {
  email: string
  phone: string
  whatsapp: string
  saving: boolean
  saved: boolean
  error: string | null
}

function searchLinks(fullName: string | null, company: string | null, city: string | null, country: string | null) {
  const q = [fullName, company].filter(Boolean).join(' ')
  const linkedin = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`
  const google = `https://www.google.com/search?q=${encodeURIComponent([q, city, country, 'email'].filter(Boolean).join(' '))}`
  const hunter = company ? `https://hunter.io/search/${encodeURIComponent(company)}` : null
  return { linkedin, google, hunter }
}

export default function OutreachEnrichmentClient({ initialDemos }: { initialDemos: Demo[] }) {
  const [demos] = useState(initialDemos)
  const [lines, setLines] = useState<Record<string, LineState>>(() => {
    const s: Record<string, LineState> = {}
    for (const d of initialDemos) {
      s[d.id] = { email: '', phone: '', whatsapp: '', saving: false, saved: false, error: null }
    }
    return s
  })

  function upd(id: string, patch: Partial<LineState>) {
    setLines((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function save(d: Demo) {
    const line = lines[d.id]
    if (!line.email && !line.phone && !line.whatsapp) {
      upd(d.id, { error: 'Renseigne au moins un contact' })
      return
    }
    upd(d.id, { saving: true, error: null })
    try {
      const res = await fetch('/api/admin/outreach-enrichment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          demo_id: d.id,
          email: line.email || null,
          phone: line.phone || null,
          whatsapp: line.whatsapp || null,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || `http_${res.status}`)
      upd(d.id, { saved: true })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      upd(d.id, { error: msg })
    } finally {
      upd(d.id, { saving: false })
    }
  }

  if (demos.length === 0) {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: '2rem', borderRadius: 10, textAlign: 'center', color: C.muted }}>
        Aucun demo bloqué sans email. 🎉
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {demos.map((d) => {
        const line = lines[d.id]
        const links = searchLinks(d.full_name, d.company_name, d.city, d.country_iso)
        return (
          <div
            key={d.id}
            style={{
              background: line.saved ? 'rgba(16,185,129,0.06)' : C.card,
              border: `1px solid ${line.saved ? 'rgba(16,185,129,0.4)' : C.border}`,
              padding: '1rem 1.25rem',
              borderRadius: 10,
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
              gap: 12,
              alignItems: 'start',
            }}
          >
            {/* Left: identity */}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {d.full_name ?? '(sans nom)'}
                {d.company_name && (
                  <span style={{ color: C.muted, fontWeight: 400 }}> · {d.company_name}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
                {[d.city, d.country_iso, d.sector, d.archetype].filter(Boolean).join(' · ')}
                {d.roi_monthly_eur ? (
                  <> · <span style={{ color: C.accent }}>ROI {d.roi_monthly_eur.toLocaleString('fr-FR')}€/mois</span></>
                ) : null}
              </div>
              {d.hero_message && (
                <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginBottom: 8, lineHeight: 1.4, maxHeight: 36, overflow: 'hidden' }}>
                  &ldquo;{d.hero_message.slice(0, 140)}{d.hero_message.length > 140 ? '…' : ''}&rdquo;
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11 }}>
                <a href={links.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'underline' }}>LinkedIn ↗</a>
                <a href={links.google} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'underline' }}>Google ↗</a>
                {links.hunter && (
                  <a href={links.hunter} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'underline' }}>Hunter.io ↗</a>
                )}
                {d.token && (
                  <a href={`/demo/${d.token}`} target="_blank" rel="noopener noreferrer" style={{ color: C.accent, textDecoration: 'underline' }}>Voir demo ↗</a>
                )}
              </div>
            </div>

            {/* Right: inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                type="email"
                placeholder="email"
                value={line.email}
                disabled={line.saving || line.saved}
                onChange={(e) => upd(d.id, { email: e.target.value, error: null })}
                style={inputStyle}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="tel"
                  placeholder="phone (+cc…)"
                  value={line.phone}
                  disabled={line.saving || line.saved}
                  onChange={(e) => upd(d.id, { phone: e.target.value, error: null })}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  type="tel"
                  placeholder="whatsapp (+cc…)"
                  value={line.whatsapp}
                  disabled={line.saving || line.saved}
                  onChange={(e) => upd(d.id, { whatsapp: e.target.value, error: null })}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
              {line.error && (
                <div style={{ fontSize: 11, color: C.red }}>{line.error}</div>
              )}
              <button
                type="button"
                onClick={() => save(d)}
                disabled={line.saving || line.saved}
                style={{
                  padding: '0.45rem 0.75rem',
                  background: line.saved ? C.green : C.accent,
                  color: '#07090F',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: line.saving || line.saved ? 'default' : 'pointer',
                  opacity: line.saving ? 0.7 : 1,
                }}
              >
                {line.saved ? '✓ Enregistré' : line.saving ? '…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '0.45rem 0.6rem',
  background: '#07090F',
  border: '1px solid rgba(201,168,76,.2)',
  borderRadius: 6,
  color: '#E2E8F0',
  fontSize: 13,
  outline: 'none',
}
