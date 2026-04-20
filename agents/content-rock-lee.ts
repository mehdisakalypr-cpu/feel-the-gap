// @ts-nocheck
/**
 * content-rock-lee — curate top 10 YouTube videos pour (opp × country × lang).
 *
 * Utilise lib/youtube-api.ts (searchAndEnrich). Queries multi-langues + scoring.
 */
import { searchAndEnrich, type YouTubeVideoDetails } from '@/lib/youtube-api'

function scoreVideo(v: YouTubeVideoDetails): number {
  // Composite: views (weighted log), likes ratio, recency, duration sweet spot
  const viewScore = Math.log10(Math.max(v.viewCount, 1)) * 10
  const likeRatio = v.viewCount ? (v.likeCount / v.viewCount) * 1000 : 0
  const ageDays = (Date.now() - new Date(v.publishedAt).getTime()) / 86_400_000
  const recencyScore = Math.max(0, 50 - ageDays / 30) // bonus for < 12 months
  // Sweet spot: 4-20 min (mid-length tuto)
  const durationScore = v.durationSeconds >= 240 && v.durationSeconds <= 1200 ? 10 : 0
  return viewScore + likeRatio + recencyScore + durationScore
}

const QUERY_TEMPLATES_FR = [
  '{product} production {country}',
  '{product} culture {country}',
  'comment produire {product} {country}',
  'business {product} {country}',
  'investissement {product} {country}',
]
const QUERY_TEMPLATES_EN = [
  '{product} production {country}',
  '{product} farming {country}',
  'how to grow {product} {country}',
  '{product} business {country}',
  '{product} investment {country}',
]

export async function generateYoutubeVideos(
  opp: any,
  productName: string,
  countryName: string,
  lang: string = 'fr',
): Promise<{ payload: unknown; cost_eur: number }> {
  const templates = lang === 'en' ? QUERY_TEMPLATES_EN : QUERY_TEMPLATES_FR
  const iso2 = (opp.country_iso2 || '').toUpperCase() || undefined

  const all: YouTubeVideoDetails[] = []
  const seen = new Set<string>()

  for (const tpl of templates) {
    const query = tpl.replace('{product}', productName).replace('{country}', countryName)
    try {
      const results = await searchAndEnrich({
        query,
        maxResults: 5,
        order: 'relevance',
        relevanceLanguage: lang,
        regionCode: iso2,
        videoDuration: 'medium',
      })
      for (const v of results) {
        if (!seen.has(v.videoId)) { seen.add(v.videoId); all.push(v) }
      }
    } catch (e: any) {
      const msg = e?.message || ''
      // quota exhausted or key missing → stop gracefully, return what we have
      if (/quota|403|not configured/i.test(msg)) {
        console.warn(`[rock-lee] stopping: ${msg.slice(0, 80)}`)
        break
      }
      console.warn(`[rock-lee] query failed: ${query} — ${msg}`)
    }
  }

  // Score + top 10
  const top = all
    .map((v) => ({ ...v, _score: scoreVideo(v) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 10)

  const payload = {
    product: productName,
    country: countryName,
    lang,
    total_found: all.length,
    generated_at: new Date().toISOString(),
    videos: top.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      channelTitle: v.channelTitle,
      channelId: v.channelId,
      publishedAt: v.publishedAt,
      durationSeconds: v.durationSeconds,
      viewCount: v.viewCount,
      likeCount: v.likeCount,
      thumbnailUrl: v.thumbnailUrl,
      url: `https://www.youtube.com/watch?v=${v.videoId}`,
      embedUrl: `https://www.youtube.com/embed/${v.videoId}`,
      score: Math.round(v._score),
    })),
  }

  // YouTube API quota cost: 5 queries × (100 search + 5 videos) = ~525 units
  // At ~€0 (free tier, 10K/day), but we budget a tiny amount for tracking
  return { payload, cost_eur: 0.001 }
}
