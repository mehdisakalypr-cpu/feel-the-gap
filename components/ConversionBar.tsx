'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLang } from '@/components/LanguageProvider'
import { STEP_CTAS, trackStep } from '@/lib/funnel'
import { createSupabaseBrowser } from '@/lib/supabase'

/**
 * Sticky conversion bar at the bottom of pages.
 * Shows a contextual CTA based on the current page.
 * Hidden for authenticated users who already have a paid plan.
 * Tracks clicks as funnel events.
 */
export default function ConversionBar() {
  const pathname = usePathname()
  const { lang } = useLang()
  const fr = lang === 'fr'
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isPaid, setIsPaid] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const sb = createSupabaseBrowser()
    sb.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setIsLoggedIn(true)
        const { data: profile } = await sb.from('profiles').select('tier').eq('id', data.user.id).single()
        if (profile && !['free', 'explorer'].includes(profile.tier)) {
          setIsPaid(true)
        }
      }
    })
  }, [])

  // Don't show on auth pages, admin, or for paid users
  if (pathname?.startsWith('/auth') || pathname?.startsWith('/admin') || isPaid || dismissed) return null

  // Find matching CTA for current page
  const pageKey = pathname?.split('/')[1] ?? ''
  const cta = STEP_CTAS[pageKey]
  if (!cta) return null

  function handleClick() {
    trackStep(pageKey, 'cta_click', { target: cta.href })
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-3" style={{ background: 'linear-gradient(transparent, #07090F 30%)' }}>
      <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: '#0D1117', border: `1px solid ${cta.color}40` }}>
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{fr ? cta.textFr : cta.text}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {fr ? 'Gratuit. Sans carte bancaire.' : 'Free. No credit card.'}
          </p>
        </div>
        <Link
          href={isLoggedIn ? '/pricing' : cta.href}
          onClick={handleClick}
          className="px-5 py-2.5 rounded-xl text-sm font-bold transition-colors whitespace-nowrap"
          style={{ background: cta.color, color: '#07090F' }}
        >
          {isLoggedIn ? (fr ? 'Upgrader →' : 'Upgrade →') : (fr ? 'Commencer →' : 'Start free →')}
        </Link>
        <button onClick={() => setDismissed(true)} className="text-gray-600 hover:text-gray-400 p-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
  )
}
