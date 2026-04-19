'use client'

/**
 * /country/[iso]/methods — Production 3.0
 *
 * Page comparateur multi-critères des méthodes de production pour un pays donné.
 * MVP café (product_slug='cafe' par défaut) ; architecture prête pour les autres
 * produits dès que le seed sera étendu (tâche #23).
 *
 * Fetch side client (aligné avec le reste du dossier /country/[iso]) :
 *  - production_methods (par product_slug)
 *  - method_metrics (jointure via method_id ∈ methods)
 *  - method_resources (idem)
 *  - method_media (idem)
 *  - profiles.tier pour gating
 */

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import JourneyNavFooter from '@/components/JourneyNavFooter'
import JourneyChipsBar from '@/components/JourneyChipsBar'
import { supabase } from '@/lib/supabase'
import { useJourneyContext } from '@/lib/journey/context'
import MethodsComparator, {
  type Method,
  type Metric,
  type Resource,
  type Media,
} from './MethodsComparator'

// ── Types ──────────────────────────────────────────────────────────────────

type Country = {
  id: string
  name: string
  name_fr: string
  flag: string
}

type AvailableProduct = {
  slug: string
  label: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

const PRODUCT_LABELS: Record<string, string> = {
  cafe: 'Café',
  cacao: 'Cacao',
  textile: 'Textile',
  anacarde: 'Anacarde',
  'huile-palme': 'Huile de palme',
  mangue: 'Mangue',
}

function prettifySlug(slug: string): string {
  return (
    PRODUCT_LABELS[slug] ??
    slug.charAt(0).toUpperCase() + slug.slice(1).replace(/[-_]+/g, ' ')
  )
}

// ── Inner ──────────────────────────────────────────────────────────────────

function MethodsPageInner() {
  const { iso } = useParams<{ iso: string }>()
  const searchParams = useSearchParams()
  const initialSlug = searchParams.get('product') || 'cafe'

  const [country, setCountry] = useState<Country | null>(null)
  // Sync productSlug local avec activeProduct du JourneyContext (chips bar globale)
  const ctxActiveProduct = useJourneyContext((s) => s.activeProduct)
  const [availableProducts, setAvailableProducts] = useState<AvailableProduct[]>([
    { slug: 'cafe', label: 'Café' },
  ])
  const [productSlug, setProductSlug] = useState<string>(initialSlug)

  // Sync : quand l'utilisateur change le chip JourneyChipsBar, le productSlug suit.
  useEffect(() => {
    if (ctxActiveProduct && ctxActiveProduct !== productSlug) {
      setProductSlug(ctxActiveProduct)
    }
  }, [ctxActiveProduct, productSlug])

  const [methods, setMethods] = useState<Method[]>([])
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [media, setMedia] = useState<Media[]>([])

  const [userTier, setUserTier] = useState<string>('free')
  const [loadingCountry, setLoadingCountry] = useState(true)
  const [loadingMethods, setLoadingMethods] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 1) Pays + tier user + catalogue produits disponibles (distinct product_slug).
  useEffect(() => {
    if (!iso) return
    const isoUp = iso.toUpperCase()
    let cancelled = false

    ;(async () => {
      try {
        const [{ data: c }, { data: authData }, { data: slugsRows }] = await Promise.all([
          supabase
            .from('countries')
            .select('id, name, name_fr, flag')
            .eq('id', isoUp)
            .single(),
          supabase.auth.getUser(),
          supabase.from('production_methods').select('product_slug'),
        ])
        if (cancelled) return
        if (c) setCountry(c as Country)

        if (authData?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('tier')
            .eq('id', authData.user.id)
            .single()
          if (!cancelled) setUserTier(profile?.tier ?? 'free')
        }

        const uniqueSlugs = Array.from(
          new Set((slugsRows ?? []).map((r: { product_slug: string }) => r.product_slug))
        ).sort()
        if (!cancelled && uniqueSlugs.length > 0) {
          setAvailableProducts(
            uniqueSlugs.map((s) => ({ slug: s, label: prettifySlug(s) }))
          )
        }
        setLoadingCountry(false)
      } catch {
        if (!cancelled) {
          setError('Erreur de chargement du pays')
          setLoadingCountry(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [iso])

  // 2) Méthodes + ressources + media + metrics pour le produit actif.
  useEffect(() => {
    if (!productSlug) return
    let cancelled = false
    setLoadingMethods(true)
    setError(null)

    ;(async () => {
      try {
        const { data: methodsData, error: methodsErr } = await supabase
          .from('production_methods')
          .select('id, product_slug, name, description_md, popularity_rank')
          .eq('product_slug', productSlug)
          .order('popularity_rank', { ascending: true })

        if (methodsErr) throw methodsErr
        if (cancelled) return

        const loadedMethods = (methodsData ?? []) as Method[]
        const ids = loadedMethods.map((m) => m.id)

        if (ids.length === 0) {
          setMethods([])
          setMetrics([])
          setResources([])
          setMedia([])
          setLoadingMethods(false)
          return
        }

        const [metricsRes, resourcesRes, mediaRes] = await Promise.all([
          supabase
            .from('method_metrics')
            .select('method_id, cost_score, time_months, quality_score, capex_eur, opex_eur_per_unit')
            .in('method_id', ids),
          supabase
            .from('method_resources')
            .select('id, method_id, type, name, est_cost_eur, supplier_hint')
            .in('method_id', ids),
          supabase
            .from('method_media')
            .select('id, method_id, type, url, caption')
            .in('method_id', ids),
        ])

        if (cancelled) return

        setMethods(loadedMethods)
        setMetrics((metricsRes.data ?? []) as Metric[])
        setResources((resourcesRes.data ?? []) as Resource[])
        setMedia((mediaRes.data ?? []) as Media[])
        setLoadingMethods(false)
      } catch (e) {
        if (cancelled) return
        setError(
          e instanceof Error ? e.message : 'Erreur de chargement des méthodes de production'
        )
        setLoadingMethods(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [productSlug])

  const countryLabel = useMemo(() => {
    if (!country) return iso?.toUpperCase() ?? ''
    return country.name_fr || country.name
  }, [country, iso])

  if (loadingCountry) {
    return (
      <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#07090F]">
      <div className="w-full">
        <div className="max-w-6xl mx-auto w-full px-4 py-8 space-y-6">
          <JourneyChipsBar className="mb-2" />
          {/* Header */}
          <div className="flex items-start gap-4 flex-wrap md:flex-nowrap">
            <span className="text-5xl shrink-0">{country?.flag ?? '🏭'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href={`/country/${iso}`}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  ← {countryLabel}
                </Link>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white break-words">
                Méthodes de production — {countryLabel}
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Comparez les méthodes de production pour produire localement en {countryLabel}.
              </p>
            </div>
          </div>

          {/* Product selector retiré — la barre de chips JourneyChipsBar (en haut)
              affiche déjà les opportunités cochées par l'utilisateur via le store
              JourneyContext. Plus besoin de doublon ici. Le productSlug local de
              cette page se synchronise avec activeProduct du store via useEffect
              ci-dessus. */}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Loader méthodes */}
          {loadingMethods ? (
            <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-12 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <MethodsComparator
              iso={iso!}
              productSlug={productSlug}
              methods={methods}
              metrics={metrics}
              resources={resources}
              media={media}
              userTier={userTier}
            />
          )}

          <JourneyNavFooter currentStepId="methods" iso={iso!} />
        </div>
      </div>
    </div>
  )
}

export default function MethodsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <MethodsPageInner />
    </Suspense>
  )
}
