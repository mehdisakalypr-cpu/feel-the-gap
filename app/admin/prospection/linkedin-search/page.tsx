'use client'

/**
 * /admin/prospection/linkedin-search — Waalaxy-like search Phase 1 (safe)
 * Shaka 2026-04-21
 *
 * Apollo.io People Search → Email cascade (Hunter/Snov/Permutator) → Import warm network.
 * Zéro risque de ban LinkedIn (pas de cookies/scraping du site officiel).
 */

import { useState, useMemo } from 'react'

type ApolloPerson = {
  id: string
  first_name?: string
  last_name?: string
  name?: string
  title?: string
  linkedin_url?: string
  email?: string
  email_status?: string
  organization?: {
    name?: string
    website_url?: string
    primary_domain?: string
    estimated_num_employees?: number
    industry?: string
    country?: string
  }
  city?: string
  country?: string
}

type Enriched = ApolloPerson & { __found?: { email: string; confidence: number; source: string } | null }

const C = {
  bg: '#07090F', card: '#0D1117', gold: '#C9A84C', text: '#E8E0D0',
  muted: '#9BA8B8', dim: '#5A6A7A', green: '#10B981', red: '#EF4444',
  purple: '#A78BFA', blue: '#60A5FA', amber: '#F59E0B',
}

const SENIORITIES = [
  { key: 'founder', label: 'Founder' },
  { key: 'c_level', label: 'C-Level' },
  { key: 'vp', label: 'VP' },
  { key: 'director', label: 'Director' },
  { key: 'head', label: 'Head' },
  { key: 'manager', label: 'Manager' },
  { key: 'owner', label: 'Owner' },
]

const COUNTRIES = [
  { code: 'France', label: '🇫🇷 France' },
  { code: 'United States', label: '🇺🇸 USA' },
  { code: 'United Kingdom', label: '🇬🇧 UK' },
  { code: 'Morocco', label: '🇲🇦 Maroc' },
  { code: 'Senegal', label: '🇸🇳 Sénégal' },
  { code: 'Ivory Coast', label: '🇨🇮 Côte d\'Ivoire' },
  { code: 'Portugal', label: '🇵🇹 Portugal' },
  { code: 'Germany', label: '🇩🇪 Allemagne' },
  { code: 'Spain', label: '🇪🇸 Espagne' },
  { code: 'Italy', label: '🇮🇹 Italie' },
]

export default function LinkedinSearchPage() {
  const [titles, setTitles] = useState('Marketing Director, Head of Growth')
  const [seniorities, setSeniorities] = useState<string[]>(['director', 'head'])
  const [countries, setCountries] = useState<string[]>(['France'])
  const [keywords, setKeywords] = useState('')
  const [perPage, setPerPage] = useState(25)
  const [page, setPage] = useState(1)

  const [results, setResults] = useState<Enriched[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searching, setSearching] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function runSearch() {
    setSearching(true); setError(null); setMessage(null); setResults([]); setSelected(new Set())
    try {
      const r = await fetch('/api/admin/prospection/apollo-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_titles: titles.split(',').map(s => s.trim()).filter(Boolean),
          person_seniorities: seniorities.length ? seniorities : undefined,
          organization_locations: countries.length ? countries : undefined,
          keywords: keywords.trim() || undefined,
          page, per_page: perPage,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Search failed')
      setResults(j.people ?? [])
      setMessage(`${j.count ?? 0} contacts trouvés (page ${page})`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSearching(false)
    }
  }

  async function enrichSelected() {
    if (selected.size === 0) { setError('Sélectionne des contacts à enrichir'); return }
    setEnriching(true); setError(null); setMessage(null)
    try {
      const toEnrich = results.filter(p =>
        selected.has(p.id) && !p.email && p.first_name && p.last_name && p.organization?.primary_domain
      ).slice(0, 30)
      if (toEnrich.length === 0) {
        setMessage('Aucun contact sélectionné nécessite un enrichissement (tous ont déjà un email).')
        return
      }
      const r = await fetch('/api/admin/prospection/enrich-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: toEnrich.map(p => ({
            id: p.id,
            first_name: p.first_name!,
            last_name: p.last_name!,
            domain: p.organization!.primary_domain!,
            company: p.organization?.name,
          })),
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Enrich failed')
      const foundMap = new Map<string, { email: string; confidence: number; source: string }>()
      for (const e of j.enriched ?? []) {
        if (e.id && e.found) foundMap.set(e.id, e.found)
      }
      setResults(prev => prev.map(p => {
        const f = foundMap.get(p.id)
        return f ? { ...p, email: p.email ?? f.email, __found: f } : p
      }))
      const hits = [...foundMap.values()].length
      setMessage(`${hits}/${toEnrich.length} emails trouvés via cascade (${(j.providers ?? []).join('+')})`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setEnriching(false)
    }
  }

  async function importSelected() {
    if (selected.size === 0) { setError('Sélectionne des contacts à importer'); return }
    setImporting(true); setError(null); setMessage(null)
    try {
      const toImport = results.filter(p => selected.has(p.id)).map(p => ({
        first_name: p.first_name,
        last_name: p.last_name,
        full_name: p.name ?? [p.first_name, p.last_name].filter(Boolean).join(' '),
        linkedin_url: p.linkedin_url,
        email: p.email,
        company: p.organization?.name,
        headline: p.title,
        position: p.title,
        location: [p.city, p.country].filter(Boolean).join(', ') || undefined,
      }))
      const r = await fetch('/api/admin/prospection/import-to-warm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: toImport, source_tag: 'apollo-search' }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Import failed')
      setMessage(`✓ ${j.upserted} contacts importés dans warm network (tag=${j.tag}). Gère exclusions + assignment persona sur /admin/prospection/personal-network.`)
      setSelected(new Set())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === results.length) setSelected(new Set())
    else setSelected(new Set(results.map(r => r.id)))
  }

  const selectedCount = selected.size
  const withEmail = useMemo(() => results.filter(r => !!r.email).length, [results])
  const withoutEmail = results.length - withEmail

  return (
    <div style={{ padding: 24, color: C.text, fontFamily: 'Inter, sans-serif', maxWidth: 1500, margin: '0 auto' }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: C.gold, margin: 0 }}>
          🔭 LinkedIn Search — Waalaxy-like (Apollo + cascade email)
        </h1>
        <p style={{ color: C.muted, fontSize: '.88rem', margin: '6px 0 0' }}>
          Search Apollo par titre, pays, seniorité. Cascade email finder (Hunter+Snov+Permutator) pour ceux sans email. Import direct dans <code style={{ color: C.gold }}>personal_network_contacts</code> avec tag <code>apollo-search</code>.
          <br />
          <span style={{ color: C.amber }}>Zéro risque de ban LinkedIn</span> — pas de scraping, pas de cookies.
        </p>
      </header>

      {/* Search form */}
      <div style={{ padding: 16, background: C.card, border: `1px solid ${C.gold}22`, borderRadius: 8, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Field label="Titres (séparés par virgules)">
            <input
              value={titles} onChange={e => setTitles(e.target.value)}
              placeholder="Marketing Director, Head of Growth, VP Sales"
              style={inputStyle}
            />
          </Field>
          <Field label="Mots-clés libres">
            <input
              value={keywords} onChange={e => setKeywords(e.target.value)}
              placeholder="SaaS, B2B, fintech…"
              style={inputStyle}
            />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Field label="Pays (multi-select)">
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {COUNTRIES.map(c => (
                <button
                  key={c.code}
                  onClick={() => setCountries(prev => prev.includes(c.code) ? prev.filter(x => x !== c.code) : [...prev, c.code])}
                  style={{
                    padding: '4px 10px', fontSize: '.72rem',
                    background: countries.includes(c.code) ? C.gold : 'transparent',
                    color: countries.includes(c.code) ? C.bg : C.muted,
                    border: `1px solid ${countries.includes(c.code) ? C.gold : C.dim}44`,
                    borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >{c.label}</button>
              ))}
            </div>
          </Field>
          <Field label="Par page">
            <select value={perPage} onChange={e => setPerPage(Number(e.target.value))} style={inputStyle}>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </Field>
          <Field label="Page">
            <input type="number" min={1} value={page} onChange={e => setPage(Math.max(1, Number(e.target.value) || 1))} style={inputStyle} />
          </Field>
        </div>

        <Field label="Seniorités (multi-select)">
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {SENIORITIES.map(s => (
              <button
                key={s.key}
                onClick={() => setSeniorities(prev => prev.includes(s.key) ? prev.filter(x => x !== s.key) : [...prev, s.key])}
                style={{
                  padding: '4px 10px', fontSize: '.72rem',
                  background: seniorities.includes(s.key) ? C.blue : 'transparent',
                  color: seniorities.includes(s.key) ? C.bg : C.muted,
                  border: `1px solid ${seniorities.includes(s.key) ? C.blue : C.dim}44`,
                  borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >{s.label}</button>
            ))}
          </div>
        </Field>

        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            onClick={runSearch} disabled={searching}
            style={{
              padding: '10px 24px', background: C.gold, color: C.bg, border: 'none',
              fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', borderRadius: 4,
              fontFamily: 'inherit', opacity: searching ? 0.6 : 1,
            }}
          >{searching ? 'Recherche…' : '🔍 Lancer la recherche Apollo'}</button>

          {results.length > 0 && (
            <>
              <button onClick={toggleAll} style={secondaryBtn}>
                {selected.size === results.length ? '◻ Désélectionner tout' : '☑ Sélectionner tout'} ({selectedCount}/{results.length})
              </button>
              <button
                onClick={enrichSelected} disabled={enriching || selectedCount === 0}
                style={{ ...secondaryBtn, background: `${C.purple}15`, borderColor: C.purple, color: C.purple, opacity: (enriching || selectedCount === 0) ? 0.5 : 1 }}
              >{enriching ? 'Cascade…' : `⚡ Trouver emails manquants (${selectedCount})`}</button>
              <button
                onClick={importSelected} disabled={importing || selectedCount === 0}
                style={{ ...secondaryBtn, background: `${C.green}15`, borderColor: C.green, color: C.green, opacity: (importing || selectedCount === 0) ? 0.5 : 1 }}
              >{importing ? 'Import…' : `📥 Import → warm network (${selectedCount})`}</button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: `${C.red}15`, border: `1px solid ${C.red}44`, borderRadius: 4, color: C.red, fontSize: '.76rem', marginBottom: 12 }}>
          {error}
        </div>
      )}
      {message && (
        <div style={{ padding: 12, background: `${C.green}10`, border: `1px solid ${C.green}44`, borderRadius: 4, color: C.green, fontSize: '.76rem', marginBottom: 12 }}>
          {message}
        </div>
      )}

      {/* Stats */}
      {results.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: '.72rem', color: C.muted }}>
          <span>Total : <b style={{ color: C.text }}>{results.length}</b></span>
          <span>·</span>
          <span>Avec email : <b style={{ color: C.green }}>{withEmail}</b></span>
          <span>·</span>
          <span>Sans email : <b style={{ color: C.amber }}>{withoutEmail}</b></span>
          <span>·</span>
          <span>Sélectionnés : <b style={{ color: C.gold }}>{selectedCount}</b></span>
        </div>
      )}

      {/* Results table */}
      {results.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.gold}22`, borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.76rem' }}>
              <thead style={{ background: '#040D1C' }}>
                <tr>
                  <th style={{ ...th, textAlign: 'center' as const, width: 40 }}>
                    <input
                      type="checkbox"
                      checked={selected.size === results.length && results.length > 0}
                      onChange={toggleAll}
                      style={{ accentColor: C.gold, width: 16, height: 16 }}
                    />
                  </th>
                  <th style={th}>Nom</th>
                  <th style={th}>Titre</th>
                  <th style={th}>Entreprise · Domain</th>
                  <th style={th}>Email</th>
                  <th style={th}>Pays</th>
                  <th style={{ ...th, textAlign: 'center' as const, width: 60 }}>LinkedIn</th>
                </tr>
              </thead>
              <tbody>
                {results.map(p => {
                  const sel = selected.has(p.id)
                  const found = p.__found
                  return (
                    <tr
                      key={p.id}
                      onClick={() => toggle(p.id)}
                      style={{
                        borderTop: `1px solid ${C.dim}22`,
                        background: sel ? `${C.gold}08` : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <td style={{ ...td, textAlign: 'center' as const }} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={sel} onChange={() => toggle(p.id)}
                          style={{ accentColor: C.gold, width: 16, height: 16, cursor: 'pointer' }} />
                      </td>
                      <td style={td}>
                        <div style={{ fontWeight: 600, color: C.text }}>{p.name ?? `${p.first_name} ${p.last_name}`}</div>
                      </td>
                      <td style={{ ...td, color: C.muted, fontSize: '.72rem' }}>{p.title || '—'}</td>
                      <td style={td}>
                        <div style={{ color: C.text }}>{p.organization?.name || '—'}</div>
                        {p.organization?.primary_domain && (
                          <div style={{ fontSize: '.62rem', color: C.dim, fontFamily: 'monospace' }}>@{p.organization.primary_domain}</div>
                        )}
                      </td>
                      <td style={{ ...td, fontSize: '.7rem', fontFamily: 'monospace' }}>
                        {p.email ? (
                          <span>
                            <span style={{ color: C.green }}>{p.email}</span>
                            {found && (
                              <span style={{ display: 'block', fontSize: '.58rem', color: C.purple, marginTop: 2 }}>
                                via {found.source} ({found.confidence}%)
                              </span>
                            )}
                            {p.email_status === 'verified' && (
                              <span style={{ display: 'block', fontSize: '.58rem', color: C.green }}>✓ verified Apollo</span>
                            )}
                          </span>
                        ) : (
                          <span style={{ color: C.amber }}>— (cascade ?)</span>
                        )}
                      </td>
                      <td style={{ ...td, color: C.muted, fontSize: '.7rem' }}>
                        {[p.city, p.country, p.organization?.country].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td style={{ ...td, textAlign: 'center' as const }} onClick={e => e.stopPropagation()}>
                        {p.linkedin_url && (
                          <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer"
                            style={{ color: C.blue, fontSize: '.8rem', textDecoration: 'none' }}>🔗</a>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <footer style={{ marginTop: 24, padding: 12, background: C.card, border: `1px dashed ${C.dim}`, borderRadius: 6, fontSize: '.72rem', color: C.muted, lineHeight: 1.6 }}>
        <div style={{ color: C.gold, fontWeight: 600, marginBottom: 4 }}>💡 Cascade email — free tiers</div>
        Hunter 25 searches + 50 verifies /mo · Snov 50 crédits /mo · Permutator ∞ (patterns firstname.lastname@domain + top 3 checkés via Hunter verifier).
        <br />
        Env à configurer : <code style={{ color: C.gold }}>APOLLO_API_KEY</code>, <code style={{ color: C.gold }}>HUNTER_API_KEY</code>, <code style={{ color: C.gold }}>SNOV_CLIENT_ID</code> + <code style={{ color: C.gold }}>SNOV_CLIENT_SECRET</code>.
      </footer>
    </div>
  )
}

// ── Atoms ──────────────────────────────────────────────────────────────────

const th: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', color: C.dim,
  fontSize: '.62rem', letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 600,
}
const td: React.CSSProperties = {
  padding: '10px 12px', color: C.text, fontSize: '.74rem', verticalAlign: 'top',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: '#040D1C', border: `1px solid ${C.gold}22`,
  color: C.text, fontSize: '.78rem', fontFamily: 'inherit', outline: 'none', borderRadius: 4,
}
const secondaryBtn: React.CSSProperties = {
  padding: '10px 16px', background: 'transparent', color: C.gold,
  border: `1px solid ${C.gold}44`, fontSize: '.78rem', cursor: 'pointer',
  fontFamily: 'inherit', borderRadius: 4,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '.6rem', color: C.dim, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}
