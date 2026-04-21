// @ts-nocheck
/**
 * content-rock-lee-v2 — curate top 10 YouTube videos pour (product × country).
 *
 * V2 vs V1:
 * - Déduplication : keyed on (product_id, country_iso) au lieu de (opp_id, country_iso, lang)
 * - Sous-titres obligatoires : filtre videoCaption=closedCaption à la search
 * - Multi-langue queries : FR + EN + ES combinés pour maximiser la découverte
 * - Retour langue-agnostique : la traduction des sous-titres est déléguée au player YouTube
 *   côté UI via cc_load_policy=1&cc_lang_pref={userLang}&hl={userLang}
 */
import { searchAndEnrich, type YouTubeVideoDetails } from '@/lib/youtube-api'

function scoreVideo(v: YouTubeVideoDetails): number {
  const viewScore = Math.log10(Math.max(v.viewCount, 1)) * 10
  const likeRatio = v.viewCount ? (v.likeCount / v.viewCount) * 1000 : 0
  const ageDays = (Date.now() - new Date(v.publishedAt).getTime()) / 86_400_000
  const recencyScore = Math.max(0, 50 - ageDays / 30)
  const durationScore = v.durationSeconds >= 240 && v.durationSeconds <= 1200 ? 10 : 0
  const captionsBonus = v.hasCaptions ? 15 : 0
  return viewScore + likeRatio + recencyScore + durationScore + captionsBonus
}

// Templates par langue — 1 query large par langue pour optimiser le quota.
// La query "production/producción/production" couvre cultivation + business
// car YouTube relevance + filtre videoCaption retournent les vidéos utiles.
// Coût par paire: 3 searches × 100 + 1 enrichment = 301 units (vs 901 en v2.0).
const QUERIES_BY_LANG: Record<string, string[]> = {
  fr: ['production {product} {country}'],
  en: ['{product} production {country}'],
  es: ['producción {product} {country}'],
}

export async function generateProductCountryVideos(
  productName: string,
  countryName: string,
  countryIso2?: string,
): Promise<{ payload: unknown; cost_eur: number }> {
  const iso2 = (countryIso2 || '').toUpperCase() || undefined
  const all: YouTubeVideoDetails[] = []
  const seen = new Set<string>()
  const queriesRan: string[] = []

  // Itère FR/EN/ES — chaque langue ajoute potentiellement de nouvelles vidéos uniques.
  // On rend fault-tolerant : si une langue échoue (quota), on garde celles déjà collectées.
  for (const lang of ['fr', 'en', 'es'] as const) {
    for (const tpl of QUERIES_BY_LANG[lang]) {
      const query = tpl.replace('{product}', productName).replace('{country}', countryName)
      queriesRan.push(`[${lang}] ${query}`)
      try {
        const results = await searchAndEnrich({
          query,
          maxResults: 10,  // fetch plus par query pour compenser moins de queries
          order: 'relevance',
          relevanceLanguage: lang,
          regionCode: iso2,
          videoDuration: 'medium',
          videoCaption: 'closedCaption',  // filtre les vidéos sans sous-titres
        })
        for (const v of results) {
          if (!seen.has(v.videoId)) { seen.add(v.videoId); all.push(v) }
        }
      } catch (e: any) {
        const msg = e?.message || ''
        if (/quota|403|not configured/i.test(msg)) {
          console.warn(`[rock-lee-v2] stopping: ${msg.slice(0, 80)}`)
          // Sort de toutes les boucles, on renvoie ce qu'on a
          return finalize(all, queriesRan, productName, countryName)
        }
        console.warn(`[rock-lee-v2] query failed: ${query} — ${msg}`)
      }
    }
  }

  return finalize(all, queriesRan, productName, countryName)
}

function finalize(all: YouTubeVideoDetails[], queriesRan: string[], productName: string, countryName: string) {
  const top = all
    .map((v) => ({ ...v, _score: scoreVideo(v) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 10)

  const payload = {
    product: productName,
    country: countryName,
    videos: top.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      channelTitle: v.channelTitle,
      description: v.description?.slice(0, 500) ?? '',
      publishedAt: v.publishedAt,
      durationSeconds: v.durationSeconds,
      viewCount: v.viewCount,
      likeCount: v.likeCount,
      thumbnailUrl: v.thumbnailUrl,
      hasCaptions: v.hasCaptions,
      defaultLanguage: v.defaultLanguage,
      url: `https://www.youtube.com/watch?v=${v.videoId}`,
    })),
    generated_queries: queriesRan,
    total_searched: all.length,
    generated_at: new Date().toISOString(),
  }
  // YouTube v3 pricing: 9 search calls × 100 units + 1-2 videos.list × 1 unit = ~902 units max
  // Cost is still free tier — we bill cost_eur=0 unless we later move to paid API
  return { payload, cost_eur: 0 }
}
