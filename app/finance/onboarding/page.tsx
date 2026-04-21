'use client'

import InvestorProfileForm from '@/components/InvestorProfileForm'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase'

export default function FinanceOnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [logged, setLogged] = useState(false)
  const [hasRole, setHasRole] = useState(false)
  const [activating, setActivating] = useState(false)

  useEffect(() => {
    const sb = createSupabaseBrowser()
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setLoading(false); return }
      setLogged(true)
      const { data: p } = await sb.from('profiles').select('roles').eq('id', data.user.id).single()
      const roles = (p?.roles ?? []) as string[]
      setHasRole(roles.includes('financeur'))
      setLoading(false)
    })
  }, [])

  async function activate() {
    setActivating(true)
    try {
      const res = await fetch('/api/funding/activate-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'financeur' }),
      })
      if (res.ok) setHasRole(true)
    } finally {
      setActivating(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-[#07090F] text-gray-500 p-12 text-center">Chargement…</div>

  if (!logged) {
    return (
      <div className="min-h-screen bg-[#07090F] text-white p-12 text-center">
        <p className="text-gray-400 mb-4">Connectez-vous pour configurer votre profil financeur.</p>
        <Link href="/auth/login?redirect=/finance/onboarding"
          className="inline-block px-5 py-2.5 rounded-xl font-bold text-sm"
          style={{ background: 'linear-gradient(135deg,#34D399,#10B981)', color: '#07090F' }}>
          Se connecter
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-xs text-gray-500 mb-4">
          <Link href="/finance" className="hover:text-gray-300">← Retour au portail financeurs</Link>
        </div>

        <div className="mb-8">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold mb-4"
            style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#34D399' }}>
            🏦 Configuration Financeur
          </span>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Votre thèse de financement</h1>
          <p className="text-gray-400 text-sm max-w-xl">
            Ces critères permettent au matching engine de vous remonter les dossiers pertinents. Vous pouvez les ajuster à tout moment.
          </p>
        </div>

        {!hasRole ? (
          <div className="rounded-2xl p-6 mb-6"
            style={{ background: '#0D1117', border: '1px solid rgba(52,211,153,0.25)' }}>
            <p className="text-sm text-white mb-3">Pour accéder au catalogue, activez d'abord le rôle <strong>Financeur</strong> sur votre compte.</p>
            <button onClick={activate} disabled={activating}
              className="px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#34D399,#10B981)', color: '#07090F' }}>
              {activating ? 'Activation…' : 'Activer le rôle Financeur'}
            </button>
          </div>
        ) : (
          <div className="rounded-3xl p-6"
            style={{ background: '#0D1117', border: '1px solid rgba(52,211,153,0.15)' }}>
            <InvestorProfileForm role="financeur" accentColor="#34D399"
              onSaved={() => setTimeout(() => router.push('/finance/reports'), 800)} />
          </div>
        )}
      </div>
    </div>
  )
}
