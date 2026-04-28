/**
 * Avatar persistence — stores generated reference faces and reuses them
 * across posts/videos to maintain cross-shot identity consistency.
 *
 * Pipeline:
 *   1. getOrCreateAvatar(slug) → if exists, return; else generate ref + insert
 *   2. recordAvatarUse(avatar_id, job_id, output_url) → bookkeeping
 */

import { createClient } from '@supabase/supabase-js'
import { generateImage } from './ad-factory/providers/image-gen'

interface AvatarRow {
  id: string
  slug: string
  persona: string
  target_saas: string | null
  prompt_token: string
  description: string | null
  ref_url: string
  seed: number
  used_count: number
  last_used_at: string | null
  created_at: string
  metadata: Record<string, unknown>
}

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

function hashSeed(slug: string): number {
  let h = 0
  for (let i = 0; i < slug.length; i++) {
    h = ((h << 5) - h + slug.charCodeAt(i)) | 0
  }
  return Math.abs(h) % 2_000_000_000
}

export interface PersonaSpec {
  slug: string
  persona: 'entrepreneur' | 'influenceur' | 'investisseur' | 'financeur' | string
  targetSaas?: string
  promptToken: string
  description?: string
}

export async function getOrCreateAvatar(spec: PersonaSpec): Promise<AvatarRow | null> {
  const db = adminDb()
  const { data: existing } = await db
    .from('ftg_avatars')
    .select('*')
    .eq('slug', spec.slug)
    .maybeSingle()
  if (existing) return existing as AvatarRow

  const seed = hashSeed(spec.slug)
  const gen = await generateImage({
    prompt: spec.promptToken,
    style: 'photorealistic',
    aspectRatio: '1:1',
    variants: 1,
  })
  if (!gen.ok || !gen.variants[0]?.url) return null

  const { data: inserted, error } = await db
    .from('ftg_avatars')
    .insert({
      slug: spec.slug,
      persona: spec.persona,
      target_saas: spec.targetSaas ?? null,
      prompt_token: spec.promptToken,
      description: spec.description ?? null,
      ref_url: gen.variants[0].url,
      seed,
    })
    .select('*')
    .single()
  if (error) return null
  return inserted as AvatarRow
}

export async function recordAvatarUse(
  avatarId: string,
  jobId: string | null,
  outputUrl: string,
  prompt: string,
): Promise<void> {
  const db = adminDb()
  await db.from('ftg_avatar_uses').insert({
    avatar_id: avatarId,
    job_id: jobId,
    output_url: outputUrl,
    prompt,
  })
  await db.rpc('increment_avatar_use', { p_id: avatarId }).catch(async () => {
    const { data: cur } = await db
      .from('ftg_avatars')
      .select('used_count')
      .eq('id', avatarId)
      .maybeSingle()
    await db
      .from('ftg_avatars')
      .update({
        used_count: (cur?.used_count ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', avatarId)
  })
}

export async function listAvatars(targetSaas?: string): Promise<AvatarRow[]> {
  const db = adminDb()
  let q = db.from('ftg_avatars').select('*').order('used_count', { ascending: false })
  if (targetSaas) q = q.eq('target_saas', targetSaas)
  const { data } = await q
  return (data ?? []) as AvatarRow[]
}
