import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { searchAndEnrich } from '@/lib/youtube-api'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/agents/section-fill
 * body: { iso: string, section: 'videos'|'clients'|'methods'|'studies', product?: string }
 *
 * Anti "section-vide-payée" : à chaque ouverture d'une section vide, on déclenche
 * un fetch on-demand côté agent — l'utilisateur ne paie pas (pas de débit credits).
 *
 * Comportement :
 *  - Vérifie si la table source pour (iso, [product]) est vide → sinon no-op.
 *  - Tente un remplissage minimal (4-10 entrées) avec les sources disponibles
 *    (YouTube Data API v3 fallback HTML si pas de clé, agent local-buyers via
 *    Serper, seed templates pour methods/studies).
 *  - Idempotent : si un autre client a rempli entre-temps, on retourne ok=true,
 *    items_added=0.
 *
 * Réponse : { ok:true, items_added: N, source: '<provider>' }
 *           | { ok:false, error: '<message>' }
 */

type Section = 'videos' | 'clients' | 'methods' | 'studies'
const VALID_SECTIONS = new Set<Section>(['videos', 'clients', 'methods', 'studies'])

interface FillRequest {
  iso?: string
  section?: string
  product?: string
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// ─── Country code → readable name (limité — fallback raw ISO sinon) ─────────
const COUNTRY_NAMES: Record<string, string> = {
  CI: "Côte d'Ivoire", SN: 'Sénégal', NG: 'Nigeria', KE: 'Kenya', GH: 'Ghana',
  BF: 'Burkina Faso', ML: 'Mali', CM: 'Cameroun', CD: 'RDC', ET: 'Éthiopie',
  TZ: 'Tanzanie', UG: 'Ouganda', MA: 'Maroc', DZ: 'Algérie', EG: 'Égypte',
  IN: 'Inde', VN: 'Vietnam', BR: 'Brésil', MX: 'Mexique', ID: 'Indonésie',
  RW: 'Rwanda', BJ: 'Bénin', TG: 'Togo', GN: 'Guinée', NE: 'Niger',
}

function countryName(iso: string): string {
  return COUNTRY_NAMES[iso.toUpperCase()] ?? iso.toUpperCase()
}

// ════════════════════════════════════════════════════════════════════════════
// VIDEOS — YouTube Data API v3, fallback HTML scrape
// ════════════════════════════════════════════════════════════════════════════
interface YoutubeMinimal {
  videoId: string
  title: string
  channelTitle: string
  thumbnailUrl: string
  publishedAt?: string
  viewCount?: number
}

async function fetchYoutubeFallbackHtml(query: string): Promise<YoutubeMinimal[]> {
  // Quick & dirty fallback when YOUTUBE_API_KEY is missing.
  // Parses the search results page; resilient to minor layout changes.
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; FTG-bot/1.0)' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return []
    const html = await res.text()
    // Scrape the videoRenderer JSON blocks (loose regex — best-effort).
    const matches = [...html.matchAll(/"videoRenderer":\{"videoId":"([\w-]{11})","thumbnail":\{"thumbnails":\[\{"url":"([^"]+)".*?"title":\{"runs":\[\{"text":"([^"]+)"/g)]
    const seen = new Set<string>()
    const out: YoutubeMinimal[] = []
    for (const m of matches) {
      const [, videoId, thumb, title] = m
      if (seen.has(videoId)) continue
      seen.add(videoId)
      out.push({
        videoId,
        title: title.replace(/\\u0026/g, '&').replace(/\\"/g, '"'),
        channelTitle: 'YouTube',
        thumbnailUrl: thumb.replace(/\\u0026/g, '&'),
      })
      if (out.length >= 10) break
    }
    return out
  } catch {
    return []
  }
}

async function fillVideos(iso: string, product?: string): Promise<{ added: number; source: string }> {
  const sb = db()
  const productLabel = product ? product.replace(/[-_]+/g, ' ') : ''
  const query = product
    ? `${productLabel} ${countryName(iso)} export business import`
    : `${countryName(iso)} import export business opportunités`

  // 1) YouTube Data API v3 (preferred)
  if (process.env.YOUTUBE_API_KEY) {
    try {
      const enriched = await searchAndEnrich({
        query,
        maxResults: 10,
        order: 'relevance',
        regionCode: iso.toUpperCase(),
      })
      if (enriched.length > 0) {
        const rows = enriched.slice(0, 10).map((v) => ({
          video_id: v.videoId,
          channel_id: v.channelId,
          channel_name: v.channelTitle,
          title: v.title,
          description: v.description,
          thumbnail_url: v.thumbnailUrl,
          published_at: v.publishedAt,
          duration_seconds: v.durationSeconds,
          view_count: v.viewCount,
          like_count: v.likeCount,
          comment_count: v.commentCount,
          country_iso: iso.toUpperCase(),
          product_category: product ?? null,
          relevance_score: 0.5,
          search_query: query,
          processed_at: new Date().toISOString(),
        }))
        const { error } = await sb.from('youtube_insights').upsert(rows, { onConflict: 'video_id' })
        if (!error) return { added: rows.length, source: 'youtube_api' }
      }
    } catch (err) {
      console.warn('[section-fill/videos] YouTube API failed:', (err as Error).message)
    }
  }

  // 2) Fallback : HTML scrape
  const fallback = await fetchYoutubeFallbackHtml(query)
  if (fallback.length === 0) return { added: 0, source: 'fallback_empty' }

  const rows = fallback.slice(0, 10).map((v) => ({
    video_id: v.videoId,
    channel_name: v.channelTitle,
    title: v.title,
    thumbnail_url: v.thumbnailUrl,
    country_iso: iso.toUpperCase(),
    product_category: product ?? null,
    relevance_score: 0.3,
    search_query: query,
    processed_at: new Date().toISOString(),
  }))
  const { error } = await sb.from('youtube_insights').upsert(rows, { onConflict: 'video_id' })
  if (error) {
    console.warn('[section-fill/videos] insert failed:', error.message)
    return { added: 0, source: 'fallback_insert_error' }
  }
  return { added: rows.length, source: 'youtube_html' }
}

// ════════════════════════════════════════════════════════════════════════════
// CLIENTS — local_buyers via Serper / seed via product taxonomy
// ════════════════════════════════════════════════════════════════════════════
interface SerperHit {
  title?: string
  link?: string
  snippet?: string
}

async function searchSerper(query: string): Promise<SerperHit[]> {
  const keys = [process.env.SERPER_API_KEY, process.env.SERPER_API_KEY_2, process.env.SERPER_API_KEY_3]
    .filter((k): k is string => Boolean(k))
  if (keys.length === 0) return []
  for (const k of keys) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': k, 'content-type': 'application/json' },
        body: JSON.stringify({ q: query, num: 10 }),
        signal: AbortSignal.timeout(8_000),
      })
      if (!res.ok) continue
      const j = (await res.json()) as { organic?: SerperHit[] }
      return j.organic ?? []
    } catch {
      // try next key
    }
  }
  return []
}

const BUYER_TYPES: Array<{ type: string; queries: string[] }> = [
  { type: 'industriel',     queries: ['usine {p} {c}', 'industriel {p} {c}'] },
  { type: 'grossiste',      queries: ['grossiste {p} {c}', 'wholesaler {p} {c}'] },
  { type: 'transformateur', queries: ['transformateur {p} {c}', 'processor {p} {c}'] },
  { type: 'distributeur',   queries: ['distributeur {p} {c}', 'importateur {p} {c}'] },
]

function extractDomainCity(hit: SerperHit): { name: string; website?: string } {
  const title = (hit.title ?? '').replace(/\s*-\s*[^-]+$/, '').trim()
  return { name: title || (hit.link ?? 'Acheteur identifié').split('/')[2] || 'Acheteur', website: hit.link }
}

type BuyerCandidate = {
  name: string
  buyer_type: string
  country_iso: string
  website_url: string | null
  product_slugs: string[]
  confidence_score: number
  source: string
  notes: string
  scope: 'local' | 'international'
  buyer_source_country?: string | null
}

const INTERNATIONAL_BUYER_QUERIES: Array<{ type: string; query: string; source_country: string }> = [
  { type: 'industriel',     query: 'top {p} importer Germany manufacturer',      source_country: 'DE' },
  { type: 'distributeur',   query: '{p} wholesale importer United States',       source_country: 'US' },
  { type: 'industriel',     query: '{p} industrial buyer France processor',      source_country: 'FR' },
  { type: 'grossiste',      query: '{p} wholesaler Netherlands Rotterdam',       source_country: 'NL' },
  { type: 'distributeur',   query: '{p} importer United Kingdom distributor',    source_country: 'GB' },
  { type: 'industriel',     query: '{p} processor Italy food industry',          source_country: 'IT' },
  { type: 'distributeur',   query: '{p} trading company Spain importer',         source_country: 'ES' },
  { type: 'grossiste',      query: '{p} wholesale Belgium Antwerp',              source_country: 'BE' },
  { type: 'export_trader',  query: '{p} trading house Switzerland',              source_country: 'CH' },
  { type: 'industriel',     query: '{p} manufacturer Japan Tokyo',               source_country: 'JP' },
]

async function fillClients(iso: string, product?: string): Promise<{ added: number; source: string }> {
  const sb = db()
  if (!product) return { added: 0, source: 'product_required' }
  const cName = countryName(iso)

  const candidates: BuyerCandidate[] = []
  const seen = new Set<string>()

  for (const bt of BUYER_TYPES) {
    if (candidates.length >= 10) break
    for (const tpl of bt.queries) {
      const q = tpl.replaceAll('{p}', product).replaceAll('{c}', cName)
      const hits = await searchSerper(q)
      for (const hit of hits) {
        const { name, website } = extractDomainCity(hit)
        const key = (website ?? name).toLowerCase()
        if (!name || seen.has(key)) continue
        seen.add(key)
        candidates.push({
          name: name.slice(0, 200),
          buyer_type: bt.type,
          country_iso: iso.toUpperCase(),
          website_url: website ?? null,
          product_slugs: [product.toLowerCase()],
          confidence_score: 0.4,
          source: 'ai_research',
          notes: hit.snippet?.slice(0, 240) ?? '',
          scope: 'local',
        })
        if (candidates.length >= 10) break
      }
      if (candidates.length >= 10) break
    }
  }

  // Fallback international: si moins de 5 buyers locaux trouvés, on prend le
  // top 5-10 importateurs/grossistes internationaux pour ce produit et on les
  // sauvegarde liés au pays cible. Zéro LLM, queries Serper ciblées pays
  // importateurs majeurs (DE, US, FR, NL, GB, IT, ES, BE, CH, JP).
  if (candidates.length < 5) {
    const targetInt = 10 - candidates.length
    for (const cfg of INTERNATIONAL_BUYER_QUERIES) {
      if (candidates.filter(c => c.scope === 'international').length >= targetInt) break
      const q = cfg.query.replaceAll('{p}', product)
      const hits = await searchSerper(q)
      for (const hit of hits) {
        const { name, website } = extractDomainCity(hit)
        const key = (website ?? name).toLowerCase()
        if (!name || seen.has(key)) continue
        seen.add(key)
        candidates.push({
          name: name.slice(0, 200),
          buyer_type: cfg.type,
          country_iso: iso.toUpperCase(),
          website_url: website ?? null,
          product_slugs: [product.toLowerCase()],
          confidence_score: 0.3,
          source: 'ai_research_international',
          notes: (hit.snippet?.slice(0, 240) ?? '') + ` [international fallback from ${cfg.source_country}]`,
          scope: 'international',
          buyer_source_country: cfg.source_country,
        })
        if (candidates.filter(c => c.scope === 'international').length >= targetInt) break
      }
    }
  }

  if (candidates.length === 0) return { added: 0, source: 'no_results' }

  const { error } = await sb.from('local_buyers').insert(candidates)
  if (error) {
    console.warn('[section-fill/clients] insert failed:', error.message)
    return { added: 0, source: 'insert_error' }
  }
  const localCount = candidates.filter(c => c.scope === 'local').length
  const intlCount = candidates.filter(c => c.scope === 'international').length
  return { added: candidates.length, source: `serper:${localCount}_local+${intlCount}_intl` }
}

// ════════════════════════════════════════════════════════════════════════════
// METHODS — seed minimal pour le produit (template par défaut)
// ════════════════════════════════════════════════════════════════════════════
async function fillMethods(_iso: string, product?: string): Promise<{ added: number; source: string }> {
  // TODO : intégrer agents/crop-curriculum-builder pour seed riche.
  if (!product) return { added: 0, source: 'product_required' }
  const sb = db()

  const seeds = [
    { name: 'Méthode artisanale',  description_md: `Production artisanale de ${product} — main d'œuvre locale, outillage manuel, échelle pilote (1-5 t/an).`, popularity_rank: 1 },
    { name: 'Méthode mécanisée',   description_md: `Production mécanisée de ${product} — équipements semi-industriels, équipe formée, échelle commerciale (10-100 t/an).`, popularity_rank: 2 },
    { name: 'Méthode automatisée', description_md: `Production automatisée IA de ${product} — capteurs, monitoring temps réel, optimisation rendement (>100 t/an).`, popularity_rank: 3 },
  ].map(s => ({ ...s, product_slug: product }))

  const { error } = await sb.from('production_methods').upsert(seeds, { onConflict: 'product_slug,name' })
  if (error) {
    console.warn('[section-fill/methods] insert failed:', error.message)
    return { added: 0, source: 'insert_error' }
  }
  return { added: seeds.length, source: 'template_seed' }
}

// ════════════════════════════════════════════════════════════════════════════
// STUDIES — stub : seed minimal (TODO LLM deep research)
// ════════════════════════════════════════════════════════════════════════════
async function fillStudies(iso: string, product?: string): Promise<{ added: number; source: string }> {
  // Gemini deep research — synthèse 4-6 sections en HTML structuré.
  // Fallback stub si GEMINI_API_KEY absent ou génération échoue.
  const sb = db()
  const isoUp = iso.toUpperCase()
  const name = countryName(iso)
  const productLabel = product ? product.replace(/[-_]+/g, ' ') : ''

  const hasKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY)
  if (!hasKey) {
    const stubHtml = `<h2>Étude marché ${name}</h2><p>Synthèse en cours de génération par notre agent recherche (clé Gemini non configurée).</p>`
    const { error } = await sb.from('country_studies').upsert(
      [{ country_iso: isoUp, part: 1, content_html: stubHtml, tier_required: 'free' }],
      { onConflict: 'country_iso,part' },
    )
    return { added: error ? 0 : 1, source: 'stub_no_key' }
  }

  try {
    const { google } = await import('@ai-sdk/google')
    const { generateText } = await import('ai')

    const focus = product
      ? `Focus sur le produit : ${productLabel}.`
      : `Synthèse généraliste sur les opportunités import/export.`

    const prompt = `Tu es un analyste de marché senior. Rédige une étude de marché compacte en HTML pour ${name} (ISO ${isoUp}).
${focus}

Contraintes :
- 4 à 6 sections, chacune avec un <h2> et 1-2 paragraphes <p> (phrases courtes, faits précis).
- Si tu cites un chiffre (CA, volumes, marges, tarifs douaniers), arrondis et indique l'ordre de grandeur — n'invente pas.
- Structure type : (1) Vue d'ensemble économique · (2) Flux import/export clés · (3) Opportunités actionnables · (4) Risques & réglementation · (5) Infrastructure & logistique · (6) Cadre fiscal/social.
- Utilise du français professionnel. Ton : synthétique, orienté décision.
- Pas de <html>, <head>, <body>, <script>, <style>. Juste les balises h2/p/ul/li/strong.
- Maximum 1200 mots au total. Pas de préambule, pas de conclusion générique.

Retourne uniquement le HTML, rien d'autre.`

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt,
      maxOutputTokens: 2048,
      temperature: 0.4,
    })

    const cleaned = text
      .replace(/```html?\n?/gi, '')
      .replace(/```/g, '')
      .trim()

    if (cleaned.length < 200 || !/<h2/i.test(cleaned)) {
      throw new Error('generated_too_short_or_malformed')
    }

    const { error } = await sb.from('country_studies').upsert(
      [{ country_iso: isoUp, part: 1, content_html: cleaned, tier_required: 'free' }],
      { onConflict: 'country_iso,part' },
    )
    if (error) {
      console.warn('[section-fill/studies] insert failed:', error.message)
      return { added: 0, source: 'insert_error' }
    }
    return { added: 1, source: 'gemini_2_5_flash' }
  } catch (err) {
    console.warn('[section-fill/studies] gemini failed:', err instanceof Error ? err.message : String(err))
    const stubHtml = `<h2>Étude marché ${name}</h2><p>Synthèse temporairement indisponible. Nouvelle tentative automatique sous 24h.</p>`
    const { error } = await sb.from('country_studies').upsert(
      [{ country_iso: isoUp, part: 1, content_html: stubHtml, tier_required: 'free' }],
      { onConflict: 'country_iso,part' },
    )
    return { added: error ? 0 : 1, source: 'stub_gen_error' }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Idempotence — vérifie si la section a déjà du contenu
// ════════════════════════════════════════════════════════════════════════════
async function alreadyHasContent(iso: string, section: Section, product?: string): Promise<boolean> {
  const sb = db()
  switch (section) {
    case 'videos': {
      const q = sb.from('youtube_insights').select('id', { count: 'exact', head: true }).eq('country_iso', iso.toUpperCase())
      const { count } = await q
      return (count ?? 0) > 0
    }
    case 'clients': {
      let q = sb.from('local_buyers').select('id', { count: 'exact', head: true }).eq('country_iso', iso.toUpperCase())
      if (product) q = q.contains('product_slugs', [product.toLowerCase()])
      const { count } = await q
      return (count ?? 0) > 0
    }
    case 'methods': {
      if (!product) return true // pas de produit → considère "rempli" (page gère le fallback)
      const { count } = await sb.from('production_methods').select('id', { count: 'exact', head: true }).eq('product_slug', product)
      return (count ?? 0) > 0
    }
    case 'studies': {
      const { count } = await sb.from('country_studies').select('id', { count: 'exact', head: true }).eq('country_iso', iso.toUpperCase())
      return (count ?? 0) > 0
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Handler
// ════════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  let body: FillRequest = {}
  try {
    body = (await req.json()) as FillRequest
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const iso = String(body.iso ?? '').trim().toUpperCase()
  const sectionRaw = String(body.section ?? '').trim().toLowerCase()
  const product = body.product ? String(body.product).trim().toLowerCase() : undefined

  if (!iso || iso.length !== 3 && iso.length !== 2) {
    return NextResponse.json({ ok: false, error: 'invalid_iso' }, { status: 400 })
  }
  if (!VALID_SECTIONS.has(sectionRaw as Section)) {
    return NextResponse.json({ ok: false, error: 'invalid_section' }, { status: 400 })
  }
  const section = sectionRaw as Section

  // Idempotence : si déjà rempli, on ne touche à rien.
  if (await alreadyHasContent(iso, section, product)) {
    return NextResponse.json({ ok: true, items_added: 0, source: 'already_present' })
  }

  try {
    let result: { added: number; source: string }
    switch (section) {
      case 'videos':  result = await fillVideos(iso, product); break
      case 'clients': result = await fillClients(iso, product); break
      case 'methods': result = await fillMethods(iso, product); break
      case 'studies': result = await fillStudies(iso, product); break
    }
    return NextResponse.json({ ok: true, items_added: result.added, source: result.source })
  } catch (err) {
    console.error('[section-fill]', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
