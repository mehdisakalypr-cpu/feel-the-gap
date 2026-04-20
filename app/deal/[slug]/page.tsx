// © 2025-2026 Feel The Gap — Deal Room publique mini-site
// Sous feel-the-gap.com/deal/[slug] : SEO mutualisé, CTA lead capture → seller.

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { LeadForm } from './LeadForm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 900 // 15 min ISR

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
}

interface DealRoomRow {
  id: string
  slug: string
  title: string
  summary: string | null
  product_label: string | null
  country_iso: string | null
  archetype: string | null
  hero_image_url: string | null
  gallery: Array<{ url: string; alt?: string }> | null
  price_range: { min?: number; max?: number; currency?: string; unit?: string } | null
  moq: string | null
  lead_time_days: number | null
  incoterms: string[] | null
  certifications: string[] | null
  cta_whatsapp: string | null
  cta_email: string | null
  cta_phone: string | null
  cta_form: boolean
  seo: { title?: string; description?: string; og_image?: string } | null
  status: string
  published_at: string | null
}

async function getRoom(slug: string): Promise<DealRoomRow | null> {
  const { data } = await sb()
    .from('deal_rooms')
    .select('id, slug, title, summary, product_label, country_iso, archetype, hero_image_url, gallery, price_range, moq, lead_time_days, incoterms, certifications, cta_whatsapp, cta_email, cta_phone, cta_form, seo, status, published_at')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()
  return data as DealRoomRow | null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const room = await getRoom(slug)
  if (!room) return { title: 'Deal room introuvable — Feel The Gap' }
  const title = room.seo?.title ?? `${room.title} · Feel The Gap`
  const description = room.seo?.description ?? room.summary ?? `Achetez directement ${room.product_label ?? 'ce produit'} auprès du producteur.`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: room.seo?.og_image ? [room.seo.og_image] : room.hero_image_url ? [room.hero_image_url] : [],
      type: 'website',
      url: `https://feel-the-gap.vercel.app/deal/${slug}`,
    },
    alternates: { canonical: `/deal/${slug}` },
  }
}

export default async function DealRoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const room = await getRoom(slug)
  if (!room) notFound()

  const accent = '#C9A84C'
  const gallery = Array.isArray(room.gallery) ? room.gallery : []

  return (
    <main className="min-h-screen bg-[#07090F] text-neutral-100">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        {room.hero_image_url && (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{ backgroundImage: `url(${room.hero_image_url})` }}
          />
        )}
        <div className="relative mx-auto flex max-w-6xl flex-col gap-4 px-6 py-20">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-neutral-400">
            <span>Feel The Gap</span>
            <span>·</span>
            <span>Deal Room</span>
            {room.country_iso && <><span>·</span><span>{room.country_iso}</span></>}
          </div>
          <h1 className="text-4xl font-semibold md:text-5xl" style={{ color: accent }}>{room.title}</h1>
          {room.product_label && <p className="text-lg text-neutral-300">{room.product_label}</p>}
          {room.summary && <p className="max-w-2xl text-base text-neutral-300">{room.summary}</p>}
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-12 lg:grid-cols-[1.6fr_1fr]">
        {/* Left: specs + gallery */}
        <div className="space-y-10">
          {/* Specs */}
          <section aria-label="Caractéristiques" className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-neutral-400">Caractéristiques</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {room.price_range?.min != null && (
                <div>
                  <dt className="text-neutral-500">Prix indicatif</dt>
                  <dd className="text-neutral-100">
                    {room.price_range.min}
                    {room.price_range.max ? ` – ${room.price_range.max}` : ''} {room.price_range.currency ?? ''}
                    {room.price_range.unit ? ` / ${room.price_range.unit}` : ''}
                  </dd>
                </div>
              )}
              {room.moq && (
                <div>
                  <dt className="text-neutral-500">Quantité minimum</dt>
                  <dd className="text-neutral-100">{room.moq}</dd>
                </div>
              )}
              {room.lead_time_days != null && (
                <div>
                  <dt className="text-neutral-500">Délai</dt>
                  <dd className="text-neutral-100">{room.lead_time_days} jours</dd>
                </div>
              )}
              {room.incoterms && room.incoterms.length > 0 && (
                <div>
                  <dt className="text-neutral-500">Incoterms</dt>
                  <dd className="text-neutral-100">{room.incoterms.join(' · ')}</dd>
                </div>
              )}
              {room.certifications && room.certifications.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-neutral-500">Certifications</dt>
                  <dd className="flex flex-wrap gap-2 text-neutral-100">
                    {room.certifications.map(c => (
                      <span key={c} className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs">{c}</span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Gallery */}
          {gallery.length > 0 && (
            <section aria-label="Galerie">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-neutral-400">Galerie</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {gallery.slice(0, 9).map((img, i) => (
                  <figure key={i} className="aspect-square overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.alt ?? room.title} loading="lazy" className="h-full w-full object-cover" />
                  </figure>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right: CTAs + form */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest" style={{ color: accent }}>Contact vendeur</h2>
            <div className="flex flex-col gap-2">
              {room.cta_whatsapp && (
                <a
                  href={`https://wa.me/${encodeURIComponent(room.cta_whatsapp.replace(/\D/g, ''))}?text=${encodeURIComponent(`Bonjour, je suis intéressé(e) par ${room.title} (vu sur Feel The Gap).`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500"
                  data-deal-cta="whatsapp" data-deal-slug={room.slug}
                >WhatsApp</a>
              )}
              {room.cta_email && (
                <a
                  href={`mailto:${room.cta_email}?subject=${encodeURIComponent(`Feel The Gap — ${room.title}`)}`}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold hover:bg-white/10"
                  data-deal-cta="email" data-deal-slug={room.slug}
                >Email</a>
              )}
              {room.cta_phone && (
                <a
                  href={`tel:${room.cta_phone}`}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold hover:bg-white/10"
                  data-deal-cta="phone" data-deal-slug={room.slug}
                >Appeler</a>
              )}
            </div>
          </div>

          {room.cta_form && (
            <LeadForm slug={room.slug} productLabel={room.product_label ?? room.title} />
          )}

          <p className="px-2 text-[11px] text-neutral-500">
            Opéré par Feel The Gap · <a href="/mentions-legales" className="underline">Mentions légales</a> · Les leads sont transmis au vendeur.
          </p>
        </aside>
      </div>
    </main>
  )
}
