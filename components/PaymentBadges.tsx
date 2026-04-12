'use client'
/**
 * PaymentBadges (FTG) — client component, reads country from cookie set by proxy.ts.
 * Shows mobile money operators available in the visitor's country so African
 * users know they can pay from their phone.
 */
import { useEffect, useState } from 'react'
import { getMoMoForCountry } from '@/lib/mobile-money-operators'

const OPERATOR_ACCENTS: Record<string, string> = {
  mtn: 'bg-yellow-400 text-black',
  orange: 'bg-orange-500 text-white',
  moov: 'bg-blue-600 text-white',
  wave: 'bg-sky-500 text-white',
  free: 'bg-red-500 text-white',
  airtel: 'bg-red-600 text-white',
  mpesa: 'bg-green-600 text-white',
  tigo: 'bg-blue-500 text-white',
  tmoney: 'bg-emerald-600 text-white',
  flooz: 'bg-indigo-600 text-white',
  opay: 'bg-emerald-500 text-white',
  telecel: 'bg-red-500 text-white',
  airteltigo: 'bg-rose-600 text-white',
}

type Props = {
  country?: string
  variant?: 'pill' | 'inline' | 'card'
  className?: string
  showCountryName?: boolean
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]+)'))
  return m ? decodeURIComponent(m[2]) : undefined
}

export default function PaymentBadges({
  country,
  variant = 'pill',
  className = '',
  showCountryName = true,
}: Props) {
  const [iso, setIso] = useState<string | undefined>(country)
  useEffect(() => {
    if (country) return
    setIso(readCookie('country') ?? 'FR')
  }, [country])

  const info = getMoMoForCountry(iso)
  if (!info || !info.operators.length) return null

  if (variant === 'card') {
    return (
      <div className={`rounded-xl border border-white/10 bg-white/5 p-4 ${className}`}>
        {showCountryName && (
          <div className="text-xs uppercase tracking-widest text-white/60 mb-2">
            Payez depuis {info.name}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {info.operators.map(op => (
            <span
              key={op.code}
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${OPERATOR_ACCENTS[op.code] ?? 'bg-white/10 text-white'}`}
            >
              {op.name}
            </span>
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-2 text-sm text-white/80 ${className}`}>
        {showCountryName && <span className="opacity-70">{info.name}·</span>}
        {info.operators.map(op => op.name).join(' · ')}
      </span>
    )
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {info.operators.map(op => (
        <span
          key={op.code}
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${OPERATOR_ACCENTS[op.code] ?? 'bg-white/10 text-white'}`}
          title={`${op.name} — ${info.name}`}
        >
          {op.name}
        </span>
      ))}
    </div>
  )
}
