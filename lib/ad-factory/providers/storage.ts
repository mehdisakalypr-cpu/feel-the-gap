/**
 * Supabase Storage — upload MP4/MP3, return public URL.
 */

import { createClient } from '@supabase/supabase-js'
import { loadProviderConfig } from '../types'

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

export async function uploadToStorage(args: {
  path: string                // 'jobs/<job_id>/segment-1.mp4'
  data: Buffer | ArrayBuffer
  contentType?: string
}): Promise<{ ok: boolean; url?: string; error?: string }> {
  const cfg = loadProviderConfig()
  const bucket = cfg.storage.bucket

  try {
    const client = sb()
    const bodyBuf: Uint8Array = args.data instanceof Buffer
      ? new Uint8Array(args.data)
      : new Uint8Array(args.data)
    const { error } = await client.storage.from(bucket).upload(args.path, bodyBuf, {
      contentType: args.contentType ?? 'video/mp4',
      upsert: true,
    })
    if (error) return { ok: false, error: error.message }
    const { data } = client.storage.from(bucket).getPublicUrl(args.path)
    return { ok: true, url: data.publicUrl }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

export async function downloadUrl(url: string): Promise<Buffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`download ${r.status}: ${url}`)
  return Buffer.from(await r.arrayBuffer())
}
