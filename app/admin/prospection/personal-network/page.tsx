'use client'

/**
 * /admin/prospection/personal-network — Warm network import + exclusion
 * Shaka 2026-04-21
 *
 * User importe ses contacts LinkedIn perso (CSV export), exclut ceux qu'il
 * NE veut PAS approcher (amis/famille/clients/concurrents), assigne persona
 * outreach (alex/maria/thomas) qui démarche à sa place. User jamais visible
 * comme sender.
 *
 * Format CSV LinkedIn attendu (export officiel "My Network → Connections") :
 *   First Name, Last Name, URL, Email Address, Company, Position, Connected On
 */

import { useState, useEffect, useMemo, useRef } from 'react'

type Contact = {
  id: string
  linkedin_url: string | null
  full_name: string
  first_name: string | null
  last_name: string | null
  headline: string | null
  company: string | null
  position: string | null
  location: string | null
  connected_on: string | null
  email: string | null
  excluded: boolean
  exclude_reason: string | null
  exclude_notes: string | null
  assigned_persona: string | null
  outreach_status: string
  last_contact_at: string | null
  tags: string[]
  notes: string | null
  created_at: string
}

const EXCLUDE_REASONS: { key: string; label: string; icon: string }[] = [
  { key: 'family', label: 'Famille', icon: '👨‍👩‍👧' },
  { key: 'friend', label: 'Ami proche', icon: '🤝' },
  { key: 'client', label: 'Client actuel', icon: '💼' },
  { key: 'competitor', label: 'Concurrent', icon: '⚔️' },
  { key: 'sensitive', label: 'Sensible', icon: '🔒' },
  { key: 'already_contacted', label: 'Déjà approché', icon: '📧' },
  { key: 'opt_out', label: 'Refus explicite', icon: '🚫' },
  { key: 'other', label: 'Autre', icon: '❓' },
]

const PERSONAS: { key: string; label: string; voice: string; target: string }[] = [
  { key: 'alex', label: 'Alex', voice: 'direct / data', target: 'traders, investors, VCs' },
  { key: 'maria', label: 'Maria', voice: 'narrative / empathic', target: 'entrepreneurs, founders' },
  { key: 'thomas', label: 'Thomas', voice: 'formal / strategic', target: 'corporate procurement, directors' },
]

type Filter = 'all' | 'ready' | 'excluded' | 'assigned' | 'pending_assign'

// ── CSV parsing (LinkedIn official export format) ──────────────────────────

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) return []
  // LinkedIn export has a few Notes lines before the actual header. Find header row.
  let headerIdx = 0
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const low = lines[i].toLowerCase()
    if (low.includes('first name') && low.includes('last name')) {
      headerIdx = i
      break
    }
  }
  const headers = splitCsvLine(lines[headerIdx]).map(h => h.trim().toLowerCase())
  const rows: Array<Record<string, string>> = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i])
    if (cells.length === 0 || cells.every(c => !c.trim())) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = (cells[idx] ?? '').trim() })
    rows.push(row)
  }
  return rows
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = !inQuotes }
    } else if (c === ',' && !inQuotes) {
      out.push(cur); cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

function mapLinkedInRow(r: Record<string, string>) {
  const firstName = r['first name'] || ''
  const lastName = r['last name'] || ''
  const fullName = `${firstName} ${lastName}`.trim()
  if (!fullName) return null
  return {
    first_name: firstName || undefined,
    last_name: lastName || undefined,
    full_name: fullName,
    linkedin_url: r['url'] || undefined,
    email: r['email address'] || r['email'] || undefined,
    company: r['company'] || undefined,
    position: r['position'] || undefined,
    connected_on: r['connected on'] || undefined,
    headline: r['position'] || undefined,  // LinkedIn export uses Position as headline
    raw_csv_row: r,
  }
}

// ── Styles ─────────────────────────────────────────────────────────────────

const C = {
  bg: '#07090F', card: '#0D1117', gold: '#C9A84C', text: '#E8E0D0',
  muted: '#9BA8B8', dim: '#5A6A7A', green: '#10B981', red: '#EF4444',
  purple: '#A78BFA', blue: '#60A5FA', amber: '#F59E0B',
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PersonalNetworkPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadContacts() {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/admin/personal-network')
      if (!r.ok) throw new Error(await r.text())
      const { contacts } = await r.json()
      setContacts(contacts)
    } catch (e) {
      setError((e as Error).message)
    } finally { setLoading(false) }
  }

  useEffect(() => { loadContacts() }, [])

  async function handleFile(file: File) {
    setUploading(true); setError(null)
    try {
      const text = await file.text()
      const rows = parseCsv(text)
      const contactsIn = rows.map(mapLinkedInRow).filter(Boolean)
      if (contactsIn.length === 0) {
        setError('Aucun contact reconnu dans le CSV (headers attendus: "First Name", "Last Name", "URL"...)')
        return
      }
      const r = await fetch('/api/admin/personal-network', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: contactsIn }),
      })
      if (!r.ok) throw new Error(await r.text())
      const { upserted } = await r.json()
      setError(null)
      await loadContacts()
      alert(`✓ ${upserted} contacts importés (doublons mis à jour par URL LinkedIn).`)
    } catch (e) {
      setError((e as Error).message)
    } finally { setUploading(false) }
  }

  async function updateContact(id: string, updates: Record<string, unknown>) {
    const r = await fetch('/api/admin/personal-network', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates }),
    })
    if (!r.ok) { setError(await r.text()); return }
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updates } as Contact : c))
  }

  async function deleteContact(id: string) {
    if (!confirm('Supprimer ce contact ?')) return
    const r = await fetch(`/api/admin/personal-network?id=${id}`, { method: 'DELETE' })
    if (!r.ok) { setError(await r.text()); return }
    setContacts(prev => prev.filter(c => c.id !== id))
    if (selected === id) setSelected(null)
  }

  const filtered = useMemo(() => {
    let arr = contacts
    if (filter === 'ready') arr = arr.filter(c => !c.excluded && c.outreach_status === 'pending')
    else if (filter === 'excluded') arr = arr.filter(c => c.excluded)
    else if (filter === 'assigned') arr = arr.filter(c => !c.excluded && c.assigned_persona)
    else if (filter === 'pending_assign') arr = arr.filter(c => !c.excluded && !c.assigned_persona)
    if (search) {
      const s = search.toLowerCase()
      arr = arr.filter(c =>
        c.full_name.toLowerCase().includes(s) ||
        (c.company ?? '').toLowerCase().includes(s) ||
        (c.headline ?? '').toLowerCase().includes(s)
      )
    }
    return arr
  }, [contacts, filter, search])

  const stats = useMemo(() => ({
    total: contacts.length,
    ready: contacts.filter(c => !c.excluded && c.outreach_status === 'pending').length,
    excluded: contacts.filter(c => c.excluded).length,
    assigned: contacts.filter(c => !c.excluded && c.assigned_persona).length,
    pending_assign: contacts.filter(c => !c.excluded && !c.assigned_persona).length,
    contacted: contacts.filter(c => c.outreach_status === 'contacted').length,
    replied: contacts.filter(c => c.outreach_status === 'replied').length,
    by_persona: Object.fromEntries(PERSONAS.map(p => [
      p.key, contacts.filter(c => c.assigned_persona === p.key && !c.excluded).length
    ])),
  }), [contacts])

  const selectedContact = selected ? contacts.find(c => c.id === selected) ?? null : null

  return (
    <div style={{ padding: 24, color: C.text, fontFamily: 'Inter, sans-serif', maxWidth: 1400, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: C.gold, margin: 0 }}>
          🕵️ Réseau LinkedIn perso → Persona outreach
        </h1>
        <p style={{ color: C.muted, fontSize: '.88rem', margin: '8px 0 0', lineHeight: 1.5 }}>
          Importe tes contacts LinkedIn perso (CSV export &quot;My Network → Connections&quot;).
          Exclus ceux à ne PAS approcher (famille, amis, clients, concurrents, sensibles).
          Le reste est assigné à une persona (Alex / Maria / Thomas) qui démarche <strong style={{ color: C.gold }}>sans que tu apparaisses</strong>.
        </p>
      </header>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
        <Stat label="Total" value={stats.total} color={C.gold} active={filter === 'all'} onClick={() => setFilter('all')} />
        <Stat label="Ready outreach" value={stats.ready} color={C.green} active={filter === 'ready'} onClick={() => setFilter('ready')} />
        <Stat label="À assigner" value={stats.pending_assign} color={C.amber} active={filter === 'pending_assign'} onClick={() => setFilter('pending_assign')} />
        <Stat label="Assignés" value={stats.assigned} color={C.blue} active={filter === 'assigned'} onClick={() => setFilter('assigned')} />
        <Stat label="Exclus" value={stats.excluded} color={C.red} active={filter === 'excluded'} onClick={() => setFilter('excluded')} />
        <Stat label="Contactés" value={stats.contacted} color={C.purple} />
        <Stat label="Répondus" value={stats.replied} color={C.green} />
      </div>

      {/* Persona breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {PERSONAS.map(p => (
          <div key={p.key} style={{ padding: 14, background: C.card, border: `1px solid ${C.gold}22`, borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, color: C.gold, fontSize: '.9rem' }}>{p.label}</span>
              <span style={{ fontWeight: 800, color: C.text, fontFamily: 'monospace' }}>{stats.by_persona[p.key] ?? 0}</span>
            </div>
            <div style={{ fontSize: '.68rem', color: C.muted, marginTop: 4 }}>{p.voice}</div>
            <div style={{ fontSize: '.62rem', color: C.dim, marginTop: 2 }}>→ {p.target}</div>
          </div>
        ))}
      </div>

      {/* Import CSV */}
      <div style={{ marginBottom: 20, padding: 18, background: C.card, border: `1px dashed ${C.gold}44`, borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontWeight: 600, color: C.gold, fontSize: '.86rem' }}>📎 Importer CSV LinkedIn</div>
            <div style={{ fontSize: '.7rem', color: C.muted, marginTop: 4 }}>
              Depuis LinkedIn → Settings → Data Privacy → <strong>Get a copy of your data</strong> → cocher &quot;Connections&quot; → télécharger l&apos;archive → ouvre <code>Connections.csv</code>.
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) await handleFile(f)
              if (fileRef.current) fileRef.current.value = ''
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              padding: '10px 18px', background: C.gold, color: '#07090F', border: 'none',
              fontWeight: 700, fontSize: '.8rem', cursor: 'pointer', borderRadius: 4,
              fontFamily: 'inherit', opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? 'Import en cours…' : '📥 Importer CSV'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: 'rgba(239,68,68,.08)', border: `1px solid ${C.red}44`, borderRadius: 6, color: C.red, fontSize: '.76rem', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input
          type="text"
          placeholder="Rechercher par nom, entreprise, titre…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', maxWidth: 400, padding: '8px 12px',
            background: C.card, border: `1px solid ${C.gold}22`, color: C.text,
            fontSize: '.78rem', fontFamily: 'inherit', outline: 'none', borderRadius: 4,
          }}
        />
      </div>

      {/* Contacts table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: '.78rem' }}>
          {contacts.length === 0
            ? 'Aucun contact importé. Upload ton CSV LinkedIn ci-dessus.'
            : 'Aucun contact ne matche ce filtre / recherche.'}
        </div>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.gold}22`, borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.76rem' }}>
              <thead style={{ background: '#040D1C' }}>
                <tr>
                  <th style={th}>Nom</th>
                  <th style={th}>Entreprise / Titre</th>
                  <th style={th}>Email</th>
                  <th style={th}>Connexion</th>
                  <th style={{ ...th, textAlign: 'center' as const }}>Persona</th>
                  <th style={{ ...th, textAlign: 'center' as const }}>Exclure</th>
                  <th style={{ ...th, textAlign: 'center' as const }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr
                    key={c.id}
                    style={{
                      borderTop: `1px solid ${C.dim}22`,
                      background: selected === c.id ? `${C.gold}08` : c.excluded ? 'rgba(239,68,68,.04)' : 'transparent',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelected(selected === c.id ? null : c.id)}
                  >
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: c.excluded ? C.dim : C.text, textDecoration: c.excluded ? 'line-through' : 'none' }}>
                        {c.full_name}
                      </div>
                      {c.linkedin_url && (
                        <a
                          href={c.linkedin_url} target="_blank" rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontSize: '.62rem', color: C.blue, textDecoration: 'none' }}
                        >
                          🔗 profil
                        </a>
                      )}
                    </td>
                    <td style={td}>
                      <div style={{ color: C.text, fontSize: '.72rem' }}>{c.company || '—'}</div>
                      <div style={{ color: C.dim, fontSize: '.64rem', marginTop: 2 }}>{c.headline || c.position || ''}</div>
                    </td>
                    <td style={{ ...td, fontSize: '.68rem', color: C.muted, fontFamily: 'monospace' }}>
                      {c.email || '—'}
                    </td>
                    <td style={{ ...td, color: C.dim, fontSize: '.68rem' }}>{c.connected_on || '—'}</td>
                    <td style={{ ...td, textAlign: 'center' as const }} onClick={e => e.stopPropagation()}>
                      <select
                        value={c.assigned_persona || ''}
                        onChange={(e) => updateContact(c.id, { assigned_persona: e.target.value || null })}
                        disabled={c.excluded}
                        style={{
                          padding: '4px 8px', background: '#040D1C', color: C.text,
                          border: `1px solid ${c.assigned_persona ? C.gold : C.dim}44`,
                          fontSize: '.7rem', fontFamily: 'inherit', borderRadius: 3,
                        }}
                      >
                        <option value="">—</option>
                        {PERSONAS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                      </select>
                    </td>
                    <td style={{ ...td, textAlign: 'center' as const }} onClick={e => e.stopPropagation()}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={c.excluded}
                          onChange={(e) => {
                            const excluded = e.target.checked
                            const reason = excluded ? (c.exclude_reason || 'other') : null
                            updateContact(c.id, { excluded, exclude_reason: reason })
                          }}
                          style={{ accentColor: C.red, width: 16, height: 16 }}
                        />
                        {c.excluded && (
                          <select
                            value={c.exclude_reason || 'other'}
                            onChange={(e) => updateContact(c.id, { exclude_reason: e.target.value })}
                            style={{
                              padding: '3px 6px', background: '#040D1C', color: C.text,
                              border: `1px solid ${C.red}44`, fontSize: '.65rem',
                              fontFamily: 'inherit', borderRadius: 3,
                            }}
                          >
                            {EXCLUDE_REASONS.map(r => (
                              <option key={r.key} value={r.key}>{r.icon} {r.label}</option>
                            ))}
                          </select>
                        )}
                      </label>
                    </td>
                    <td style={{ ...td, textAlign: 'center' as const }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => deleteContact(c.id)}
                        title="Supprimer"
                        style={{ background: 'transparent', border: 'none', color: C.red, cursor: 'pointer', fontSize: '.9rem' }}
                      >🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selectedContact && (
        <div style={{ marginTop: 16, padding: 16, background: C.card, border: `1px solid ${C.gold}44`, borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, color: C.gold, fontSize: '.96rem' }}>{selectedContact.full_name}</div>
            <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', color: C.dim, cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: '.6rem', color: C.dim, textTransform: 'uppercase', letterSpacing: '.1em' }}>Notes internes</div>
              <textarea
                defaultValue={selectedContact.notes || ''}
                onBlur={(e) => updateContact(selectedContact.id, { notes: e.target.value })}
                placeholder="Note privée (contexte, historique, signaux…)"
                style={{
                  width: '100%', marginTop: 6, padding: 8, minHeight: 80,
                  background: '#040D1C', border: `1px solid ${C.dim}33`,
                  color: C.text, fontFamily: 'inherit', fontSize: '.76rem', borderRadius: 4, resize: 'vertical',
                }}
              />
            </div>
            {selectedContact.excluded && (
              <div>
                <div style={{ fontSize: '.6rem', color: C.dim, textTransform: 'uppercase', letterSpacing: '.1em' }}>Raison d&apos;exclusion</div>
                <textarea
                  defaultValue={selectedContact.exclude_notes || ''}
                  onBlur={(e) => updateContact(selectedContact.id, { exclude_notes: e.target.value })}
                  placeholder="Précision optionnelle (ex: collègue 2015-2020, beau-frère, client OFA…)"
                  style={{
                    width: '100%', marginTop: 6, padding: 8, minHeight: 80,
                    background: '#040D1C', border: `1px solid ${C.red}33`,
                    color: C.text, fontFamily: 'inherit', fontSize: '.76rem', borderRadius: 4, resize: 'vertical',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <footer style={{ marginTop: 24, padding: 14, background: C.card, border: `1px dashed ${C.dim}`, borderRadius: 6, fontSize: '.74rem', color: C.muted, lineHeight: 1.6 }}>
        <div style={{ color: C.gold, fontWeight: 600, marginBottom: 6 }}>🛡️ Garde-fou invisibilité</div>
        L&apos;outreach ne part <strong>JAMAIS</strong> depuis ton profil perso. Les personas (Alex / Maria / Thomas) opèrent depuis des comptes LinkedIn distincts (voir <code style={{ color: C.gold }}>social_credentials</code> dans CC). Agent <code>sequence-dispatcher.ts</code> consomme la vue SQL <code>v_warm_network_ready</code> et achemine vers la persona assignée.
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

function Stat({ label, value, color, active, onClick }: { label: string; value: number; color: string; active?: boolean; onClick?: () => void }) {
  const clickable = !!onClick
  return (
    <button
      onClick={onClick}
      disabled={!clickable}
      style={{
        padding: '10px 14px', background: C.card,
        border: `1px solid ${active ? color : `${color}33`}`,
        color: C.text, fontFamily: 'inherit', cursor: clickable ? 'pointer' : 'default',
        borderRadius: 6, textAlign: 'left', transition: 'border-color .15s',
      }}
    >
      <div style={{ fontSize: '1.2rem', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '.58rem', color: C.dim, textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2 }}>{label}</div>
    </button>
  )
}
