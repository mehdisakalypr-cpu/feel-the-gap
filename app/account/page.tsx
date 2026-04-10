'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Topbar from '@/components/Topbar'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useLang } from '@/components/LanguageProvider'

type Tier = 'explorer' | 'data' | 'strategy' | 'premium' | 'enterprise'

const TIER_CONFIG: Record<Tier, { label: string; color: string; reports: number; paid: boolean }> = {
  explorer:   { label: 'Explorer',  color: '#6B7280', reports: 1,  paid: false },
  data:       { label: 'Data',      color: '#60A5FA', reports: 20, paid: true  },
  strategy:   { label: 'Strategy',  color: '#C9A84C', reports: -1, paid: true  },
  premium:    { label: 'Premium',   color: '#A78BFA', reports: -1, paid: true  },
  enterprise: { label: 'Enterprise',color: '#64748B', reports: -1, paid: true  },
}

function ManageSubscriptionBtn() {
  const [loading, setLoading] = useState(false)
  const handlePortal = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const { url, error } = await res.json()
      if (url) window.location.href = url
      else console.error('Portal error:', error)
    } finally { setLoading(false) }
  }
  return (
    <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-6 mb-4">
      <div className="font-semibold text-white mb-1">Abonnement</div>
      <div className="text-sm text-gray-400 mb-4">Gérez votre abonnement, consultez vos factures ou résiliez depuis le portail de facturation.</div>
      <button onClick={handlePortal} disabled={loading}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 text-white font-medium rounded-xl hover:bg-white/10 transition-colors text-sm disabled:opacity-50">
        {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '⚙️'}
        Gérer mon abonnement
      </button>
    </div>
  )
}

export default function AccountPage() {
  const router = useRouter()
  const { t, lang } = useLang()
  const [user, setUser] = useState<{ email: string; created_at: string } | null>(null)
  const [tier, setTier] = useState<Tier>('explorer')
  const [loading, setLoading] = useState(true)

  const [isDemo, setIsDemo] = useState(false)
  const [demoExpired, setDemoExpired] = useState(false)
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    const sb = createSupabaseBrowser()
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/auth/login'); return }
      setUser({ email: data.user.email ?? '', created_at: data.user.created_at })
      const { data: profile } = await sb.from('profiles').select('tier, is_billed, is_admin, demo_expires_at, username').eq('id', data.user.id).single()
      if (profile?.username) setUsername(profile.username)
      const t = (profile?.tier as Tier) ?? 'explorer'
      setTier(t)
      if (profile && !profile.is_billed && !profile.is_admin) {
        setIsDemo(true)
        if (profile.demo_expires_at && new Date(profile.demo_expires_at).getTime() < Date.now()) {
          setDemoExpired(true)
        }
      }
      setLoading(false)
    })
  }, [router])

  async function handleSignOut() {
    const sb = createSupabaseBrowser()
    await sb.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const tierCfg = TIER_CONFIG[tier] ?? TIER_CONFIG.explorer
  const joined = user
    ? new Date(user.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' })
    : '—'

  return (
    <div className="min-h-screen flex flex-col bg-[#07090F]">
      <Topbar />
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
        <h1 className="text-2xl font-bold text-white mb-6">{t('account.title')}</h1>

        {/* Profile */}
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-[#C9A84C]/20 flex items-center justify-center text-xl font-bold text-[#C9A84C]">
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <div className="font-semibold text-white">{username ?? user?.email}</div>
              {username && <div className="text-xs text-gray-400">{user?.email}</div>}
              <div className="text-sm text-gray-500">{t('account.member_since')} {joined}</div>
            </div>
            <div className="ml-auto">
              <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: tierCfg.color + '20', color: tierCfg.color }}>
                {isDemo ? `Demo ${tierCfg.label}` : tierCfg.label}
              </span>
            </div>
          </div>
        </div>

        {/* Usage */}
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-6 mb-4">
          <h2 className="font-semibold text-white mb-4">{t('account.this_month')}</h2>
          <div className="flex gap-3">
            <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">0</div>
              <div className="text-xs text-gray-500">{t('account.reports')}</div>
            </div>
            <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">0</div>
              <div className="text-xs text-gray-500">{t('account.business_plans')}</div>
            </div>
            <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">0</div>
              <div className="text-xs text-gray-500">{t('account.farming_scans')}</div>
            </div>
          </div>
        </div>

        {/* Demo expiration warning */}
        {isDemo && demoExpired && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 mb-4">
            <div className="font-semibold text-red-400 mb-1">Votre période d'essai a expiré</div>
            <div className="text-sm text-gray-400 mb-4">Votre accès Demo {tierCfg.label} a expiré. Passez à un plan payant pour continuer à profiter de toutes les fonctionnalités.</div>
            <Link href="/pricing" className="inline-block px-5 py-2.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors text-sm">
              Voir les plans
            </Link>
          </div>
        )}

        {isDemo && !demoExpired && (
          <div className="bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded-2xl p-6 mb-4">
            <div className="font-semibold text-[#C9A84C] mb-1">Mode démo actif</div>
            <div className="text-sm text-gray-400">Vous bénéficiez d'un accès gratuit au plan {tierCfg.label}. Passez à un plan payant pour un accès permanent.</div>
          </div>
        )}

        {/* Upgrade CTA */}
        {!tierCfg.paid && !isDemo && (
          <div className="bg-gradient-to-r from-[#C9A84C]/10 to-[#E8C97A]/5 border border-[#C9A84C]/30 rounded-2xl p-6 mb-4">
            <div className="font-semibold text-white mb-1">{t('account.upgrade_title')}</div>
            <div className="text-sm text-gray-400 mb-4">{t('account.upgrade_desc')}</div>
            <Link href="/pricing" className="inline-block px-5 py-2.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors text-sm">
              {t('account.view_plans')}
            </Link>
          </div>
        )}

        {/* Manage subscription */}
        {tierCfg.paid && (
          <ManageSubscriptionBtn />
        )}

        {/* Biometric setup */}
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-6 mb-4">
          <div className="font-semibold text-white mb-1">Connexion biométrique</div>
          <div className="text-sm text-gray-400 mb-4">Activez l'empreinte digitale ou Face ID pour vous connecter instantanément.</div>
          <button
            onClick={() => {
              localStorage.removeItem('ftg_biometric_offered')
              localStorage.setItem('ftg_biometric_email', user?.email ?? '')
              router.push('/auth/biometric-setup')
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 text-white font-medium rounded-xl hover:bg-white/10 transition-colors text-sm"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 11c0-1.1.9-2 2-2s2 .9 2 2-2 4-2 4" />
              <path d="M8 15c0-2.2 1.8-4 4-4" />
              <path d="M12 3c4.97 0 9 4.03 9 9 0 1.4-.32 2.72-.88 3.9" />
              <path d="M3 12c0-4.97 4.03-9 9-9" />
              <path d="M6.34 17.66A8.96 8.96 0 0 1 3 12" />
            </svg>
            Configurer la biométrie
          </button>
        </div>

        {/* Links */}
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl divide-y divide-white/5">
          {[
            { href: '/map',        label: t('account.links.map') },
            { href: '/reports',    label: t('account.links.reports') },
            { href: '/farming',    label: t('account.links.farming') },
            { href: '/influencer', label: t('account.links.influencer') },
            { href: '/seller',     label: t('account.links.seller') },
            { href: '/pricing',    label: t('account.links.pricing') },
          ].map(({ href, label }) => (
            <Link key={href} href={href} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors">
              <span className="text-sm text-gray-300">{label}</span>
              <span className="text-gray-500 text-xs">→</span>
            </Link>
          ))}
          <button onClick={handleSignOut} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors text-left">
            <span className="text-sm text-red-400">{t('account.signout')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
