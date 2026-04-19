'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase'

export default function FinanceSignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState('')
  const [alreadyActive, setAlreadyActive] = useState(false)
  const [isLogged, setIsLogged] = useState(false)

  useEffect(() => {
    const sb = createSupabaseBrowser()
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setIsLogged(false)
        setLoading(false)
        return
      }
      setIsLogged(true)
      const { data: p } = await sb.from('profiles').select('roles').eq('id', data.user.id).single()
      const roles = (p?.roles ?? []) as string[]
      setAlreadyActive(roles.includes('financeur'))
      setLoading(false)
    })
  }, [])

  async function activate() {
    setActivating(true)
    setError('')
    try {
      const res = await fetch('/api/funding/activate-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'financeur' }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      router.push('/finance/map')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setActivating(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold mb-5"
          style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#34D399' }}>
          🏦 Activer l'accès Financeur
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3">Bienvenue dans le portail Financeurs</h1>
        <p className="text-gray-400 mb-8">
          En activant votre accès Financeur, vous accédez à la carte des marchés, aux rapports
          qualifiés et au deal flow des dossiers de financement. Vous pourrez visualiser les
          dossiers anonymisés gratuitement et souscrire à Finance Premium pour accéder aux
          dossiers complets et au pipeline de suivi des deals.
        </p>

        {loading ? (
          <div className="text-center text-sm text-gray-500">Chargement…</div>
        ) : !isLogged ? (
          <div className="rounded-2xl p-6 mb-6" style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-sm text-gray-300 mb-4">
              Vous devez être connecté pour activer votre accès Financeur. Créez un compte ou
              connectez-vous, puis revenez sur cette page.
            </p>
            <div className="flex gap-3">
              <Link href="/auth/register?redirect=/finance/signup"
                className="px-5 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: 'linear-gradient(135deg,#34D399,#10B981)', color: '#07090F' }}>
                Créer un compte
              </Link>
              <Link href="/auth/login?redirect=/finance/signup"
                className="px-5 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)' }}>
                Se connecter
              </Link>
            </div>
          </div>
        ) : alreadyActive ? (
          <div className="rounded-2xl p-6 mb-6" style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.2)' }}>
            <p className="text-sm text-gray-300 mb-4">
              ✓ Votre accès Financeur est déjà actif. Accédez directement à la carte des marchés.
            </p>
            <Link href="/finance/map"
              className="inline-block px-5 py-2.5 rounded-xl font-bold text-sm"
              style={{ background: 'linear-gradient(135deg,#34D399,#10B981)', color: '#07090F' }}>
              Ouvrir la carte →
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl p-6 mb-6" style={{ background: '#0D1117', border: '1px solid rgba(52,211,153,0.2)' }}>
            <p className="text-sm text-gray-300 mb-4">
              Cliquez ci-dessous pour activer votre accès Financeur. Vous pourrez ensuite basculer
              entre vos rôles depuis la topbar à tout moment.
            </p>
            {error && <div className="text-xs text-red-400 mb-3">⚠️ {error}</div>}
            <button
              onClick={activate}
              disabled={activating}
              className="px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#34D399,#10B981)', color: '#07090F' }}>
              {activating ? 'Activation…' : 'Activer mon accès Financeur →'}
            </button>
          </div>
        )}

        <p className="text-xs text-gray-600 text-center">
          Onboarding gratuit. Pas de carte bancaire requise.
          Finance Premium se débloque depuis votre compte.
        </p>
      </div>
    </div>
  )
}
