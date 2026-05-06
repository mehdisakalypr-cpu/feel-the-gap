/**
 * Platform Publishers — production-ready avec stub fallback si token absent.
 * Stub si token absent → log + placeholder "scheduled". Réel sinon.
 *
 * IG / FB : Graph API v20
 * TikTok  : Content Posting API v2 (PULL_FROM_URL flow — pas de FILE_UPLOAD pour simplifier)
 * YouTube : Data API v3 videos.insert (resumable upload depuis URL distante)
 * LinkedIn: UGC Posts API v2 (register video asset → upload binary → create UGC)
 * X       : v2 media/upload (chunked init/append/finalize) + tweets
 */

import { Buffer } from 'node:buffer'

export type Platform = 'meta-ig' | 'meta-fb' | 'tiktok' | 'youtube' | 'linkedin' | 'twitter' | 'ofa-site'

export interface PublishRequest {
  platform: Platform
  videoUrl: string
  caption: string
  hashtags?: string[]
  scheduledFor?: string
  targetSiteId?: string
  // YouTube only
  ytTitle?: string
  ytPrivacy?: 'public' | 'unlisted' | 'private'
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

const stub = (prefix: string, scheduledFor?: string): PublishResult => ({
  ok: true,
  stub: true,
  platformPostId: `stub_${prefix}_${Date.now()}`,
  scheduledFor,
})

const fmtCaption = (req: PublishRequest): string =>
  `${req.caption}${req.hashtags?.length ? '\n\n' + req.hashtags.map(t => `#${t.replace(/^#/, '')}`).join(' ') : ''}`

// ── Meta Instagram Business ──────────────────────────────────────────────────
async function publishInstagram(req: PublishRequest): Promise<PublishResult> {
  const token = process.env.META_IG_ACCESS_TOKEN
  const igId  = process.env.META_IG_BUSINESS_ID
  if (!token || !igId) {
    console.log('[ig] STUB — META_IG_ACCESS_TOKEN absent')
    return stub('ig', req.scheduledFor)
  }
  try {
    const createRes = await fetch(`https://graph.facebook.com/v20.0/${igId}/media`, {
      method: 'POST',
      body: new URLSearchParams({
        media_type: 'REELS', video_url: req.videoUrl,
        caption: fmtCaption(req),
        access_token: token,
      }),
    })
    const create = await createRes.json()
    if (!create.id) return { ok: false, error: create.error?.message || 'IG create failed' }
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
    return stub('fb', req.scheduledFor)
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${pageId}/videos`, {
      method: 'POST',
      body: new URLSearchParams({
        file_url: req.videoUrl,
        description: fmtCaption(req),
        access_token: token,
      }),
    })
    const d = await res.json()
    return { ok: !!d.id, platformPostId: d.id, error: d.error?.message }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// ── TikTok Content Posting API v2 (PULL_FROM_URL flow) ──────────────────────
async function publishTikTok(req: PublishRequest): Promise<PublishResult> {
  const token = process.env.TIKTOK_ACCESS_TOKEN
  if (!token) {
    console.log('[tiktok] STUB — TIKTOK_ACCESS_TOKEN absent')
    return stub('tt', req.scheduledFor)
  }
  try {
    const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title: fmtCaption(req).slice(0, 2200),
          privacy_level: process.env.TIKTOK_PRIVACY ?? 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_stitch: false,
          disable_comment: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: { source: 'PULL_FROM_URL', video_url: req.videoUrl },
      }),
    })
    const init = await initRes.json()
    if (init.error?.code && init.error.code !== 'ok') {
      return { ok: false, error: `tiktok init: ${init.error.code} ${init.error.message}` }
    }
    const publishId = init.data?.publish_id
    if (!publishId) return { ok: false, error: 'tiktok no publish_id returned' }
    return { ok: true, platformPostId: publishId, scheduledFor: req.scheduledFor }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// ── YouTube Data API v3 (resumable upload from remote URL) ───────────────────
async function publishYouTube(req: PublishRequest): Promise<PublishResult> {
  const accessToken = process.env.YOUTUBE_ACCESS_TOKEN
  if (!accessToken) {
    console.log('[youtube] STUB — YOUTUBE_ACCESS_TOKEN absent')
    return stub('yt', req.scheduledFor)
  }
  try {
    const videoRes = await fetch(req.videoUrl)
    if (!videoRes.ok) return { ok: false, error: `youtube fetch source ${videoRes.status}` }
    const videoBuf = Buffer.from(await videoRes.arrayBuffer())
    const contentType = videoRes.headers.get('content-type') ?? 'video/mp4'
    const metadata = {
      snippet: {
        title: (req.ytTitle ?? req.caption).slice(0, 100),
        description: fmtCaption(req).slice(0, 5000),
        tags: req.hashtags?.slice(0, 30),
        categoryId: '22',
      },
      status: {
        privacyStatus: req.ytPrivacy ?? 'public',
        madeForKids: false,
      },
    }
    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': contentType,
          'X-Upload-Content-Length': String(videoBuf.length),
        },
        body: JSON.stringify(metadata),
      },
    )
    if (!initRes.ok) {
      const txt = (await initRes.text()).slice(0, 300)
      return { ok: false, error: `youtube init ${initRes.status}: ${txt}` }
    }
    const uploadUrl = initRes.headers.get('location')
    if (!uploadUrl) return { ok: false, error: 'youtube missing upload location' }
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: videoBuf,
    })
    if (!uploadRes.ok) {
      const txt = (await uploadRes.text()).slice(0, 300)
      return { ok: false, error: `youtube upload ${uploadRes.status}: ${txt}` }
    }
    const result = await uploadRes.json()
    return {
      ok: !!result.id,
      platformPostId: result.id,
      url: result.id ? `https://youtube.com/watch?v=${result.id}` : undefined,
    }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// ── LinkedIn UGC Posts (member or org) ───────────────────────────────────────
async function publishLinkedIn(req: PublishRequest): Promise<PublishResult> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN
  const authorUrn =
    process.env.LINKEDIN_ORG_URN ??
    (process.env.LINKEDIN_ORG_ID ? `urn:li:organization:${process.env.LINKEDIN_ORG_ID}` : undefined) ??
    process.env.LINKEDIN_PERSON_URN
  if (!token || !authorUrn) {
    console.log('[linkedin] STUB — LINKEDIN_ACCESS_TOKEN or author URN absent')
    return stub('li', req.scheduledFor)
  }
  try {
    const initRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
          owner: authorUrn,
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            },
          ],
        },
      }),
    })
    if (!initRes.ok) {
      const txt = (await initRes.text()).slice(0, 300)
      return { ok: false, error: `linkedin register ${initRes.status}: ${txt}` }
    }
    const init = await initRes.json()
    const asset = init.value?.asset
    const uploadUrl =
      init.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl
    if (!asset || !uploadUrl) return { ok: false, error: 'linkedin missing asset/uploadUrl' }
    const videoRes = await fetch(req.videoUrl)
    if (!videoRes.ok) return { ok: false, error: `linkedin fetch source ${videoRes.status}` }
    const videoBuf = Buffer.from(await videoRes.arrayBuffer())
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: videoBuf,
    })
    if (!uploadRes.ok && uploadRes.status !== 201) {
      const txt = (await uploadRes.text()).slice(0, 300)
      return { ok: false, error: `linkedin upload ${uploadRes.status}: ${txt}` }
    }
    const postRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: fmtCaption(req).slice(0, 3000) },
            shareMediaCategory: 'VIDEO',
            media: [
              { status: 'READY', description: { text: req.caption.slice(0, 200) }, media: asset },
            ],
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    })
    if (!postRes.ok) {
      const txt = (await postRes.text()).slice(0, 300)
      return { ok: false, error: `linkedin post ${postRes.status}: ${txt}` }
    }
    const ugcId = postRes.headers.get('x-restli-id') ?? (await postRes.json()).id
    return {
      ok: true,
      platformPostId: ugcId,
      url: ugcId ? `https://www.linkedin.com/feed/update/${ugcId}` : undefined,
    }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// ── X / Twitter v2 (chunked media/upload + tweets) ───────────────────────────
async function publishTwitter(req: PublishRequest): Promise<PublishResult> {
  const bearer = process.env.TWITTER_OAUTH2_TOKEN ?? process.env.TWITTER_ACCESS_TOKEN
  if (!bearer) {
    console.log('[twitter] STUB — TWITTER_OAUTH2_TOKEN absent')
    return stub('x', req.scheduledFor)
  }
  try {
    const videoRes = await fetch(req.videoUrl)
    if (!videoRes.ok) return { ok: false, error: `x fetch source ${videoRes.status}` }
    const videoBuf = Buffer.from(await videoRes.arrayBuffer())
    const totalBytes = videoBuf.length

    const initBody = new URLSearchParams({
      command: 'INIT',
      total_bytes: String(totalBytes),
      media_type: 'video/mp4',
      media_category: 'tweet_video',
    })
    const initRes = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${bearer}` },
      body: initBody,
    })
    if (!initRes.ok) {
      const txt = (await initRes.text()).slice(0, 300)
      return { ok: false, error: `x init ${initRes.status}: ${txt}` }
    }
    const init = await initRes.json()
    const mediaId = init.media_id_string
    if (!mediaId) return { ok: false, error: 'x missing media_id' }

    const CHUNK = 4 * 1024 * 1024
    let segIndex = 0
    for (let off = 0; off < totalBytes; off += CHUNK) {
      const slice = videoBuf.subarray(off, Math.min(off + CHUNK, totalBytes))
      const fd = new FormData()
      fd.append('command', 'APPEND')
      fd.append('media_id', mediaId)
      fd.append('segment_index', String(segIndex++))
      fd.append('media', new Blob([slice], { type: 'video/mp4' }), 'segment.bin')
      const ar = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${bearer}` },
        body: fd,
      })
      if (!ar.ok) return { ok: false, error: `x append seg=${segIndex - 1} ${ar.status}` }
    }

    const finBody = new URLSearchParams({ command: 'FINALIZE', media_id: mediaId })
    const finRes = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${bearer}` },
      body: finBody,
    })
    const fin = await finRes.json()
    if (fin.processing_info && fin.processing_info.state !== 'succeeded') {
      let attempts = 0
      while (attempts < 10) {
        await new Promise(r => setTimeout(r, (fin.processing_info?.check_after_secs ?? 5) * 1000))
        const stRes = await fetch(
          `https://upload.twitter.com/1.1/media/upload.json?command=STATUS&media_id=${mediaId}`,
          { headers: { 'Authorization': `Bearer ${bearer}` } },
        )
        const st = await stRes.json()
        if (st.processing_info?.state === 'succeeded') break
        if (st.processing_info?.state === 'failed') {
          return { ok: false, error: `x processing failed: ${st.processing_info?.error?.name}` }
        }
        attempts++
      }
    }

    const tweetRes = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: fmtCaption(req).slice(0, 280),
        media: { media_ids: [mediaId] },
      }),
    })
    if (!tweetRes.ok) {
      const txt = (await tweetRes.text()).slice(0, 300)
      return { ok: false, error: `x tweet ${tweetRes.status}: ${txt}` }
    }
    const tweet = await tweetRes.json()
    const id = tweet.data?.id
    return {
      ok: !!id,
      platformPostId: id,
      url: id ? `https://x.com/i/status/${id}` : undefined,
    }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// ── OFA site embed push ──────────────────────────────────────────────────────
async function publishOfaSite(req: PublishRequest): Promise<PublishResult> {
  if (!req.targetSiteId) return { ok: false, error: 'targetSiteId required for ofa-site' }
  const ofaApiUrl = process.env.OFA_API_URL
  const ofaApiKey = process.env.OFA_API_KEY
  if (!ofaApiUrl || !ofaApiKey) {
    console.log('[ofa-site] STUB — OFA_API_URL / OFA_API_KEY absent')
    return stub(`ofa_${req.targetSiteId}`, req.scheduledFor)
  }
  try {
    const res = await fetch(`${ofaApiUrl.replace(/\/+$/, '')}/sites/${req.targetSiteId}/hero-video`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${ofaApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ video_url: req.videoUrl, caption: req.caption }),
    })
    if (!res.ok) {
      const txt = (await res.text()).slice(0, 300)
      return { ok: false, error: `ofa-site ${res.status}: ${txt}` }
    }
    return { ok: true, platformPostId: `ofa_${req.targetSiteId}_${Date.now()}` }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
