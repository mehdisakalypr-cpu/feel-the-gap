'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Topbar from '@/components/Topbar'
import { createSupabaseBrowser } from '@/lib/supabase'

type Tier = 'free' | 'basic' | 'pro' | 'enterprise'

const TIER_CONFIG: Record<Tier, { label: string; color: string; reports: number }> = {
  free:       { label: 'Explorer',   color: '#6B7280', reports: 1  },
  basic:      { label: 'Analyst',    color: '#60A5FA', reports: 20 },
  pro:        { label: 'Strategist', color: '#C9A84C', reports: -1 },
  enterprise: { label: 'Enterprise', color: '#A78BFA', reports: -1 },
}

export default function AccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ email: string; created_at: string } | null>(null)
  const [tier] = useState<Tier>('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createSupabaseBrowser()
    sb.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/auth/login'); return }
      setUser({ email: data.user.email ?? '', created_at: data.user.created_at })
      setLoading(false)
    })
  }, [router])

  async function handleSignOut() {
    const sb = createSupabaseBrowser()
    await sb.auth.signOut()
    router.push('/map')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const tierCfg = TIER_CONFIG[tier]
  const joined = user ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'

  return (
    <div className="min-h-screen flex flex-col bg-[#07090F]">
      <Topbar />
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
        <h1 className="text-2xl font-bold text-white mb-6">My Account</h1>

        {/* Profile */}
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-[#C9A84C]/20 flex items-center justify-center text-xl font-bold text-[#C9A84C]">
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <div className="font-semibold text-white">{user?.email}</div>
              <div className="text-sm text-gray-500">Member since {joined}</div>
            </div>
            <div className="ml-auto">
              <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: tierCfg.color + '20', color: tierCfg.color }}>
                {tierCfg.label}
              </span>
            </div>
          </div>
        </div>

        {/* Usage */}
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-6 mb-4">
          <h2 className="font-semibold text-white mb-4">This month</h2>
          <div className="flex gap-3">
            <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">0</div>
              <div className="text-xs text-gray-500">Reports</div>
            </div>
            <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">0</div>
              <div className="text-xs text-gray-500">Business plans</div>
            </div>
            <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">0</div>
              <div className="text-xs text-gray-500">Farming scans</div>
            </div>
          </div>
        </div>

        {/* Upgrade CTA */}
        {(tier === 'free' || tier === 'basic') && (
          <div className="bg-gradient-to-r from-[#C9A84C]/10 to-[#E8C97A]/5 border border-[#C9A84C]/30 rounded-2xl p-6 mb-4">
            <div className="font-semibold text-white mb-1">Unlock full access</div>
            <div className="text-sm text-gray-400 mb-4">Unlimited reports, AI business plans, and farming scans.</div>
            <Link href="/pricing" className="inline-block px-5 py-2.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors text-sm">
              View plans →
            </Link>
          </div>
        )}

        {/* Links */}
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl divide-y divide-white/5">
          {[
            { href: '/map',     label: 'Explore world map' },
            { href: '/reports', label: 'Trade reports' },
            { href: '/farming', label: 'Opportunity Farming' },
            { href: '/pricing', label: 'Upgrade plan' },
          ].map(({ href, label }) => (
            <Link key={href} href={href} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors">
              <span className="text-sm text-gray-300">{label}</span>
              <span className="text-gray-500 text-xs">→</span>
            </Link>
          ))}
          <button onClick={handleSignOut} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors text-left">
            <span className="text-sm text-red-400">Sign out</span>
          </button>
        </div>
      </div>
    </div>
  )
}
