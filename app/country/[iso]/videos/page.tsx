import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import JourneyChipsBar from '@/components/JourneyChipsBar'
import SectionFillLoader from '@/components/SectionFillLoader'
import YoutubeLiteEmbed from '@/components/YoutubeLiteEmbed'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ iso: string }>; searchParams: Promise<{ q?: string; product?: string }> }

type VideoItem = {
  videoId: string
  title: string
  channelTitle: string
  description?: string
  publishedAt?: string
  viewCount?: number
  likeCount?: number
  thumbnailUrl?: string
  hasCaptions?: boolean
  defaultLanguage?: string
}

function formatViews(n?: number): string {
  if (!n) return ''
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M vues`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k vues`
  return `${n} vues`
}

// Country-level aggregate: reads ALL ftg_product_country_videos rows where
// country_iso matches this country, flattens their payloads into one
// deduplicated video list. Replaces the legacy youtube_insights table
// which wasn't keyed on product. New cache is fed by Rock Lee v2.
async function loadCountryVideos(iso: string, productFilter?: string) {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  let query = db
    .from('ftg_product_country_videos')
    .select('product_id, payload, generated_at')
    .eq('country_iso', iso.toUpperCase())
    .eq('status', 'ready')
    .order('generated_at', { ascending: false })
    .limit(60)

  if (productFilter) {
    // Product chip context — match against the product_id slug
    query = query.ilike('product_id', `%${productFilter.replace(/[-_]+/g, '')}%`)
  }

  const { data: rows } = await query
  const seen = new Set<string>()
  const allVideos: Array<VideoItem & { productId: string }> = []
  for (const r of rows ?? []) {
    const videos = ((r.payload as any)?.videos ?? []) as VideoItem[]
    for (const v of videos) {
      if (seen.has(v.videoId)) continue
      seen.add(v.videoId)
      allVideos.push({ ...v, productId: r.product_id as string })
    }
  }
  return allVideos
}

export default async function VideosMarchePage({ params, searchParams }: Props) {
  const { iso } = await params
  const { q, product } = await searchParams

  let videos = await loadCountryVideos(iso, product)
  if (q) {
    const qLow = q.toLowerCase()
    videos = videos.filter((v) => v.title.toLowerCase().includes(qLow))
  }

  // Group by product_id for clearer browsing
  const byProduct = new Map<string, typeof videos>()
  for (const v of videos) {
    const key = v.productId
    if (!byProduct.has(key)) byProduct.set(key, [])
    byProduct.get(key)!.push(v)
  }

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <JourneyChipsBar className="mb-4" />
        <Link href={`/country/${iso}`} className="text-[#C9A84C] text-sm hover:underline mb-4 inline-block">← Fiche pays</Link>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🎬</span>
          <h1 className="text-3xl md:text-4xl font-bold">Vidéos de ce marché — {iso.toUpperCase()}</h1>
        </div>
        <p className="text-gray-400 text-sm mb-8 max-w-2xl">
          Sélection curée par filière : formation export, insights terrain, témoignages entrepreneurs, reportages. Sous-titres traduits automatiquement dans votre langue.
        </p>

        {videos.length === 0 && (
          <SectionFillLoader
            iso={iso}
            section="videos"
            product={product}
            label="Recherche YouTube en cours…"
          />
        )}

        {[...byProduct.entries()].map(([productId, vids]) => (
          <section key={productId} className="mb-10">
            <h2 className="text-lg font-semibold text-[#C9A84C] mb-3 uppercase tracking-wide">
              {productId.replace(/^\d+_/, '').replace(/_/g, ' ')} <span className="text-xs text-gray-500 normal-case">({vids.length})</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {vids.slice(0, 12).map((v) => (
                <YoutubeLiteEmbed
                  key={v.videoId}
                  video={{
                    videoId: v.videoId,
                    title: v.title,
                    channelTitle: v.channelTitle,
                    thumbnailUrl: v.thumbnailUrl ?? '',
                    publishedAt: v.publishedAt,
                    viewCount: v.viewCount,
                    hasCaptions: v.hasCaptions,
                    defaultLanguage: v.defaultLanguage,
                  }}
                  userLang="fr"
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
