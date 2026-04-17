'use client'

/**
 * JourneyNavFooter — sticky-ish footer navigation on every journey step.
 *
 * - Left button: previous step (step ≥ 2) OR "Retour à la carte" (step 1).
 * - Right button: next step in `sequentialSteps()`. Hidden on the last
 *   mandatory step when no next exists.
 * - The active product (from the Zustand journey store) and the current iso
 *   propagate to `?product=` / `?iso=` on both links so the chips context
 *   stays coherent across every hop.
 */

import Link from 'next/link'
import { useLang } from '@/components/LanguageProvider'
import { useJourneyContext } from '@/lib/journey/context'
import {
  sequentialSteps,
  type JourneyStep,
  type JourneyStepId,
} from '@/lib/journey/steps'

type Props = {
  currentStepId: JourneyStepId
  iso: string
  /** Include the optional `store` step in the sequence. Default: `true`. */
  includeStore?: boolean
  className?: string
}

function withParams(href: string, product: string | null, iso: string | null): string {
  const u = new URL(href, 'https://placeholder.local')
  if (product) u.searchParams.set('product', product)
  if (iso) u.searchParams.set('iso', iso)
  const qs = u.searchParams.toString()
  return qs ? `${u.pathname}?${qs}` : u.pathname
}

function StepLabel({ step, lang }: { step: JourneyStep; lang: 'fr' | 'en' }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden>{step.icon}</span>
      <span>{lang === 'fr' ? step.labelFr : step.labelEn}</span>
    </span>
  )
}

export default function JourneyNavFooter({
  currentStepId,
  iso,
  includeStore = true,
  className,
}: Props) {
  const { lang } = useLang()
  const activeProduct = useJourneyContext((s) => s.activeProduct)

  const all = sequentialSteps().filter((s) => (includeStore ? true : s.id !== 'store'))
  const idx = all.findIndex((s) => s.id === currentStepId)
  if (idx === -1) return null

  const prev = idx > 0 ? all[idx - 1] : null
  const next = idx < all.length - 1 ? all[idx + 1] : null
  const isFirst = idx === 0

  const isoUp = iso?.toUpperCase() ?? null

  const rootClass = [
    'mt-10 pt-6 border-t border-white/5',
    'grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <nav className={rootClass} aria-label={lang === 'fr' ? 'Navigation parcours' : 'Journey navigation'}>
      {/* Left — previous step OR back to map */}
      <div className="flex">
        {isFirst ? (
          <Link
            href="/map"
            className="group w-full sm:w-auto inline-flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
          >
            <span aria-hidden className="text-lg text-gray-400 group-hover:text-white transition-colors">←</span>
            <span className="flex flex-col text-left leading-tight">
              <span className="text-[10px] uppercase tracking-wide text-gray-500">
                {lang === 'fr' ? 'Retour' : 'Back'}
              </span>
              <span className="text-sm font-semibold text-white">
                🗺️ {lang === 'fr' ? 'Carte monde' : 'World map'}
              </span>
            </span>
          </Link>
        ) : prev ? (
          <Link
            href={withParams(prev.href(iso), activeProduct, isoUp)}
            className="group w-full sm:w-auto inline-flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
          >
            <span aria-hidden className="text-lg text-gray-400 group-hover:text-white transition-colors">←</span>
            <span className="flex flex-col text-left leading-tight">
              <span className="text-[10px] uppercase tracking-wide text-gray-500">
                {lang === 'fr' ? 'Étape précédente' : 'Previous step'}
              </span>
              <span className="text-sm font-semibold text-white">
                <StepLabel step={prev} lang={lang as 'fr' | 'en'} />
              </span>
            </span>
          </Link>
        ) : (
          <span />
        )}
      </div>

      {/* Right — next step */}
      <div className="flex sm:justify-end">
        {next ? (
          <Link
            href={withParams(next.href(iso), activeProduct, isoUp)}
            className="group w-full sm:w-auto inline-flex items-center gap-3 px-4 py-3 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#07090F] rounded-xl transition-colors sm:ml-auto"
          >
            <span className="flex flex-col text-left leading-tight">
              <span className="text-[10px] uppercase tracking-wide text-[#07090F]/70 font-semibold">
                {lang === 'fr' ? 'Étape suivante' : 'Next step'}
              </span>
              <span className="text-sm font-bold">
                <StepLabel step={next} lang={lang as 'fr' | 'en'} />
              </span>
            </span>
            <span aria-hidden className="text-lg">→</span>
          </Link>
        ) : (
          <span />
        )}
      </div>
    </nav>
  )
}
