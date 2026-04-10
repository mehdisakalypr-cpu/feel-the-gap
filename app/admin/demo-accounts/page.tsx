'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Admin page: liste les comptes démo + credentials + bouton "Se connecter en tant que…"
// Permet à l'admin de switcher instantanément entre les parcours lors des démos live.
// Permet aussi de basculer chaque compte entre free et premium pour montrer les features gated.

interface DemoAccount {
  email: string
  password: string
  role: string
  full_name: string
  company: string
  icon: string
  color: string
  highlights: string[]
  home: string
  // Toggle between free and the paying tier. Null = no paying tier (influenceur).
  paying_tier: string | null
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'demo.entrepreneur@feelthegap.app',
    password: 'DemoFTG2026!',
    role: 'entrepreneur',
    full_name: 'Amélie Dubois',
    company: 'Cacao de Côte d\'Ivoire SARL',
    icon: '🧭',
    color: '#C9A84C',
    highlights: [
      '4 produits opt-in dans products_catalog',
      '1 dossier financement 180 k€ CIV/cacao (submitted)',
      '1 dossier investissement 350 k€ pre-money 2.8 M€ (submitted)',
    ],
    home: '/map',
    paying_tier: 'strategy',
  },
  {
    email: 'demo.influenceur@feelthegap.app',
    password: 'DemoFTG2026!',
    role: 'influenceur',
    full_name: 'Léa Martin',
    company: 'Léa Martin Media',
    icon: '🎤',
    color: '#A78BFA',
    highlights: [
      'Influencer profile — 45k followers, 4.2% engagement',
      '3 favoris dans influencer_favorites',
      'Accès /influencer/catalog + /influencer/welcome',
      'Pas de plan payant dans le parcours influenceur',
    ],
    home: '/influencer/catalog',
    paying_tier: null, // no paying plan for influencer
  },
  {
    email: 'demo.financeur@feelthegap.app',
    password: 'DemoFTG2026!',
    role: 'financeur',
    full_name: 'Pierre Laurent',
    company: 'Banque Éthique SA',
    icon: '🏦',
    color: '#34D399',
    highlights: [
      'Accès RLS au dossier financement 180 k€',
      'Finance Premium : voir dossier complet + faire une offre',
      'Free : voir dossier anonymisé seulement',
    ],
    home: '/finance',
    paying_tier: 'premium', // "Finance Premium" = tier=premium
  },
  {
    email: 'demo.investisseur@feelthegap.app',
    password: 'DemoFTG2026!',
    role: 'investisseur',
    full_name: 'Marie Chen',
    company: 'Green Ventures Capital',
    icon: '📈',
    color: '#60A5FA',
    highlights: [
      'Accès RLS au dossier invest 350 k€ (pre-money 2.8 M€)',
      'Invest Premium : voir dossier complet + proposer un ticket + contre-proposition',
      'Free : voir dossier anonymisé seulement',
    ],
    home: '/invest',
    paying_tier: 'premium', // "Invest Premium" = tier=premium
  },
]

export default function DemoAccountsPage() {
  const router = useRouter()
  const [impersonating, setImpersonating] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [tiers, setTiers] = useState<Record<string, string>>({})
  const [togglingTier, setTogglingTier] = useState<string | null>(null)

  // Load current tiers of demo accounts
  useEffect(() => {
    fetch('/api/admin/demo-tier')
      .then((r) => r.json())
      .then((j) => {
        if (j.accounts) {
          const map: Record<string, string> = {}
          for (const a of j.accounts) map[a.email] = a.tier
          setTiers(map)
        }
      })
      .catch(() => {})
  }, [])

  async function toggleTier(acc: DemoAccount) {
    if (!acc.paying_tier) return
    const currentTier = tiers[acc.email] ?? 'free'
    const newTier = currentTier === 'free' ? acc.paying_tier : 'free'
    setTogglingTier(acc.email)
    setError('')
    try {
      const res = await fetch('/api/admin/demo-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: acc.email, tier: newTier }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      setTiers((prev) => ({ ...prev, [acc.email]: newTier }))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setTogglingTier(null)
    }
  }

  async function impersonate(email: string) {
    setImpersonating(email)
    setError('')
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      // Full page reload to pick up new session cookies
      window.location.href = j.redirect ?? '/map'
    } catch (err) {
      setError((err as Error).message)
      setImpersonating(null)
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">🎭 Comptes de démo</h1>
        <p className="text-sm text-gray-400">
          Credentials des 4 profils démo pour présenter les parcours entrepreneurs, influenceurs,
          financeurs et investisseurs. Tu peux te connecter en un clic — la session admin est
          remplacée par celle du compte démo sélectionné.
        </p>
      </div>

      <div className="mb-6 rounded-xl p-3 text-xs"
        style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
        <span className="text-[#FBBF24]">⚠️</span>{' '}
        <span className="text-gray-300">
          Après avoir cliqué "Se connecter en tant que…", tu seras basculé sur le parcours du
          compte démo. Pour revenir en admin, reconnecte-toi avec ton email admin habituel.
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-xl p-3 text-sm text-red-300"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          ⚠️ {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {DEMO_ACCOUNTS.map((acc) => (
          <div
            key={acc.email}
            className="rounded-2xl p-5"
            style={{ background: '#0D1117', border: `1px solid ${acc.color}25` }}
          >
            <div className="flex items-start gap-3 mb-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: `${acc.color}15`, border: `1px solid ${acc.color}40` }}
              >
                {acc.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white">{acc.full_name}</h3>
                <p className="text-xs text-gray-500">{acc.company}</p>
                <span
                  className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: `${acc.color}20`, color: acc.color }}
                >
                  {acc.role.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2">
                <div className="text-[10px] text-gray-500 w-16">Email</div>
                <code className="flex-1 text-xs text-gray-300 font-mono bg-white/5 px-2 py-1 rounded overflow-x-auto">
                  {acc.email}
                </code>
                <button
                  onClick={() => copyToClipboard(acc.email, `${acc.email}-em`)}
                  className="text-[10px] text-gray-500 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/5"
                >
                  {copied === `${acc.email}-em` ? '✓' : 'copier'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-[10px] text-gray-500 w-16">Password</div>
                <code className="flex-1 text-xs text-gray-300 font-mono bg-white/5 px-2 py-1 rounded">
                  {acc.password}
                </code>
                <button
                  onClick={() => copyToClipboard(acc.password, `${acc.email}-pw`)}
                  className="text-[10px] text-gray-500 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/5"
                >
                  {copied === `${acc.email}-pw` ? '✓' : 'copier'}
                </button>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">Ce que ce compte montre</div>
              <ul className="space-y-1">
                {acc.highlights.map((h) => (
                  <li key={h} className="text-xs text-gray-400 flex items-start gap-1.5">
                    <span className="mt-0.5" style={{ color: acc.color }}>•</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>

            {/* Tier toggle (hidden for influenceur — no paying plan) */}
            {acc.paying_tier && (
              <div className="mb-3 rounded-xl p-3"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">Plan actuel</div>
                  <div className="text-[10px] font-bold"
                    style={{ color: (tiers[acc.email] ?? 'free') === 'free' ? '#9CA3AF' : acc.color }}>
                    {(tiers[acc.email] ?? 'free').toUpperCase()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleTier(acc)}
                    disabled={togglingTier === acc.email}
                    className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-50"
                    style={{
                      background: (tiers[acc.email] ?? 'free') === 'free'
                        ? `linear-gradient(135deg,${acc.color}40,${acc.color}20)`
                        : 'rgba(255,255,255,0.05)',
                      color: (tiers[acc.email] ?? 'free') === 'free' ? acc.color : '#9CA3AF',
                      border: `1px solid ${(tiers[acc.email] ?? 'free') === 'free' ? acc.color + '60' : 'rgba(255,255,255,0.1)'}`,
                    }}
                  >
                    {togglingTier === acc.email
                      ? '…'
                      : (tiers[acc.email] ?? 'free') === 'free'
                        ? `🔓 Activer ${acc.paying_tier === 'premium' ? 'Premium' : 'Strategy'}`
                        : `🔒 Repasser Free`}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => impersonate(acc.email)}
              disabled={impersonating !== null}
              className="w-full py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{
                background: impersonating === acc.email
                  ? 'rgba(255,255,255,0.05)'
                  : `linear-gradient(135deg,${acc.color},${acc.color}cc)`,
                color: impersonating === acc.email ? '#9CA3AF' : '#07090F',
              }}
            >
              {impersonating === acc.email ? 'Switch en cours…' : `Se connecter en tant que ${acc.role} →`}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
