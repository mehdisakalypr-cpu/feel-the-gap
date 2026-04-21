// © 2025-2026 Feel The Gap — Deal Room → OFA standalone migration (1-click handoff, phase 2)
// Crée un generated_sites OFA à partir de la deal room, puis marque la deal room 'migrated_to_standalone'.
// Lecture spec : docs/SPEC_DEAL_ROOM_OFA_MIGRATION.md

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase-server'
import { sendResendEmail } from '@/lib/email/send'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const OFA_BASE = process.env.OFA_PUBLIC_BASE_URL || 'https://one-for-all-app.vercel.app'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

async function uniqueGeneratedSiteSlug(base: string): Promise<string> {
  const a = admin()
  let candidate = base
  let n = 0
  while (true) {
    const { data } = await a.from('generated_sites').select('id').eq('slug', candidate).maybeSingle()
    if (!data) return candidate
    n += 1
    candidate = `${base}-${n}`
    if (n > 50) return `${base}-${Date.now().toString(36)}`
  }
}

// Deal room archetype → OFA template (used as generated_sites.template string tag)
function mapTemplate(archetype: string | null): string {
  const m: Record<string, string> = {
    farmer: 'artisan-producer',
    producer: 'artisan-producer',
    trader: 'b2b-distributor',
    distributor: 'b2b-distributor',
    transformer: 'manufacturer',
    processor: 'manufacturer',
    wholesaler: 'b2b-distributor',
    exporter: 'b2b-distributor',
    importer: 'b2b-distributor',
  }
  return (archetype && m[archetype.toLowerCase()]) || 'standard'
}

interface DealRoomRow {
  id: string
  slug: string
  seller_id: string | null
  title: string
  summary: string | null
  product_slug: string | null
  product_label: string | null
  country_iso: string | null
  archetype: string | null
  hero_image_url: string | null
  gallery: unknown
  price_range: unknown
  moq: string | null
  lead_time_days: number | null
  incoterms: string[] | null
  certifications: string[] | null
  cta_whatsapp: string | null
  cta_email: string | null
  cta_phone: string | null
  status: string
  generated_site_id: string | null
  migrated_at: string | null
}

interface MigrateBody {
  custom_slug?: string
}

function hasAtLeastOneCta(r: DealRoomRow): boolean {
  return !!(r.cta_email || r.cta_phone || r.cta_whatsapp)
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: MigrateBody = {}
  try { body = await req.json() } catch { /* body optional */ }

  const a = admin()

  // 1. Load + ownership
  const { data: room, error: loadErr } = await a
    .from('deal_rooms')
    .select('id, slug, seller_id, title, summary, product_slug, product_label, country_iso, archetype, hero_image_url, gallery, price_range, moq, lead_time_days, incoterms, certifications, cta_whatsapp, cta_email, cta_phone, status, generated_site_id, migrated_at')
    .eq('id', id)
    .maybeSingle()
  if (loadErr || !room) return NextResponse.json({ error: 'deal_room_not_found' }, { status: 404 })

  const r = room as DealRoomRow
  if (r.seller_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // 2. Idempotence — already migrated
  if (r.generated_site_id) {
    const { data: existing } = await a
      .from('generated_sites')
      .select('id, slug, status')
      .eq('id', r.generated_site_id)
      .maybeSingle()
    const existingSlug = existing?.slug ?? r.slug
    return NextResponse.json({
      error: 'already_migrated',
      site_id: r.generated_site_id,
      public_url: `${OFA_BASE}/site/${existingSlug}`,
      migrated_at: r.migrated_at,
    }, { status: 409 })
  }

  // 3. Status gate
  if (!['published', 'paused'].includes(r.status)) {
    return NextResponse.json({ error: 'deal_room_not_publishable', status: r.status }, { status: 422 })
  }

  // 4. Completeness gate
  const missing: string[] = []
  if (!r.title || r.title.trim().length < 4) missing.push('title')
  if (!r.summary || r.summary.trim().length < 20) missing.push('summary')
  if (!r.product_label || r.product_label.trim().length < 2) missing.push('product_label')
  if (!r.hero_image_url) missing.push('hero_image')
  if (!hasAtLeastOneCta(r)) missing.push('cta')
  if (missing.length > 0) {
    return NextResponse.json({ error: 'deal_room_incomplete', missing }, { status: 422 })
  }

  // 5. Build generated_sites row
  const baseSlug = slugify(body.custom_slug || `${r.slug}-ofa`)
  if (baseSlug.length < 3) {
    return NextResponse.json({ error: 'bad_slug' }, { status: 400 })
  }
  const slug = await uniqueGeneratedSiteSlug(baseSlug)

  const gallery = Array.isArray(r.gallery) ? (r.gallery as Array<{ url?: string; alt?: string }>) : []
  const images: string[] = [
    ...(r.hero_image_url ? [r.hero_image_url] : []),
    ...gallery.map(g => g?.url).filter((u): u is string => typeof u === 'string'),
  ].slice(0, 8)

  const priceRange = (r.price_range ?? null) as { min?: number; max?: number; currency?: string; unit?: string } | null
  const priceLabel = priceRange && (priceRange.min || priceRange.max)
    ? `${priceRange.min ?? '-'}–${priceRange.max ?? '-'} ${priceRange.currency ?? 'EUR'}/${priceRange.unit ?? 'unit'}`
    : undefined

  const productsJson = [{
    name: r.product_label,
    slug: r.product_slug,
    description: r.summary ?? undefined,
    price: priceLabel,
    moq: r.moq ?? undefined,
    lead_time_days: r.lead_time_days ?? undefined,
    incoterms: r.incoterms ?? undefined,
    images,
  }]

  const contactInfo: Record<string, string> = {}
  if (r.cta_email) contactInfo.email = r.cta_email
  if (r.cta_phone) contactInfo.phone = r.cta_phone
  if (r.cta_whatsapp) contactInfo.whatsapp = r.cta_whatsapp

  const siteSections = [
    {
      slug: 'hero',
      title: r.title,
      subtitle: r.summary,
      image: r.hero_image_url,
    },
    ...(images.length > 1 ? [{
      slug: 'gallery',
      title: 'Galerie',
      images: images.slice(1),
    }] : []),
    {
      slug: 'product',
      title: r.product_label,
      description: r.summary,
      specs: {
        moq: r.moq,
        lead_time_days: r.lead_time_days,
        incoterms: r.incoterms,
        certifications: r.certifications,
        price: priceLabel,
      },
    },
    {
      slug: 'contact',
      title: 'Contact',
      ...contactInfo,
    },
  ]

  const now = new Date().toISOString()
  const { data: site, error: insertErr } = await a
    .from('generated_sites')
    .insert({
      slug,
      business_name: r.title,
      tagline: r.summary?.split('.')[0]?.slice(0, 120) ?? null,
      description: r.summary,
      lang: 'fr',
      hero_title: r.title,
      hero_subtitle: r.summary,
      about_text: r.summary,
      products_json: productsJson,
      contact_info: contactInfo,
      testimonials: [],
      meta_title: `${r.title} — ${r.product_label ?? ''}`.trim(),
      meta_description: r.summary?.slice(0, 160) ?? null,
      keywords: [r.product_label, r.country_iso, r.archetype].filter(Boolean) as string[],
      color_primary: '#C9A84C',
      color_secondary: '#07090F',
      template: mapTemplate(r.archetype),
      status: 'draft',
      site_sections: siteSections,
      certifications: r.certifications ?? [],
    })
    .select('id, slug')
    .single()

  if (insertErr || !site) {
    return NextResponse.json({ error: 'insert_failed', detail: insertErr?.message }, { status: 500 })
  }

  // 6. Link deal room → generated_sites + flip status
  const { error: updErr } = await a
    .from('deal_rooms')
    .update({
      generated_site_id: site.id,
      migrated_at: now,
      status: 'migrated_to_standalone',
      updated_at: now,
    })
    .eq('id', r.id)

  if (updErr) {
    // Try to roll back generated_sites to avoid orphan
    await a.from('generated_sites').delete().eq('id', site.id)
    return NextResponse.json({ error: 'link_failed', detail: updErr.message }, { status: 500 })
  }

  const publicUrl = `${OFA_BASE}/site/${site.slug}`
  const previewUrl = `${OFA_BASE}/site/${site.slug}/preview`

  // 7. Email seller (fire-and-forget)
  if (r.cta_email || user.email) {
    const to = user.email || r.cta_email!
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
        <h2 style="color:#C9A84C;margin:0 0 12px">Votre site OFA est prêt</h2>
        <p>La deal room <b>${r.title}</b> vient d'être migrée vers un site OFA indépendant.</p>
        <p>
          <a href="${publicUrl}" style="display:inline-block;background:#C9A84C;color:#07090F;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Voir le site</a>
          &nbsp;
          <a href="${previewUrl}" style="display:inline-block;background:#fff;color:#07090F;border:1px solid #ccc;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Preview</a>
        </p>
        <p style="color:#555;font-size:13px">La page <code>/deal/${r.slug}</code> affichera désormais une redirection vers votre nouveau site.</p>
      </div>
    `
    sendResendEmail({ to, subject: `Votre site OFA est prêt — ${r.title}`, html }).catch(() => {})
  }

  return NextResponse.json({
    ok: true,
    site_id: site.id,
    site_slug: site.slug,
    public_url: publicUrl,
    preview_url: previewUrl,
    editor_url: `${OFA_BASE}/dashboard`,
  })
}
