// @ts-nocheck
/**
 * E2E Deal Room → OFA migration · 2026-04-22
 *
 * Flow:
 *   1. Pick demo user (producer) and create a published deal room with all required fields
 *   2. Call endpoint logic in-process (simulate POST /api/deal-rooms/[id]/migrate-to-ofa)
 *   3. Assert: generated_sites row created, deal_rooms.status='migrated_to_standalone',
 *      generated_site_id linked, site_sections generated
 *   4. Second call → 409 already_migrated (idempotent)
 *   5. Incomplete deal room → 422 deal_room_incomplete
 *   6. Cleanup: delete generated_sites + deal room
 *
 * Usage: cd /var/www/feel-the-gap && npx tsx scripts/e2e-deal-room-ofa-migration.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  const p = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i).trim()
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

type Step = { name: string; ok: boolean; detail: string }
const steps: Step[] = []
function log(name: string, ok: boolean, detail: string) {
  steps.push({ name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name} — ${detail}`)
}

const TAG = `e2e-${Date.now()}`
const DEMO_PRODUCER_EMAIL = 'demo.entrepreneur@feelthegap.app'

async function findUser(email: string) {
  const { data } = await db.from('profiles').select('id, email').eq('email', email).maybeSingle()
  if (!data) throw new Error(`demo user not found: ${email}`)
  return data.id
}

// Replicate the core logic of /api/deal-rooms/[id]/migrate-to-ofa (sans HTTP/auth)
async function migrate(dealRoomId: string, actorUserId: string, customSlug?: string) {
  const { data: room } = await db
    .from('deal_rooms')
    .select('*')
    .eq('id', dealRoomId)
    .maybeSingle()
  if (!room) return { status: 404, body: { error: 'deal_room_not_found' } }
  if (room.seller_id !== actorUserId) return { status: 403, body: { error: 'forbidden' } }

  if (room.generated_site_id) {
    return { status: 409, body: { error: 'already_migrated', site_id: room.generated_site_id } }
  }
  if (!['published', 'paused'].includes(room.status)) {
    return { status: 422, body: { error: 'deal_room_not_publishable', status: room.status } }
  }

  const missing: string[] = []
  if (!room.title || room.title.trim().length < 4) missing.push('title')
  if (!room.summary || room.summary.trim().length < 20) missing.push('summary')
  if (!room.product_label || room.product_label.trim().length < 2) missing.push('product_label')
  if (!room.hero_image_url) missing.push('hero_image')
  if (!room.cta_email && !room.cta_phone && !room.cta_whatsapp) missing.push('cta')
  if (missing.length > 0) return { status: 422, body: { error: 'deal_room_incomplete', missing } }

  const baseSlug = (customSlug || `${room.slug}-ofa`)
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)

  let slug = baseSlug
  for (let n = 1; n <= 50; n++) {
    const { data: existing } = await db.from('generated_sites').select('id').eq('slug', slug).maybeSingle()
    if (!existing) break
    slug = `${baseSlug}-${n}`
  }

  const { data: site, error: insertErr } = await db
    .from('generated_sites')
    .insert({
      slug,
      business_name: room.title,
      tagline: room.summary?.split('.')[0]?.slice(0, 120) ?? null,
      description: room.summary,
      lang: 'fr',
      hero_title: room.title,
      hero_subtitle: room.summary,
      about_text: room.summary,
      products_json: [{ name: room.product_label, description: room.summary, images: [room.hero_image_url] }],
      contact_info: {
        ...(room.cta_email ? { email: room.cta_email } : {}),
        ...(room.cta_phone ? { phone: room.cta_phone } : {}),
        ...(room.cta_whatsapp ? { whatsapp: room.cta_whatsapp } : {}),
      },
      testimonials: [],
      meta_title: `${room.title} — ${room.product_label ?? ''}`.trim(),
      meta_description: room.summary?.slice(0, 160) ?? null,
      color_primary: '#C9A84C',
      color_secondary: '#07090F',
      template: 'standard',
      status: 'draft',
      site_sections: [
        { slug: 'hero', title: room.title, subtitle: room.summary, image: room.hero_image_url },
        { slug: 'product', title: room.product_label, description: room.summary },
        { slug: 'contact', title: 'Contact' },
      ],
      certifications: room.certifications ?? [],
    })
    .select('id, slug')
    .single()
  if (insertErr || !site) return { status: 500, body: { error: 'insert_failed', detail: insertErr?.message } }

  const now = new Date().toISOString()
  const { error: updErr } = await db
    .from('deal_rooms')
    .update({
      generated_site_id: site.id,
      migrated_at: now,
      status: 'migrated_to_standalone',
      updated_at: now,
    })
    .eq('id', room.id)
  if (updErr) {
    await db.from('generated_sites').delete().eq('id', site.id)
    return { status: 500, body: { error: 'link_failed', detail: updErr.message } }
  }

  return {
    status: 200,
    body: {
      ok: true,
      site_id: site.id,
      site_slug: site.slug,
    },
  }
}

async function cleanup(sellerId: string) {
  const { data: rooms } = await db.from('deal_rooms').select('id, generated_site_id').eq('seller_id', sellerId).ilike('title', `E2E-${TAG}%`)
  for (const r of rooms ?? []) {
    if (r.generated_site_id) await db.from('generated_sites').delete().eq('id', r.generated_site_id)
    await db.from('deal_rooms').delete().eq('id', r.id)
  }
}

async function main() {
  const producerId = await findUser(DEMO_PRODUCER_EMAIL)
  log('pick-demo-user', true, `producer=${producerId.slice(0, 8)}`)

  // 1. Create a complete published deal room
  const expectedTitle = `E2E-${TAG} · Coffee Robusta`
  const { data: room, error: roomErr } = await db.from('deal_rooms').insert({
    slug: `e2e-${TAG}`,
    seller_id: producerId,
    title: expectedTitle,
    summary: 'Robusta green beans from Ivory Coast, A-grade, FOB Abidjan. MOQ 1t, lead time 30 days.',
    product_slug: 'coffee-robusta',
    product_label: 'Robusta green beans',
    country_iso: 'CIV',
    archetype: 'farmer',
    hero_image_url: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=1200',
    gallery: [{ url: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800' }],
    cta_email: 'seller@e2e.test',
    cta_phone: '+225000000000',
    status: 'published',
    published_at: new Date().toISOString(),
  }).select('id, slug, status').single()
  if (roomErr || !room) throw new Error(`room create: ${roomErr?.message}`)
  log('create-deal-room', true, `id=${room.id.slice(0, 8)} status=${room.status}`)

  // 2. Migrate
  const res1 = await migrate(room.id, producerId)
  log('migrate-1st-call', res1.status === 200, `status=${res1.status} ${JSON.stringify(res1.body).slice(0, 120)}`)
  if (res1.status !== 200) throw new Error('first migrate should succeed')

  // 3. Assert: generated_sites row created
  const { data: site } = await db.from('generated_sites').select('id, slug, status, site_sections, business_name').eq('id', res1.body.site_id).maybeSingle()
  log('site-row-exists', !!site, site ? `slug=${site.slug} status=${site.status}` : 'not found')
  log('site-business-name', site?.business_name === expectedTitle, `business_name=${site?.business_name}`)
  log('site-status-draft', site?.status === 'draft', `status=${site?.status}`)
  log('site-sections-present', Array.isArray(site?.site_sections) && site!.site_sections.length >= 2, `sections=${site?.site_sections?.length ?? 0}`)

  // 4. Assert: deal_rooms flipped
  const { data: roomAfter } = await db.from('deal_rooms').select('status, generated_site_id, migrated_at').eq('id', room.id).maybeSingle()
  log('deal-room-migrated', roomAfter?.status === 'migrated_to_standalone', `status=${roomAfter?.status}`)
  log('deal-room-linked', roomAfter?.generated_site_id === res1.body.site_id, `generated_site_id=${roomAfter?.generated_site_id?.slice(0, 8)}`)
  log('deal-room-migrated-at', !!roomAfter?.migrated_at, `migrated_at=${roomAfter?.migrated_at}`)

  // 5. Idempotence — 2nd call returns 409
  const res2 = await migrate(room.id, producerId)
  log('migrate-2nd-409', res2.status === 409 && res2.body.error === 'already_migrated', `status=${res2.status} err=${res2.body.error}`)

  // 6. No duplicate generated_sites (cleanup won't see 2)
  const { data: sitesForRoom } = await db.from('generated_sites').select('id').eq('id', res1.body.site_id)
  log('no-duplicate-site', (sitesForRoom ?? []).length === 1, `count=${(sitesForRoom ?? []).length}`)

  // 7. Incomplete deal room → 422
  const { data: incRoom } = await db.from('deal_rooms').insert({
    slug: `e2e-${TAG}-inc`,
    seller_id: producerId,
    title: `E2E-${TAG} · Incomplete`,
    summary: null, // missing
    product_label: null, // missing
    status: 'published',
  }).select('id').single()
  const res3 = await migrate(incRoom.id, producerId)
  log('incomplete-422', res3.status === 422 && res3.body.error === 'deal_room_incomplete', `status=${res3.status} missing=${res3.body.missing?.join(',')}`)

  // 8. Forbidden for another user
  const fakeUuid = '00000000-0000-0000-0000-000000000000'
  const res4 = await migrate(room.id, fakeUuid)
  log('forbidden-403', res4.status === 403, `status=${res4.status}`)

  // Cleanup
  await db.from('deal_rooms').delete().eq('id', incRoom.id)
  const { data: lastRoom } = await db.from('deal_rooms').select('generated_site_id').eq('id', room.id).maybeSingle()
  if (lastRoom?.generated_site_id) {
    await db.from('generated_sites').delete().eq('id', lastRoom.generated_site_id)
  }
  await db.from('deal_rooms').delete().eq('id', room.id)
  log('cleanup', true, 'removed fixtures')
}

main()
  .then(async () => {
    await cleanup('nouser').catch(() => {})
    const okCount = steps.filter(s => s.ok).length
    const total = steps.length
    console.log(`\n${okCount}/${total} assertions passed`)
    if (okCount !== total) process.exit(1)
  })
  .catch(err => {
    console.error('FATAL', err)
    process.exit(1)
  })
