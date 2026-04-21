'use client'
// © 2025-2026 Feel The Gap — B2B/B2C visitor gate overlay.
//
// Shown on first visit to a store that offers both B2B and B2C. User picks
// Professionnel or Particulier, choice is stored in cookie `ftg_store_seg_{slug}`
// for 180 days. Filter of catalog (and prices HT vs TTC) adapts in the rest
// of the site.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  slug: string
  storeName: string
  accent?: string
  defaultOpen?: boolean
}

export function SegmentGate({ slug, storeName, accent = '#C9A84C', defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [saving, setSaving] = useState<'b2c' | 'b2b' | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!defaultOpen) return
    const m = document.cookie.match(new RegExp(`(?:^|; )ftg_store_seg_${slug.replace(/[^a-z0-9-]/gi, '').toLowerCase()}=([^;]+)`))
    if (m && (m[1] === 'b2b' || m[1] === 'b2c')) setOpen(false)
  }, [slug, defaultOpen])

  function pick(seg: 'b2c' | 'b2b') {
    setSaving(seg)
    const cookieKey = `ftg_store_seg_${slug.replace(/[^a-z0-9-]/gi, '').toLowerCase()}`
    const maxAge = 60 * 60 * 24 * 180 // 180 days
    document.cookie = `${cookieKey}=${seg}; Max-Age=${maxAge}; Path=/; SameSite=Lax`
    setOpen(false)
    router.refresh()
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choisir type de visiteur"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#07090F]/92 backdrop-blur-sm px-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0D1117] p-7 shadow-2xl">
        <h2 className="text-xl font-bold text-white text-center">
          Bienvenue chez <span style={{ color: accent }}>{storeName}</span>
        </h2>
        <p className="mt-3 text-sm text-gray-400 text-center leading-relaxed">
          Pour vous proposer les bons produits et prix, dites-nous qui vous êtes :
        </p>

        <div className="mt-6 grid gap-3">
          <button
            type="button"
            onClick={() => pick('b2c')}
            disabled={saving !== null}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-left hover:border-white/30 hover:bg-white/10 transition disabled:opacity-50"
          >
            <span className="text-3xl" aria-hidden>🛒</span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-white">Je suis un particulier</span>
              <span className="block text-xs text-gray-400">Achat pour ma consommation personnelle · prix TTC</span>
            </span>
            {saving === 'b2c' && <span className="text-xs text-gray-500">…</span>}
          </button>

          <button
            type="button"
            onClick={() => pick('b2b')}
            disabled={saving !== null}
            className="flex items-center gap-3 rounded-xl px-5 py-4 text-left text-[#07090F] hover:brightness-110 transition disabled:opacity-50"
            style={{ background: accent }}
          >
            <span className="text-3xl" aria-hidden>🏢</span>
            <span className="flex-1">
              <span className="block text-sm font-bold">Je suis un professionnel</span>
              <span className="block text-xs opacity-80">Achat pour revente ou activité pro · prix HT + gros volumes</span>
            </span>
            {saving === 'b2b' && <span className="text-xs opacity-80">…</span>}
          </button>
        </div>

        <p className="mt-5 text-[11px] text-gray-500 text-center">
          Vous pourrez changer à tout moment en bas de page.
        </p>
      </div>
    </div>
  )
}

/** Small footer toggle for switching segment later. */
export function SegmentSwitch({
  slug,
  current,
  canSwitch,
}: {
  slug: string
  current: 'b2c' | 'b2b'
  canSwitch: boolean
}) {
  const router = useRouter()
  if (!canSwitch) return null
  const next: 'b2c' | 'b2b' = current === 'b2c' ? 'b2b' : 'b2c'
  function pick() {
    const cookieKey = `ftg_store_seg_${slug.replace(/[^a-z0-9-]/gi, '').toLowerCase()}`
    document.cookie = `${cookieKey}=${next}; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax`
    router.refresh()
  }
  return (
    <button
      onClick={pick}
      className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2"
      type="button"
    >
      Vue actuelle : {current === 'b2c' ? 'Particulier' : 'Professionnel'} · basculer en {next === 'b2c' ? 'Particulier' : 'Professionnel'}
    </button>
  )
}
