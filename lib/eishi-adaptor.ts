/**
 * eishi-adaptor — Payment-Triggered Content Synthesis (Eishi Tsukasa)
 *
 * Named after Eishi Tsukasa (Food Wars): master of a rigid base (technique
 * parfaite) who adapts instantly to any theme. Embodies our hybrid pattern:
 *   - static base pre-computed in `ftg_opportunity_content` and
 *     `ftg_product_country_videos` (shared cache)
 *   - per-user adaptation layer generated on-demand at paid access
 *
 * Responsibility: audit content completeness for (user, opp_id, country) and
 * enqueue high-priority jobs (priority=100) for anything missing or thin.
 * Returns a snapshot so the UI can show <SectionSynthesizing /> on sections
 * that are still generating.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type SectionKey = 'production_methods' | 'business_plans' | 'potential_clients' | 'youtube_videos'

export type SectionState = 'ready' | 'thin' | 'missing' | 'generating'

export interface SectionSnapshot {
  key: SectionKey
  state: SectionState
  enqueued: boolean   // true si on vient de mettre un job prioritaire en queue
}

export interface EishiAuditResult {
  opp_id: string
  country_iso: string
  lang: string
  sections: Record<SectionKey, SectionSnapshot>
  anyPending: boolean  // true si au moins une section n'est pas `ready`
}

// Seuils de "richesse" — en dessous, la section est considérée `thin` et
// on enqueue une regen même si une version existe déjà.
const THRESHOLDS = {
  youtube_videos_min: 3,
  business_plans_min_words: 600,
  potential_clients_min: 5,
  production_methods_min_variants: 2,
} as const

function scoreVideos(payload: unknown): SectionState {
  const videos = (payload as any)?.videos
  if (!Array.isArray(videos) || videos.length === 0) return 'missing'
  if (videos.length < THRESHOLDS.youtube_videos_min) return 'thin'
  return 'ready'
}

function scoreBusinessPlans(payload: unknown): SectionState {
  if (!payload) return 'missing'
  const text = JSON.stringify(payload)
  const words = text.split(/\s+/).length
  if (words < THRESHOLDS.business_plans_min_words) return 'thin'
  return 'ready'
}

function scorePotentialClients(payload: unknown): SectionState {
  const cats = (payload as any)?.categories
  if (!Array.isArray(cats) || cats.length === 0) return 'missing'
  const total = cats.reduce((sum: number, c: any) => sum + (c?.companies?.length ?? 0), 0)
  if (total < THRESHOLDS.potential_clients_min) return 'thin'
  return 'ready'
}

function scoreProductionMethods(payload: unknown): SectionState {
  const variants = (payload as any)?.variants ?? (payload as any)?.methods
  if (!Array.isArray(variants) || variants.length === 0) return 'missing'
  if (variants.length < THRESHOLDS.production_methods_min_variants) return 'thin'
  return 'ready'
}

/**
 * Audit an opportunity for one user. If `enqueue=true`, insert priority=100
 * jobs for every missing/thin section not already pending or running.
 */
export async function auditAndEnqueueForOpp(
  sb: SupabaseClient,
  params: {
    userId: string
    oppId: string
    countryIso: string
    lang?: string
    enqueue?: boolean
    priority?: number  // default 100 (paid). Use 50 for free-tier, 30 for anon.
    source?: 'payment' | 'premium_visit' | 'free_visit' | 'anon_visit' | 'manual'
  },
): Promise<EishiAuditResult> {
  const lang = params.lang ?? 'fr'
  const country = params.countryIso.toUpperCase()
  const enqueue = params.enqueue !== false
  const priority = params.priority ?? 100

  // Pull opp to get product_id (needed for shared video cache lookup)
  const { data: opp } = await sb
    .from('opportunities')
    .select('product_id')
    .eq('id', params.oppId)
    .maybeSingle()
  const productId = opp?.product_id as string | undefined

  // Load 3 sources in parallel:
  //   opp content (layer 2, per-opp personalization)
  //   base content (layer 1, shared per product×country×lang)
  //   videos cache (shared per product×country)
  const [{ data: content }, { data: baseContent }, videosRes] = await Promise.all([
    sb.from('ftg_opportunity_content')
      .select('status, production_methods, business_plans, potential_clients, youtube_videos')
      .eq('opp_id', params.oppId).eq('country_iso', country).eq('lang', lang).maybeSingle(),
    productId
      ? sb.from('ftg_product_country_content')
          .select('status, production_methods, business_plans, potential_clients')
          .eq('product_id', productId).eq('country_iso', country).eq('lang', lang).maybeSingle()
      : Promise.resolve({ data: null as any }),
    productId
      ? sb.from('ftg_product_country_videos')
          .select('status, payload')
          .eq('product_id', productId).eq('country_iso', country).maybeSingle()
      : Promise.resolve({ data: null as any }),
  ])

  const videosRow = (videosRes as any)?.data

  // Merge base (layer 1) + per-opp (layer 2) per section. Per-opp wins.
  const merged = {
    production_methods: content?.production_methods ?? baseContent?.production_methods,
    business_plans:     content?.business_plans ?? baseContent?.business_plans,
    potential_clients:  content?.potential_clients ?? baseContent?.potential_clients,
  }

  const sections: Record<SectionKey, SectionSnapshot> = {
    production_methods: { key: 'production_methods', state: scoreProductionMethods(merged.production_methods), enqueued: false },
    business_plans:     { key: 'business_plans',     state: scoreBusinessPlans(merged.business_plans),         enqueued: false },
    potential_clients:  { key: 'potential_clients',  state: scorePotentialClients(merged.potential_clients),   enqueued: false },
    youtube_videos:     { key: 'youtube_videos',     state: videosRow?.status === 'ready' ? scoreVideos(videosRow.payload) : (videosRow?.status === 'generating' ? 'generating' : 'missing'), enqueued: false },
  }

  // Check pending/running jobs already in queue for this (opp, country, lang) — avoid duplicate enqueue.
  const { data: pendingJobs } = await sb
    .from('ftg_content_jobs')
    .select('job_type, status')
    .eq('opp_id', params.oppId).eq('country_iso', country).eq('lang', lang)
    .in('status', ['pending', 'running'])

  const alreadyQueued = new Set<string>((pendingJobs ?? []).map((j) => j.job_type))

  if (enqueue) {
    const toEnqueue: Array<{ job_type: string }> = []

    for (const key of Object.keys(sections) as SectionKey[]) {
      const snap = sections[key]
      if (snap.state === 'ready') continue
      if (alreadyQueued.has(key) || alreadyQueued.has('full')) {
        snap.state = 'generating'
        continue
      }
      toEnqueue.push({ job_type: key })
      snap.enqueued = true
      snap.state = 'generating'
    }

    if (toEnqueue.length > 0) {
      const rows = toEnqueue.map((j) => ({
        job_type: j.job_type,
        opp_id: params.oppId,
        country_iso: country,
        lang,
        priority,
        source: params.source ?? 'premium_visit',
        triggered_by: params.userId === 'anon' ? null : params.userId,
      }))
      const { error } = await sb.from('ftg_content_jobs').insert(rows)
      if (error) console.error('[eishi] enqueue error:', error.message)
    }
  }

  const anyPending = Object.values(sections).some((s) => s.state !== 'ready')

  return {
    opp_id: params.oppId,
    country_iso: country,
    lang,
    sections,
    anyPending,
  }
}

/**
 * Bulk audit used on payment validation — scans the user's shortlisted or
 * recently-visited opportunities and enqueues priority jobs in one pass.
 * Safe to call repeatedly: duplicates are filtered by alreadyQueued check.
 */
export async function auditAndEnqueueForUser(
  sb: SupabaseClient,
  userId: string,
  opts?: { maxOpps?: number; lang?: string },
): Promise<{ auditsRun: number; totalEnqueued: number }> {
  const maxOpps = opts?.maxOpps ?? 20
  const lang = opts?.lang ?? 'fr'

  // Source 1: shortlisted opportunities. Falls back to shortlist-less tables if absent.
  let targets: Array<{ opp_id: string; country_iso: string }> = []

  const { data: shortlisted } = await sb
    .from('ftg_user_opportunities')
    .select('opportunity_id, country_iso')
    .eq('user_id', userId)
    .limit(maxOpps)
  if (shortlisted && shortlisted.length > 0) {
    targets = shortlisted.map((r: any) => ({ opp_id: r.opportunity_id, country_iso: r.country_iso }))
  } else {
    // Fallback: most-recently-viewed opps from analytics (if table exists)
    const { data: recent } = await sb
      .from('ftg_opportunity_views')
      .select('opp_id, country_iso, viewed_at')
      .eq('user_id', userId)
      .order('viewed_at', { ascending: false })
      .limit(maxOpps)
    if (recent) targets = recent.map((r: any) => ({ opp_id: r.opp_id, country_iso: r.country_iso }))
  }

  if (targets.length === 0) return { auditsRun: 0, totalEnqueued: 0 }

  let totalEnqueued = 0
  for (const t of targets) {
    const result = await auditAndEnqueueForOpp(sb, {
      userId, oppId: t.opp_id, countryIso: t.country_iso, lang,
      enqueue: true, source: 'payment',
    })
    totalEnqueued += Object.values(result.sections).filter((s) => s.enqueued).length
  }

  return { auditsRun: targets.length, totalEnqueued }
}
