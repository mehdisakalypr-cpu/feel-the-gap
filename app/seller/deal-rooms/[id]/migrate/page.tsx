// © 2025-2026 Feel The Gap — Page de confirmation migration deal room → OFA standalone
// Volontairement isolée du back-office (pas un bouton inline) pour éviter migration accidentelle.

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import MigrateForm from './MigrateForm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

interface Room {
  id: string
  slug: string
  seller_id: string | null
  title: string
  summary: string | null
  product_label: string | null
  country_iso: string | null
  hero_image_url: string | null
  cta_email: string | null
  cta_phone: string | null
  cta_whatsapp: string | null
  status: string
  generated_site_id: string | null
  migrated_at: string | null
}

const OFA_BASE = process.env.OFA_PUBLIC_BASE_URL || 'https://one-for-all-app.vercel.app'

export default async function MigrateDealRoomPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect(`/login?next=/seller/deal-rooms/${id}/migrate`)

  const { data } = await admin()
    .from('deal_rooms')
    .select('id, slug, seller_id, title, summary, product_label, country_iso, hero_image_url, cta_email, cta_phone, cta_whatsapp, status, generated_site_id, migrated_at')
    .eq('id', id)
    .maybeSingle()
  if (!data) notFound()
  const room = data as Room
  if (room.seller_id !== user.id) notFound()

  const missing: string[] = []
  if (!room.title || room.title.trim().length < 4) missing.push('Titre (≥ 4 caractères)')
  if (!room.summary || room.summary.trim().length < 20) missing.push('Résumé (≥ 20 caractères)')
  if (!room.product_label || room.product_label.trim().length < 2) missing.push('Libellé produit')
  if (!room.hero_image_url) missing.push('Image hero')
  if (!room.cta_email && !room.cta_phone && !room.cta_whatsapp) missing.push('Au moins un CTA (email/phone/WhatsApp)')

  const statusOk = ['published', 'paused'].includes(room.status)

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12 text-neutral-100">
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Feel The Gap · Seller · Migration</p>
      <h1 className="mt-1 text-3xl font-semibold" style={{ color: '#C9A84C' }}>
        Migrer « {room.title} » vers OFA standalone
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-400">
        Votre deal room deviendra un site OFA indépendant (branding, back-office, SEO propre).
        La page <code className="rounded bg-white/10 px-1">/deal/{room.slug}</code> continuera d'exister
        avec un lien de redirection.
      </p>

      {room.generated_site_id ? (
        <section className="mt-8 rounded-2xl border border-violet-400/25 bg-violet-500/10 p-6">
          <h2 className="text-lg font-semibold text-violet-200">Déjà migrée</h2>
          <p className="mt-1 text-sm text-violet-100/80">
            Cette deal room a déjà été migrée{room.migrated_at && ` le ${new Date(room.migrated_at).toLocaleDateString('fr-FR')}`}.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <a
              href={`${OFA_BASE}/site/${room.slug}-ofa`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-violet-300/40 bg-violet-500/20 px-3 py-1.5 text-violet-100 hover:bg-violet-500/30"
            >
              Ouvrir mon site OFA
            </a>
            <Link
              href="/seller/deal-rooms"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 hover:bg-white/10"
            >
              ← Retour aux deal rooms
            </Link>
          </div>
        </section>
      ) : !statusOk ? (
        <section className="mt-8 rounded-2xl border border-yellow-400/25 bg-yellow-500/10 p-6">
          <h2 className="text-lg font-semibold text-yellow-100">Deal room non migrable</h2>
          <p className="mt-1 text-sm text-yellow-100/80">
            Le status actuel est <code>{room.status}</code>. Seules les deal rooms
            <code>published</code> ou <code>paused</code> peuvent être migrées.
          </p>
          <Link
            href={`/seller/deal-rooms/${room.id}`}
            className="mt-4 inline-block rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            Éditer la deal room
          </Link>
        </section>
      ) : missing.length > 0 ? (
        <section className="mt-8 rounded-2xl border border-red-400/25 bg-red-500/10 p-6">
          <h2 className="text-lg font-semibold text-red-100">Informations manquantes</h2>
          <p className="mt-1 text-sm text-red-100/80">
            Les champs suivants sont requis avant migration :
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-red-100/90">
            {missing.map(m => <li key={m}>{m}</li>)}
          </ul>
          <Link
            href={`/seller/deal-rooms/${room.id}`}
            className="mt-4 inline-block rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            Compléter la deal room
          </Link>
        </section>
      ) : (
        <>
          <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold">Aperçu avant / après</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                <p className="text-xs uppercase tracking-widest text-neutral-500">Avant</p>
                <p className="mt-1 text-sm text-neutral-300">Deal room mutualisée</p>
                <p className="mt-2 break-all text-xs text-neutral-400">
                  feel-the-gap.com/deal/<b className="text-white">{room.slug}</b>
                </p>
              </div>
              <div className="rounded-xl border border-[#C9A84C]/30 bg-[#C9A84C]/10 p-4">
                <p className="text-xs uppercase tracking-widest text-[#C9A84C]">Après</p>
                <p className="mt-1 text-sm text-neutral-200">Site OFA standalone (draft)</p>
                <p className="mt-2 break-all text-xs text-neutral-300">
                  {OFA_BASE.replace(/^https?:\/\//, '')}/site/<b className="text-[#C9A84C]">{room.slug}-ofa</b>
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-neutral-500">
              Le nouveau site sera créé en <b>draft</b>. Vous pourrez le publier depuis le back-office OFA
              après vérification du contenu et des images.
            </p>
          </section>

          <MigrateForm dealRoomId={room.id} defaultSlug={`${room.slug}-ofa`} dealSlug={room.slug} />
        </>
      )}
    </main>
  )
}
