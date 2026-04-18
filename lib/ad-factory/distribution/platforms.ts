/**
 * Platform Publishers — stubs prêts à brancher.
 * Stub si token absent → log + placeholder "scheduled". Réel sinon.
 */

export type Platform = 'meta-ig' | 'meta-fb' | 'tiktok' | 'youtube' | 'linkedin' | 'twitter' | 'ofa-site'

export interface PublishRequest {
  platform: Platform
  videoUrl: string
  caption: string
  hashtags?: string[]
  scheduledFor?: string     // ISO date
  targetSiteId?: string     // pour ofa-site
}

export interface PublishResult {
  ok: boolean
  platformPostId?: string
  url?: string
  scheduledFor?: string
  error?: string
  stub?: boolean
}

export async function publishToPlatform(req: PublishRequest): Promise<PublishResult> {
  const handler = HANDLERS[req.platform]
  if (!handler) return { ok: false, error: `unknown platform ${req.platform}` }
  return handler(req)
}

const HANDLERS: Record<Platform, (r: PublishRequest) => Promise<PublishResult>> = {
  'meta-ig':   publishInstagram,
  'meta-fb':   publishFacebook,
  'tiktok':    publishTikTok,
  'youtube':   publishYouTube,
  'linkedin':  publishLinkedIn,
  'twitter':   publishTwitter,
  'ofa-site':  publishOfaSite,
}

// ── Meta Instagram Business ──────────────────────────────────────────────────
async function publishInstagram(req: PublishRequest): Promise<PublishResult> {
  const token = process.env.META_IG_ACCESS_TOKEN
  const igId  = process.env.META_IG_BUSINESS_ID
  if (!token || !igId) {
    console.log('[ig] STUB — META_IG_ACCESS_TOKEN absent')
    return { ok: true, stub: true, platformPostId: `stub_ig_${Date.now()}`, scheduledFor: req.scheduledFor }
  }
  try {
    const createRes = await fetch(`https://graph.facebook.com/v20.0/${igId}/media`, {
      method: 'POST',
      body: new URLSearchParams({
        media_type: 'REELS', video_url: req.videoUrl,
        caption: `${req.caption}\n\n${(req.hashtags ?? []).map(t => `#${t}`).join(' ')}`,
        access_token: token,
      }),
    })
    const create = await createRes.json()
    if (!create.id) return { ok: false, error: create.error?.message || 'IG create failed' }
    // Publish after 30s (IG needs processing time — here just schedule client-side)
    const pubRes = await fetch(`https://graph.facebook.com/v20.0/${igId}/media_publish`, {
      method: 'POST',
      body: new URLSearchParams({ creation_id: create.id, access_token: token }),
    })
    const pub = await pubRes.json()
    return { ok: !!pub.id, platformPostId: pub.id, error: pub.error?.message }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// ── Meta Facebook Page ───────────────────────────────────────────────────────
async function publishFacebook(req: PublishRequest): Promise<PublishResult> {
  const token = process.env.META_FB_PAGE_TOKEN
  const pageId = process.env.META_FB_PAGE_ID
  if (!token || !pageId) {
    console.log('[fb] STUB — META_FB_PAGE_TOKEN absent')
    return { ok: true, stub: true, platformPostId: `stub_fb_${Date.now()}` }
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${pageId}/videos`, {
      method: 'POST',
      body: new URLSearchParams({
        file_url: req.videoUrl,
        description: req.caption,
        access_token: token,
      }),
    })
    const d = await res.json()
    return { ok: !!d.id, platformPostId: d.id, error: d.error?.message }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// ── TikTok Business ──────────────────────────────────────────────────────────
async function publishTikTok(req: PublishRequest): Promise<PublishResult> {
  const token = process.env.TIKTOK_ACCESS_TOKEN
  if (!token) {
    console.log('[tiktok] STUB — TIKTOK_ACCESS_TOKEN absent')
    return { ok: true, stub: true, platformPostId: `stub_tt_${Date.now()}` }
  }
  // TikTok Content Posting API v2 (requires video upload multipart)
  // Stub implementation — API scoping complexe, à finaliser avec tokens réels
  return { ok: false, error: 'TikTok API integration TBD (needs OAuth + multipart upload flow)' }
}

// ── YouTube Data API ─────────────────────────────────────────────────────────
async function publishYouTube(req: PublishRequest): Promise<PublishResult> {
  const token = process.env.YOUTUBE_OAUTH_TOKEN
  if (!token) {
    console.log('[youtube] STUB — YOUTUBE_OAUTH_TOKEN absent')
    return { ok: true, stub: true, platformPostId: `stub_yt_${Date.now()}` }
  }
  // YT Data API v3 videos.insert — resumable upload required
  return { ok: false, error: 'YouTube upload integration TBD (resumable upload session required)' }
}

// ── LinkedIn UGC ─────────────────────────────────────────────────────────────
async function publishLinkedIn(req: PublishRequest): Promise<PublishResult> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN
  const orgId = process.env.LINKEDIN_ORG_ID
  if (!token || !orgId) {
    console.log('[linkedin] STUB — LINKEDIN_ACCESS_TOKEN absent')
    return { ok: true, stub: true, platformPostId: `stub_li_${Date.now()}` }
  }
  // LinkedIn UGC Posts API
  return { ok: false, error: 'LinkedIn UGC integration TBD (register video asset → upload → create post)' }
}

// ── X/Twitter ────────────────────────────────────────────────────────────────
async function publishTwitter(req: PublishRequest): Promise<PublishResult> {
  const bearer = process.env.TWITTER_BEARER
  if (!bearer) {
    console.log('[twitter] STUB — TWITTER_BEARER absent')
    return { ok: true, stub: true, platformPostId: `stub_x_${Date.now()}` }
  }
  // X API v2 media upload + tweet create
  return { ok: false, error: 'X/Twitter integration TBD' }
}

// ── OFA site embed push ──────────────────────────────────────────────────────
async function publishOfaSite(req: PublishRequest): Promise<PublishResult> {
  if (!req.targetSiteId) return { ok: false, error: 'targetSiteId required for ofa-site' }
  console.log('[ofa-site] STUB — marquera le site.hero_video_url (TBD)')
  // TODO : update site record with video URL via OFA API
  return { ok: true, stub: true, platformPostId: `ofa_${req.targetSiteId}_${Date.now()}` }
}
