import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import JourneyChipsBar from '@/components/JourneyChipsBar'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ iso: string }>; searchParams: Promise<{ q?: string; product?: string }> }

type YoutubeInsight = {
  id: string
  video_id: string
  title: string
  channel_name: string | null
  thumbnail_url: string | null
  published_at: string | null
  view_count: number | null
  relevance_score: number | null
  description: string | null
  country_iso: string | null
  topics: string[] | null
}

function formatViews(n: number | null): string {
  if (!n) return ''
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M vues`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k vues`
  return `${n} vues`
}

export default async function VideosMarchePage({ params, searchParams }: Props) {
  const { iso } = await params
  const { q, product } = await searchParams
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  let query = db
    .from('youtube_insights')
    .select('*')
    .order('relevance_score', { ascending: false, nullsFirst: false })
    .order('view_count', { ascending: false })
    .limit(60)
  // Scope to country when present; falls back to global most-relevant.
  query = query.or(`country_iso.eq.${iso.toUpperCase()},country_iso.is.null`)
  if (q) query = query.ilike('title', `%${q}%`)
  // Product chip context — loose title match (the store holds slug-y values
  // like "cacao" or "arabica-coffee", we strip the dashes for the ilike).
  if (product) {
    const productLike = product.replace(/[-_]+/g, ' ')
    query = query.ilike('title', `%${productLike}%`)
  }
  const { data: rawVideos } = await query
  const videos = (rawVideos ?? []) as YoutubeInsight[]

  // Group by inferred topic for display
  const topics = new Map<string, YoutubeInsight[]>()
  for (const v of videos) {
    const t = v.topics?.[0] ?? 'Général'
    if (!topics.has(t)) topics.set(t, [])
    topics.get(t)!.push(v)
  }

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Chips bar — active product context, scroll-sticky. */}
        <JourneyChipsBar className="mb-4" />
        <Link href={`/country/${iso}`} className="text-[#C9A84C] text-sm hover:underline mb-4 inline-block">← Fiche pays</Link>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🎬</span>
          <h1 className="text-3xl md:text-4xl font-bold">Vidéos de ce marché — {iso.toUpperCase()}</h1>
        </div>
        <p className="text-gray-400 text-sm mb-8 max-w-2xl">
          Sélection curée : formation export, insights terrain, témoignages entrepreneurs, reportages filières. Actualisée en continu par nos agents.
        </p>

        {videos.length === 0 && (
          <div className="p-6 rounded-2xl border border-white/10 bg-white/5 text-center">
            <p className="text-gray-400 text-sm">Pas encore de vidéo indexée pour ce marché.</p>
            <p className="text-xs text-gray-500 mt-2">Nos agents YouTube Intel alimentent la base toutes les 24h.</p>
          </div>
        )}

        {[...topics.entries()].map(([topic, vids]) => (
          <section key={topic} className="mb-10">
            <h2 className="text-lg font-semibold text-[#C9A84C] mb-3 uppercase tracking-wide">{topic}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {vids.map(v => (
                <a
                  key={v.id}
                  href={`https://www.youtube.com/watch?v=${v.video_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-[#C9A84C]/50 transition"
                >
                  {v.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnail_url} alt={v.title} className="w-full aspect-video object-cover" loading="lazy" />
                  )}
                  <div className="p-3">
                    <p className="text-sm font-semibold line-clamp-2 mb-1">{v.title}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                      {v.channel_name && <span>{v.channel_name}</span>}
                      {v.view_count && <span>·</span>}
                      {v.view_count && <span>{formatViews(v.view_count)}</span>}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        ))}

        <div className="mt-10 p-5 rounded-2xl border border-[#C9A84C]/30 bg-[#C9A84C]/5">
          <p className="text-sm text-[#C9A84C] font-semibold mb-1">Next step</p>
          <p className="text-sm text-gray-300">
            Vous sentez l'opportunité ? <Link href={`/country/${iso}/enriched-plan`} className="text-[#C9A84C] underline">Générez votre business plan chiffré →</Link> puis{' '}
            <Link href={`/country/${iso}/store`} className="text-[#C9A84C] underline">lancez votre boutique en 5 min</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
