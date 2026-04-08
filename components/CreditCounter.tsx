'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const LOW_THRESHOLD_CENTS = 100 // €1.00

export default function CreditCounter() {
  const [credits, setCredits] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('ai_credits')
        .eq('id', user.id)
        .single()
      if (data) setCredits(data.ai_credits)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleTopup(amount: number) {
    setLoading(true)
    try {
      const res = await fetch('/api/credits/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      const { url, error } = await res.json()
      if (url) window.location.href = url
      if (error) console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (credits === null) return null

  const euros      = (credits / 100).toFixed(2)
  const isLow      = credits <= LOW_THRESHOLD_CENTS
  const PACKS      = [10, 20, 50, 75, 100]

  return (
    <div className={`rounded-xl border p-4 text-sm ${
      isLow
        ? 'border-orange-500/40 bg-orange-500/5'
        : 'border-white/10 bg-[#0D1117]'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 font-medium">Crédits AI Advisor</span>
        <span className={`font-bold text-base ${isLow ? 'text-orange-400' : 'text-white'}`}>
          {euros} €
        </span>
      </div>

      {isLow && (
        <p className="text-orange-400 text-xs mb-3">
          Solde faible — rechargez pour continuer à utiliser l'AI Advisor.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {PACKS.map(amount => (
          <button
            key={amount}
            onClick={() => handleTopup(amount)}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg border border-[#C9A84C]/30 bg-[#C9A84C]/10 text-[#C9A84C] text-xs font-semibold hover:bg-[#C9A84C]/20 transition-colors disabled:opacity-50">
            +{amount} €
          </button>
        ))}
      </div>
    </div>
  )
}
