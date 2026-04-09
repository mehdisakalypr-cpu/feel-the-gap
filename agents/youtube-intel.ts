// @ts-nocheck
/**
 * Feel The Gap — YouTube Intelligence Agent
 *
 * Pour chaque (pays, produit), cherche sur YouTube les videos les plus pertinentes
 * sur l'import/export, la production locale, la reglementation et les astuces
 * d'entrepreneurs. Extrait les transcripts, applique Gemini pour structurer,
 * et stocke dans `youtube_insights`.
 *
 * Usage:
 *   npx tsx agents/youtube-intel.ts                          # tous les pays prioritaires
 *   npx tsx agents/youtube-intel.ts --iso CIV,GHA            # pays specifiques
 *   npx tsx agents/youtube-intel.ts --product cacao          # produit specifique
 *   npx tsx agents/youtube-intel.ts --iso CIV --product cacao --max 20
 *   npx tsx agents/youtube-intel.ts --dry-run                # no DB writes
 */

import { supabaseAdmin } from '@/lib/supabase';
import { searchAndEnrich, getQuotaUsed } from '@/lib/youtube-api';
import {
  extractInsightsFromYouTubeUrl,
  extractInsightsFromText,
  scoreRelevance,
} from '@/lib/insight-extractor';

// ─── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}
const argIso = getArg('--iso')?.split(',');
const argProduct = getArg('--product');
const argMaxPerQuery = Number(getArg('--max') ?? 10);
const dryRun = args.includes('--dry-run');

// ─── Config ────────────────────────────────────────────────────────────────
const PILOT_COUNTRIES = ['CIV', 'SEN', 'MAR', 'VNM', 'COL', 'GIN']; // pays pilotes
const PILOT_PRODUCTS = [
  { slug: 'cacao', fr: 'cacao', en: 'cocoa' },
  { slug: 'cafe', fr: 'cafe', en: 'coffee' },
  { slug: 'textile', fr: 'textile', en: 'textile' },
  { slug: 'anacarde', fr: 'anacarde noix cajou', en: 'cashew' },
  { slug: 'huile_palme', fr: 'huile de palme', en: 'palm oil' },
  { slug: 'mangue', fr: 'mangue', en: 'mango' },
];

// Requete templates (priorise 2024+)
function buildQueries(countryIso: string, countryName: string, product: { fr: string; en: string }): string[] {
  return [
    `import export ${product.fr} ${countryName}`,
    `business ${product.fr} ${countryName}`,
    `comment exporter ${product.fr} ${countryName}`,
    `${countryName} douane taxe ${product.fr}`,
    `${product.en} business ${countryName}`,
    `start ${product.en} export ${countryName}`,
    `${product.en} production ${countryName}`,
  ];
}

// Filtre fraicheur: videos publiees apres cette date (3 ans)
const PUBLISHED_AFTER = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString();

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const admin = supabaseAdmin();

  // Resolution des pays cibles
  const isoList = argIso ?? PILOT_COUNTRIES;
  const { data: countries, error: countryErr } = await admin
    .from('countries')
    .select('id, name, name_fr')
    .in('id', isoList);

  if (countryErr || !countries?.length) {
    console.error('[youtube-intel] Unable to fetch countries:', countryErr?.message);
    process.exit(1);
  }

  // Produits cibles
  const products = argProduct
    ? PILOT_PRODUCTS.filter((p) => p.slug === argProduct)
    : PILOT_PRODUCTS;

  if (products.length === 0) {
    console.error(`[youtube-intel] Unknown product: ${argProduct}`);
    process.exit(1);
  }

  console.log(`[youtube-intel] ${countries.length} countries x ${products.length} products`);
  console.log(`[youtube-intel] Dry run: ${dryRun}`);

  // Log du run
  const { data: runRow } = dryRun
    ? { data: null }
    : await admin
        .from('research_runs')
        .insert({
          agent: 'youtube-intel',
          country_iso: isoList.join(','),
          product: argProduct ?? 'all',
          status: 'running',
          stats: { countries: countries.length, products: products.length },
        })
        .select()
        .single();

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const country of countries) {
    for (const product of products) {
      console.log(`\n━━━ ${country.id} / ${product.slug} ━━━`);
      const queries = buildQueries(country.id, country.name_fr ?? country.name, product);

      for (const query of queries) {
        try {
          console.log(`  🔍 "${query}"`);
          const videos = await searchAndEnrich({
            query,
            maxResults: argMaxPerQuery,
            order: 'relevance',
            publishedAfter: PUBLISHED_AFTER,
            videoCaption: 'closedCaption',
          });

          // Filtre: >1000 vues et >5min
          const filtered = videos.filter((v) => v.viewCount > 1000 && v.durationSeconds > 300);
          console.log(`    found=${videos.length} kept=${filtered.length}`);

          if (filtered.length === 0) continue;

          // Check dedup: skip video IDs already processed
          const videoIds = filtered.map((v) => v.videoId);
          const { data: existing } = await admin
            .from('youtube_insights')
            .select('video_id')
            .in('video_id', videoIds);
          const existingIds = new Set((existing ?? []).map((e) => e.video_id));
          const newVideos = filtered.filter((v) => !existingIds.has(v.videoId));
          totalSkipped += videoIds.length - newVideos.length;

          if (newVideos.length === 0) {
            console.log('    all duplicates, skip');
            continue;
          }

          // Extract insights for each video — text mode only (fast + reliable).
          // Native Gemini video analysis is too slow and times out often.
          // Set USE_VIDEO_MODE=1 to opt back in.
          const useVideoMode = process.env.USE_VIDEO_MODE === '1';
          for (const video of newVideos) {
            const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;

            let insights = null;
            if (useVideoMode) {
              insights = await extractInsightsFromYouTubeUrl({
                videoUrl,
                countryHint: country.id,
                productHint: product.fr,
              });
            }

            if (!insights) {
              insights = await extractInsightsFromText({
                text: `${video.title}\n\n${video.description}`,
                title: video.title,
                description: video.description,
                countryHint: country.id,
                productHint: product.fr,
              });
            }

            if (!insights) {
              totalErrors++;
              continue;
            }

            const row = {
              video_id: video.videoId,
              channel_id: video.channelId,
              channel_name: video.channelTitle,
              title: video.title,
              description: video.description,
              thumbnail_url: video.thumbnailUrl,
              published_at: video.publishedAt,
              duration_seconds: video.durationSeconds,
              view_count: video.viewCount,
              like_count: video.likeCount,
              comment_count: video.commentCount,
              country_iso: country.id,
              product_category: product.slug,
              topic: insights.topic,
              language: video.defaultLanguage ?? video.defaultAudioLanguage ?? null,
              extracted_insights: insights,
              relevance_score: scoreRelevance({
                title: video.title,
                description: video.description,
                viewCount: video.viewCount,
                publishedAt: video.publishedAt,
                targetCountry: country.id,
                targetProduct: product.fr,
              }),
              freshness_score: Math.max(
                0,
                1 - (Date.now() - new Date(video.publishedAt).getTime()) / (3 * 365 * 24 * 60 * 60 * 1000),
              ),
              search_query: query,
              processed_at: new Date().toISOString(),
            };

            if (dryRun) {
              console.log(
                `    ✓ [dry] ${video.videoId} topic=${insights.topic} tips=${insights.tips.length} prices=${insights.prices.length}`,
              );
            } else {
              const { error } = await admin
                .from('youtube_insights')
                .upsert(row, { onConflict: 'video_id' });
              if (error) {
                console.warn(`    ✗ ${video.videoId}: ${error.message}`);
                totalErrors++;
              } else {
                totalInserted++;
                console.log(
                  `    ✓ ${video.videoId} topic=${insights.topic} tips=${insights.tips.length}`,
                );
              }
            }
          }
        } catch (err) {
          console.error(`    ✗ query failed: ${(err as Error).message}`);
          totalErrors++;
          // On quota exceeded, abort
          if ((err as Error).message.includes('Quota exceeded')) {
            console.error('[youtube-intel] YouTube quota exceeded — aborting');
            break;
          }
        }
      }
    }
  }

  const stats = {
    inserted: totalInserted,
    skipped: totalSkipped,
    errors: totalErrors,
    quota_used: getQuotaUsed(),
  };
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[youtube-intel] Done: ${JSON.stringify(stats)}`);

  if (!dryRun && runRow?.id) {
    await admin
      .from('research_runs')
      .update({
        status: totalErrors > 0 ? 'partial' : 'success',
        stats,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runRow.id);
  }
}

main().catch((err) => {
  console.error('[youtube-intel] Fatal:', err);
  process.exit(1);
});
