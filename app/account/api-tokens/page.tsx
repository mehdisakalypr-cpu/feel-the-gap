'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const C = {
  bg: '#07090F',
  card: '#0F172A',
  border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C',
  text: '#E2E8F0',
  muted: '#94A3B8',
  green: '#10B981',
  red: '#EF4444',
}

type ApiToken = {
  id: string
  name: string
  token_prefix: string
  tier: 'starter' | 'pro' | 'enterprise' | 'sovereign'
  rate_limit_per_min: number
  rate_limit_per_day: number
  permissions: string[]
  last_used_at: string | null
  usage_total: number
  revoked_at: string | null
  expires_at: string | null
  created_at: string
}

const TIER_LABEL: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
  sovereign: 'Sovereign',
}

export default function ApiTokensPage() {
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTier, setNewTier] = useState<'starter' | 'pro' | 'enterprise' | 'sovereign'>('starter')
  const [justCreated, setJustCreated] = useState<{ token: string; name: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/account/api-tokens', { cache: 'no-store' })
      const d = await r.json()
      if (d.ok) setTokens(d.tokens)
      else setError(d.error || 'Erreur')
    } catch {
      setError('Réseau indisponible')
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function createToken() {
    if (!newName.trim()) { setError('Nom requis'); return }
    setCreating(true); setError(null)
    const r = await fetch('/api/account/api-tokens', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), tier: newTier }),
    })
    const d = await r.json()
    setCreating(false)
    if (d.ok && d.token) {
      setJustCreated({ token: d.token, name: newName.trim() })
      setNewName('')
      void load()
    } else {
      setError(d.error || 'Création impossible')
    }
  }

  async function revokeToken(id: string, name: string) {
    if (!confirm(`Révoquer "${name}" ? Irréversible.`)) return
    const r = await fetch(`/api/account/api-tokens/${id}/revoke`, { method: 'POST' })
    const d = await r.json()
    if (d.ok) void load()
    else setError(d.error || 'Révocation impossible')
  }

  async function copyToken() {
    if (!justCreated) return
    try {
      await navigator.clipboard.writeText(justCreated.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard peut être bloqué — fallback : select manuel par user
    }
  }

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: C.accent, letterSpacing: '.2em', textTransform: 'uppercase' }}>API Platform</div>
            <h1 style={{ fontSize: 32, fontWeight: 800, margin: '8px 0 0' }}>Mes tokens API</h1>
          </div>
          <Link href="/api-platform" style={{ color: C.accent, fontSize: 13, textDecoration: 'none' }}>← Voir les tiers</Link>
        </div>

        {justCreated && (
          <div style={{
            background: 'rgba(16,185,129,.08)', border: `1px solid ${C.green}`,
            borderRadius: 10, padding: 16, marginBottom: 20,
          }}>
            <div style={{ fontSize: 13, color: C.green, fontWeight: 700, marginBottom: 8 }}>
              ✓ Token "{justCreated.name}" créé — copie-le maintenant, il ne sera plus jamais affiché.
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <code style={{
                flex: 1, background: C.bg, border: `1px solid ${C.border}`,
                padding: '10px 12px', fontSize: 12, fontFamily: 'Menlo, monospace',
                overflow: 'auto', whiteSpace: 'nowrap', color: C.text,
              }}>{justCreated.token}</code>
              <button onClick={copyToken} style={{
                background: C.accent, color: C.bg, border: 'none',
                padding: '0 18px', fontWeight: 700, cursor: 'pointer', fontSize: 12,
              }}>{copied ? '✓ Copié' : 'Copier'}</button>
            </div>
            <button onClick={() => setJustCreated(null)} style={{
              marginTop: 8, background: 'transparent', border: 'none',
              color: C.muted, fontSize: 11, cursor: 'pointer',
            }}>Fermer</button>
          </div>
        )}

        {/* Create form */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: 20, marginBottom: 24,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Créer un nouveau token</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px auto', gap: 8 }}>
            <input
              placeholder="Nom du token (ex: Prod backend)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={{
                background: C.bg, border: `1px solid ${C.border}`, color: C.text,
                padding: '10px 12px', fontSize: 13,
              }}
            />
            <select
              value={newTier}
              onChange={e => setNewTier(e.target.value as typeof newTier)}
              style={{
                background: C.bg, border: `1px solid ${C.border}`, color: C.text,
                padding: '10px 12px', fontSize: 13,
              }}
            >
              {(['starter', 'pro', 'enterprise', 'sovereign'] as const).map(t => (
                <option key={t} value={t}>{TIER_LABEL[t]}</option>
              ))}
            </select>
            <button onClick={createToken} disabled={creating} style={{
              background: C.accent, color: C.bg, border: 'none',
              padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13,
            }}>{creating ? 'Création…' : 'Créer'}</button>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
            Le token complet ne sera affiché qu'une seule fois. Tiers payants requièrent validation compte — contacte{' '}
            <a href="mailto:api@feel-the-gap.com" style={{ color: C.accent }}>api@feel-the-gap.com</a>.
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,.1)', border: `1px solid ${C.red}`, color: C.red,
            padding: 12, marginBottom: 16, fontSize: 13,
          }}>{error}</div>
        )}

        {/* List */}
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: C.muted, letterSpacing: '.1em', textTransform: 'uppercase' }}>
          Tokens actifs
        </div>
        {loading ? (
          <div style={{ color: C.muted, padding: 20 }}>Chargement…</div>
        ) : tokens.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 32, textAlign: 'center', color: C.muted }}>
            Aucun token. Crée ton premier ci-dessus.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {tokens.map(t => {
              const revoked = !!t.revoked_at
              return (
                <div key={t.id} style={{
                  background: C.card,
                  border: `1px solid ${revoked ? 'rgba(100,116,139,.3)' : C.border}`,
                  borderRadius: 10, padding: 16,
                  opacity: revoked ? 0.6 : 1,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <strong style={{ color: C.text }}>{t.name}</strong>
                        <span style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 999,
                          background: revoked ? 'rgba(100,116,139,.2)' : 'rgba(201,168,76,.15)',
                          color: revoked ? C.muted : C.accent, letterSpacing: '.08em',
                        }}>{TIER_LABEL[t.tier]}</span>
                        {revoked && <span style={{ fontSize: 10, color: C.red }}>révoqué</span>}
                      </div>
                      <code style={{ fontSize: 12, color: C.muted, fontFamily: 'Menlo, monospace' }}>
                        {t.token_prefix}…
                      </code>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
                        {t.rate_limit_per_min}/min · {t.rate_limit_per_day.toLocaleString('fr-FR')}/jour · {t.usage_total.toLocaleString('fr-FR')} appels total
                        {t.last_used_at && <> · dernier usage {new Date(t.last_used_at).toLocaleDateString('fr-FR')}</>}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                        Scopes : {t.permissions.join(', ')}
                      </div>
                    </div>
                    {!revoked && (
                      <button onClick={() => revokeToken(t.id, t.name)} style={{
                        background: 'transparent', border: `1px solid ${C.red}`, color: C.red,
                        padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}>Révoquer</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ fontSize: 12, color: C.muted, marginTop: 32, paddingTop: 20, borderTop: `1px solid ${C.border}`, lineHeight: 1.7 }}>
          Documentation : <code style={{ color: C.accent }}>GET /api/v1/opportunities?country=FRA</code> avec{' '}
          <code style={{ color: C.accent }}>Authorization: Bearer ftg_live_...</code>
        </div>
      </div>
    </div>
  )
}
