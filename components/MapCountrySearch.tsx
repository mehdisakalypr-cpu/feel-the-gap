'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/components/LanguageProvider'

export default function MapCountrySearch() {
  const router = useRouter()
  const { lang } = useLang()
  const fr = lang === 'fr'
  const [q, setQ] = useState('')

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = q.trim()
    if (!v) return
    router.push(`/reports?q=${encodeURIComponent(v)}`)
  }

  return (
    <form
      onSubmit={onSubmit}
      className="absolute top-3 left-3 z-[450] w-[220px] md:w-[260px]"
      role="search"
    >
      <svg
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        width="14" height="14" viewBox="0 0 20 20" fill="currentColor"
        aria-hidden="true"
      >
        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
      </svg>
      <input
        type="text"
        placeholder={fr ? 'Rechercher un pays…' : 'Search country…'}
        aria-label={fr ? 'Rechercher un pays' : 'Search country'}
        value={q}
        onChange={e => setQ(e.target.value)}
        className="w-full pl-8 pr-9 h-9 bg-[#0D1117]/95 backdrop-blur border border-[rgba(201,168,76,.25)] rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#C9A84C] shadow-[0_4px_16px_rgba(0,0,0,.35)] transition-colors"
      />
      <button
        type="submit"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md bg-[#C9A84C]/25 text-[#C9A84C] hover:bg-[#C9A84C]/45 transition-colors"
        title="OK"
        aria-label={fr ? 'Lancer la recherche' : 'Submit search'}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </form>
  )
}
