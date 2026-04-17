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

function EyeToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={-1}
      aria-label={open ? 'Masquer' : 'Afficher'}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#C9A84C] transition-colors"
    >
      {open ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  )
}

function PasswordChangeBlock({ email }: { email: string }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setOk(false)
    if (next.length < 12) { setErr('Minimum 12 caractères.'); return }
    if (next !== confirm) { setErr('Les mots de passe ne correspondent pas.'); return }
    if (next === current) { setErr('Le nouveau mot de passe doit être différent.'); return }
    setLoading(true)

    // HIBP k-anonymity check — refuse passwords in known breaches
    try {
      const { checkPassword } = await import('@/lib/hibp')
      const hibp = await checkPassword(next)
      if (hibp.pwned) {
        setLoading(false)
        setErr(`Ce mot de passe a été compromis dans ${hibp.count.toLocaleString('fr-FR')} fuites. Choisis-en un autre.`)
        return
      }
    } catch { /* hibp non bloquant */ }

    const sb = createSupabaseBrowser()
    const { error: reauthErr } = await sb.auth.signInWithPassword({ email, password: current })
    if (reauthErr) { setLoading(false); setErr('Mot de passe actuel incorrect.'); return }
    const { error: updErr } = await sb.auth.updateUser({ password: next })
    setLoading(false)
    if (updErr) { setErr(updErr.message || 'Erreur lors de la mise à jour.'); return }
    setOk(true); setCurrent(''); setNext(''); setConfirm('')
  }

  return (
    <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-6 mb-4">
      <div className="font-semibold text-white mb-1">Mot de passe</div>
      <div className="text-sm text-gray-400 mb-4">
        Changez votre mot de passe. Nous demandons l&apos;actuel pour valider l&apos;opération.
      </div>
      {ok && <div className="mb-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-emerald-300 text-sm">✓ Mot de passe mis à jour.</div>}
      {err && <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/25 rounded-lg text-red-400 text-sm">{err}</div>}
      <form onSubmit={submit} className="space-y-3 max-w-md">
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Mot de passe actuel</label>
          <div className="relative">
            <input type={showCurrent ? 'text' : 'password'} value={current} onChange={e => setCurrent(e.target.value)} required autoComplete="current-password"
              className="w-full px-4 py-2.5 pr-10 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white text-sm focus:outline-none focus:border-[#C9A84C]" />
            <EyeToggle open={showCurrent} onClick={() => setShowCurrent(v => !v)} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Nouveau mot de passe</label>
          <div className="relative">
            <input type={showNext ? 'text' : 'password'} value={next} onChange={e => setNext(e.target.value)} required autoComplete="new-password"
              placeholder="Minimum 12 caractères"
              className="w-full px-4 py-2.5 pr-10 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white text-sm focus:outline-none focus:border-[#C9A84C]" />
            <EyeToggle open={showNext} onClick={() => setShowNext(v => !v)} />
          </div>
          {next.length > 0 && next.length < 12 && (
            <div className="text-[10px] text-orange-400 mt-1">Encore {12 - next.length} caractère(s)</div>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Confirmer</label>
          <div className="relative">
            <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password"
              className="w-full px-4 py-2.5 pr-10 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white text-sm focus:outline-none focus:border-[#C9A84C]" />
            <EyeToggle open={showConfirm} onClick={() => setShowConfirm(v => !v)} />
          </div>
          {confirm.length > 0 && confirm !== next && (
            <div className="text-[10px] text-red-400 mt-1">Ne correspond pas</div>
          )}
        </div>
        <div className="flex items-center justify-end">
          <button type="submit" disabled={loading}
            className="px-5 py-2.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors text-sm disabled:opacity-50">
            {loading ? 'Mise à jour…' : 'Changer le mot de passe'}
          </button>
        </div>
      </form>
    </div>
  )
}

function ReferralBlock() {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [data, setData] = useState<{
    code: string | null
    clicks: number
    signups: number
    conversions: number
    bonus_months: number
    recurring_credit_cents: number
  } | null>(null)

  const appUrl = (typeof window !== 'undefined' ? window.location.origin : 'https://feel-the-gap.vercel.app')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/referral/me')
      const j = await res.json()
      setData(j)
    } finally {
      setLoading(false)
    }
  }

  async function generate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/referral/me', { method: 'POST' })
      const j = await res.json()
      if (j.code) await load()
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => { load() }, [])

  const shareUrl = data?.code ? `${appUrl}/go/${data.code}` : ''
  const shareMsg = `Je te recommande Feel The Gap — plateforme de données import/export + business plans IA. ${shareUrl}`

  async function copy() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* noop */ }
  }

  return (
    <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-6 mb-4">
      <div className="flex items-center justify-between mb-1">
        <div className="font-semibold text-white">Parrainage</div>
        {data?.code && (
          <span className="text-[11px] font-bold tracking-wide text-[#C9A84C] bg-[#C9A84C]/10 border border-[#C9A84C]/20 px-2 py-0.5 rounded">
            {data.code}
          </span>
        )}
      </div>
      <div className="text-sm text-gray-400 mb-4">
        Partagez votre lien. Quand un filleul s&apos;abonne, il obtient 1 mois offert et vous gagnez 1 mois gratuit + 20 % récurrents.
      </div>

      {loading ? (
        <div className="h-6 w-40 bg-white/5 rounded animate-pulse" />
      ) : !data?.code ? (
        <button
          onClick={generate}
          disabled={generating}
          className="px-5 py-2.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors text-sm disabled:opacity-50"
        >
          {generating ? 'Génération…' : 'Générer mon code'}
        </button>
      ) : (
        <>
          <div className="flex gap-2 mb-4">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 px-3 py-2 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white text-xs font-mono focus:outline-none"
            />
            <button
              onClick={copy}
              className="px-4 py-2 bg-white/5 border border-white/10 text-white font-medium rounded-xl hover:bg-white/10 transition-colors text-xs"
            >
              {copied ? '✓ Copié' : 'Copier'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareMsg)}`}
              target="_blank" rel="noopener noreferrer"
              className="px-3 py-2 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] text-xs font-semibold rounded-xl hover:bg-[#25D366]/20 transition-colors"
            >
              WhatsApp
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent('Feel The Gap')}&body=${encodeURIComponent(shareMsg)}`}
              className="px-3 py-2 bg-white/5 border border-white/10 text-white text-xs font-semibold rounded-xl hover:bg-white/10 transition-colors"
            >
              Email
            </a>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMsg)}`}
              target="_blank" rel="noopener noreferrer"
              className="px-3 py-2 bg-white/5 border border-white/10 text-white text-xs font-semibold rounded-xl hover:bg-white/10 transition-colors"
            >
              X / Twitter
            </a>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">{data.clicks}</div>
              <div className="text-xs text-gray-500">Clics</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">{data.signups}</div>
              <div className="text-xs text-gray-500">Inscriptions</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-[#C9A84C]">{data.conversions}</div>
              <div className="text-xs text-gray-500">Conversions</div>
            </div>
          </div>

          <div className="bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded-xl px-4 py-3 text-sm">
            <span className="text-gray-400">Crédit cumulé : </span>
            <span className="font-semibold text-[#C9A84C]">{data.bonus_months} mois</span>
            <span className="text-gray-500"> + </span>
            <span className="font-semibold text-[#C9A84C]">{(data.recurring_credit_cents / 100).toFixed(2)} €</span>
            <span className="text-gray-500"> récurrents</span>
          </div>
        </>
      )}
    </div>
  )
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
        <div id="profile" className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-6 mb-4 scroll-mt-20">
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
        <div id="usage" className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-6 mb-4 scroll-mt-20">
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
          <div id="subscription" className="scroll-mt-20"><ManageSubscriptionBtn /></div>
        )}

        {/* Parrainage */}
        <div id="referral" className="scroll-mt-20"><ReferralBlock /></div>

        {/* Biometric setup */}
        <div id="biometric" className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-6 mb-4 scroll-mt-20">
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

        {/* Changer le mot de passe — exige la vérification du mot de passe actuel
            pour éviter qu un attaquant avec un cookie détourné puisse modifier
            le login sans prouver qu il connaît l actuel. */}
        {user?.email && <div id="password" className="scroll-mt-20"><PasswordChangeBlock email={user.email} /></div>}

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
