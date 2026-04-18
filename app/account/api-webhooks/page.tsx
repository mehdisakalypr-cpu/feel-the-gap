'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const C = {
  bg: '#07090F', card: '#0F172A', border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8',
  green: '#10B981', red: '#EF4444', orange: '#F59E0B',
}

type Webhook = {
  id: string
  name: string
  url: string
  events: string[]
  active: boolean
  created_at: string
  last_success_at: string | null
  last_failure_at: string | null
  failure_count: number
}

const AVAILABLE_EVENTS = [
  { id: 'opportunity.created', label: 'Nouvelle opportunité' },
  { id: 'opportunity.updated', label: 'Opportunité mise à jour' },
  { id: 'country.stats_refreshed', label: 'Stats pays rafraîchies' },
]

export default function ApiWebhooksPage() {
  const [hooks, setHooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['opportunity.created'])
  const [creating, setCreating] = useState(false)
  const [justCreated, setJustCreated] = useState<{ secret: string; name: string } | null>(null)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/account/api-webhooks', { cache: 'no-store' })
      const d = await r.json()
      if (d.ok) setHooks(d.webhooks)
      else setError(d.error || 'erreur')
    } catch {
      setError('réseau indisponible')
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  function toggleEvent(e: string) {
    setSelectedEvents(s => s.includes(e) ? s.filter(x => x !== e) : [...s, e])
  }

  async function create() {
    if (!name.trim() || !url.trim()) { setError('nom + URL requis'); return }
    if (selectedEvents.length === 0) { setError('au moins 1 event'); return }
    setCreating(true); setError(null)
    const r = await fetch('/api/account/api-webhooks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), url: url.trim(), events: selectedEvents }),
    })
    const d = await r.json()
    setCreating(false)
    if (d.ok) {
      setJustCreated({ secret: d.secret, name: name.trim() })
      setName(''); setUrl('')
      void load()
    } else {
      setError(d.error || 'création impossible')
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Supprimer "${name}" ? Irréversible.`)) return
    const r = await fetch(`/api/account/api-webhooks/${id}`, { method: 'DELETE' })
    if (r.ok) void load()
  }

  async function toggleActive(h: Webhook) {
    await fetch(`/api/account/api-webhooks/${h.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !h.active }),
    })
    void load()
  }

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: C.accent, letterSpacing: '.2em', textTransform: 'uppercase' }}>API Platform</div>
            <h1 style={{ fontSize: 32, fontWeight: 800, margin: '8px 0 0' }}>Mes webhooks</h1>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
            <Link href="/account/api-tokens" style={{ color: C.accent, textDecoration: 'none' }}>← Tokens</Link>
            <Link href="/docs/api" style={{ color: C.accent, textDecoration: 'none' }}>Docs →</Link>
          </div>
        </div>

        {justCreated && (
          <div style={{ background: 'rgba(16,185,129,.08)', border: `1px solid ${C.green}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: C.green, fontWeight: 700, marginBottom: 8 }}>
              ✓ Webhook "{justCreated.name}" créé — copie le secret maintenant, il ne sera plus jamais affiché.
            </div>
            <code style={{
              display: 'block', background: C.bg, border: `1px solid ${C.border}`,
              padding: '10px 12px', fontSize: 12, fontFamily: 'Menlo, monospace',
              overflow: 'auto', whiteSpace: 'nowrap', color: C.text, borderRadius: 6,
            }}>{justCreated.secret}</code>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
              Utilisé pour vérifier la signature HMAC-SHA256 dans header <code>X-Ftg-Signature: sha256=&lt;hex&gt;</code>.
            </div>
            <button onClick={() => setJustCreated(null)} style={{
              marginTop: 10, background: 'transparent', border: 'none', color: C.muted, fontSize: 11, cursor: 'pointer',
            }}>Fermer</button>
          </div>
        )}

        {/* Create form */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Créer un webhook</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <input
              placeholder="Nom (ex: Slack channel #trade)"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: '10px 12px', fontSize: 13 }}
            />
            <input
              placeholder="https://example.com/webhook"
              value={url}
              onChange={e => setUrl(e.target.value)}
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: '10px 12px', fontSize: 13 }}
            />
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Events</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {AVAILABLE_EVENTS.map(e => {
                  const on = selectedEvents.includes(e.id)
                  return (
                    <button key={e.id} onClick={() => toggleEvent(e.id)} style={{
                      background: on ? 'rgba(201,168,76,.15)' : 'transparent',
                      border: `1px solid ${on ? C.accent : C.border}`,
                      color: on ? C.accent : C.muted,
                      padding: '6px 12px', fontSize: 11, cursor: 'pointer', borderRadius: 999,
                    }}>{e.label}</button>
                  )
                })}
              </div>
            </div>
            <button onClick={create} disabled={creating} style={{
              background: C.accent, color: C.bg, border: 'none',
              padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13,
            }}>{creating ? 'Création…' : 'Créer le webhook'}</button>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,.1)', border: `1px solid ${C.red}`, color: C.red, padding: 12, marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: C.muted, letterSpacing: '.1em', textTransform: 'uppercase' }}>
          Webhooks configurés
        </div>

        {loading ? (
          <div style={{ color: C.muted, padding: 20 }}>Chargement…</div>
        ) : hooks.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 32, textAlign: 'center', color: C.muted }}>
            Aucun webhook. Crée-en un ci-dessus.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {hooks.map(h => {
              const hasFailures = h.failure_count > 0
              const deactivated = !h.active
              return (
                <div key={h.id} style={{
                  background: C.card,
                  border: `1px solid ${deactivated ? 'rgba(100,116,139,.3)' : C.border}`,
                  borderRadius: 10, padding: 16,
                  opacity: deactivated ? 0.7 : 1,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <strong style={{ color: C.text }}>{h.name}</strong>
                        {deactivated && <span style={{ fontSize: 10, color: C.red }}>inactif</span>}
                        {hasFailures && !deactivated && (
                          <span style={{ fontSize: 10, color: C.orange }}>{h.failure_count} échec{h.failure_count > 1 ? 's' : ''}</span>
                        )}
                      </div>
                      <code style={{ fontSize: 11, color: C.muted, fontFamily: 'Menlo, monospace', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                        {h.url}
                      </code>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {h.events.map(e => (
                          <span key={e} style={{ background: 'rgba(201,168,76,.08)', color: C.accent, padding: '2px 8px', borderRadius: 999 }}>
                            {e}
                          </span>
                        ))}
                      </div>
                      {(h.last_success_at || h.last_failure_at) && (
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>
                          {h.last_success_at && <span>✓ succès {new Date(h.last_success_at).toLocaleString('fr-FR')}</span>}
                          {h.last_success_at && h.last_failure_at && ' · '}
                          {h.last_failure_at && <span>✗ échec {new Date(h.last_failure_at).toLocaleString('fr-FR')}</span>}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
                      <button onClick={() => toggleActive(h)} style={{
                        background: 'transparent', border: `1px solid ${C.border}`, color: C.muted,
                        padding: '4px 10px', fontSize: 10, cursor: 'pointer', borderRadius: 4,
                      }}>{h.active ? 'Désactiver' : 'Activer'}</button>
                      <button onClick={() => remove(h.id, h.name)} style={{
                        background: 'transparent', border: `1px solid ${C.red}`, color: C.red,
                        padding: '4px 10px', fontSize: 10, cursor: 'pointer', borderRadius: 4,
                      }}>Supprimer</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ fontSize: 12, color: C.muted, marginTop: 32, paddingTop: 20, borderTop: `1px solid ${C.border}`, lineHeight: 1.7 }}>
          Chaque POST envoyé contient headers <code>X-Ftg-Event</code>, <code>X-Ftg-Timestamp</code>, <code>X-Ftg-Signature: sha256=&lt;hex&gt;</code>.
          Vérifie la signature côté serveur : <code>hmacSHA256(secret, `${'${'}timestamp${'}'}.${'${'}body${'}'}`) === sig</code>.
          Retry 1× immédiat, puis backoff au prochain cron (hourly). Après 10 échecs consécutifs → inactif auto.
        </div>
      </div>
    </div>
  )
}
