'use client'

import Link from 'next/link'
import Topbar from '@/components/Topbar'

const MOCK = {
  name: 'Guest User',
  email: 'guest@example.com',
  tier: 'free' as 'free' | 'basic' | 'pro' | 'enterprise',
  reports_used: 1,
  reports_limit: 1,
  joined: 'April 2026',
}

const TIER_CONFIG = {
  free:       { label: 'Explorer',   color: '#6B7280', reports: 1  },
  basic:      { label: 'Analyst',    color: '#60A5FA', reports: 20 },
  pro:        { label: 'Strategist', color: '#C9A84C', reports: -1 },
  enterprise: { label: 'Enterprise', color: '#A78BFA', reports: -1 },
}

export default function AccountPage() {
  const tier = TIER_CONFIG[MOCK.tier]
  const usagePct = tier.reports > 0 ? Math.round((MOCK.reports_used / tier.reports) * 100) : 0

  return (
    <div className="min-h-screen flex flex-col bg-[#07090F]">
      <Topbar />

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
        <h1 className="text-2xl font-bold text-white mb-6">My Account</h1>

        {/* Profile card */}
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-[#C9A84C]/20 flex items-center justify-center text-xl font-bold text-[#C9A84C]">
              {MOCK.name[0]}
            </div>
            <div>
              <div className="font-semibold text-white">{MOCK.name}</div>
              <div className="text-sm text-gray-400">{MOCK.email}</div>
            </div>
            <div className="ml-auto">
              <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: tier.color + '20', color: tier.color }}>
                {tier.label}
              </span>
            </div>
          </div>
          <div className="text-xs text-gray-600">Member since {MOCK.joined}</div>
        </div>

        {/* Usage */}
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-6 mb-4">
          <h2 className="font-semibold text-white mb-4">This month</h2>
          <div className="mb-3">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-400">Country reports</span>
              <span className="text-white">
                {MOCK.reports_used} / {tier.reports > 0 ? tier.reports : '∞'}
              </span>
            </div>
            {tier.reports > 0 && (
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${usagePct}%`, background: usagePct >= 90 ? '#F87171' : '#C9A84C' }}
                />
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">0</div>
              <div className="text-xs text-gray-500">Business plans</div>
            </div>
            <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">0</div>
              <div className="text-xs text-gray-500">Farming scans</div>
            </div>
            <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-[#C9A84C]">Free</div>
              <div className="text-xs text-gray-500">Current plan</div>
            </div>
          </div>
        </div>

        {/* Upgrade CTA — only for free/basic */}
        {MOCK.tier !== 'pro' && MOCK.tier !== 'enterprise' && (
          <div className="bg-gradient-to-r from-[#C9A84C]/10 to-[#E8C97A]/5 border border-[#C9A84C]/30 rounded-2xl p-6 mb-4">
            <div className="font-semibold text-white mb-1">Unlock full access</div>
            <div className="text-sm text-gray-400 mb-4">
              Get unlimited reports, AI business plans, and opportunity farming scans.
            </div>
            <Link href="/pricing" className="inline-block px-5 py-2.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors text-sm">
              View plans →
            </Link>
          </div>
        )}

        {/* Actions */}
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl divide-y divide-white/5">
          <Link href="/map" className="flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors">
            <span className="text-sm text-gray-300">Explore world map</span>
            <span className="text-gray-500 text-xs">→</span>
          </Link>
          <Link href="/reports" className="flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors">
            <span className="text-sm text-gray-300">My reports</span>
            <span className="text-gray-500 text-xs">→</span>
          </Link>
          <Link href="/farming" className="flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors">
            <span className="text-sm text-gray-300">Opportunity Farming</span>
            <span className="text-gray-500 text-xs">→</span>
          </Link>
          <button className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors text-left">
            <span className="text-sm text-red-400">Sign out</span>
          </button>
        </div>
      </div>
    </div>
  )
}
