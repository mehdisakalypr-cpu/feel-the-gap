'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'aa-promo-dismissed-2026-05-20'

export default function AllAccessPromoBanner() {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === '1')
  }, [])

  if (dismissed) return null

  const close = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="relative z-40 bg-gradient-to-r from-[#FF6B6B] to-[#FFD93D] text-black">
      <div className="mx-auto max-w-6xl px-4 py-2 text-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold">🚀 Lancement 20 mai</span>
          <span className="opacity-90">— All-Access portfolio (50+ SaaS dont les futurs lancés)</span>
          <span className="font-bold">€999/mo verrouillé à vie pour les 200 premiers</span>
          <Link
            href="https://hub.gapup.io/pricing/launch"
            className="ml-1 underline font-medium hover:no-underline"
          >
            Voir l'offre →
          </Link>
        </div>
        <button
          onClick={close}
          aria-label="Dismiss"
          className="ml-2 px-2 text-black/60 hover:text-black"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
