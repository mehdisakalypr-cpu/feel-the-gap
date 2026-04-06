'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Topbar() {
  const [search, setSearch] = useState('')

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-[rgba(201,168,76,.15)] bg-[#0D1117] shrink-0 z-50">
      {/* Brand */}
      <Link href="/map" className="flex items-center gap-2.5 select-none">
        <div className="w-7 h-7 rounded-md bg-[#C9A84C] flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8Z" stroke="#07090F" strokeWidth="1.5"/>
            <path d="M8 2c0 0-2 2-2 6s2 6 2 6M8 2c0 0 2 2 2 6s-2 6-2 6M2 8h12" stroke="#07090F" strokeWidth="1.5"/>
          </svg>
        </div>
        <span className="font-semibold tracking-tight text-white text-sm">
          Feel <span className="text-[#C9A84C]">The Gap</span>
        </span>
      </Link>

      {/* Search */}
      <div className="relative w-72">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
        </svg>
        <input
          type="text"
          placeholder="Search country, product…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 h-8 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A84C] transition-colors"
        />
      </div>

      {/* Nav */}
      <nav className="flex items-center gap-1 text-sm">
        <Link href="/reports" className="px-3 py-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/5 transition-colors">
          Reports
        </Link>
        <Link href="/pricing" className="px-3 py-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/5 transition-colors">
          Pricing
        </Link>
        <Link href="/auth/login" className="ml-2 px-4 py-1.5 bg-[#C9A84C] text-[#07090F] font-semibold rounded-lg hover:bg-[#E8C97A] transition-colors text-xs">
          Sign in
        </Link>
      </nav>
    </header>
  )
}
