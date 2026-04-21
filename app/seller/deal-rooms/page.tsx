// © 2025-2026 Feel The Gap — Seller back-office : gérer mes deal rooms

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

interface RoomRow {
  id: string
  slug: string
  title: string
  product_label: string | null
  country_iso: string | null
  status: string
  published_at: string | null
  created_at: string
}

interface LeadCount { deal_room_id: string; leads_count: number; leads_new: number }

export default async function SellerDealRoomsPage() {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/seller/deal-rooms')

  const { data } = await admin()
    .from('deal_rooms')
    .select('id, slug, title, product_label, country_iso, status, published_at, created_at')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })
  const rooms = (data ?? []) as RoomRow[]

  // Lead counts per room (single roundtrip)
  const roomIds = rooms.map(r => r.id)
  let leadMap = new Map<string, { total: number; fresh: number }>()
  if (roomIds.length > 0) {
    const { data: leads } = await admin()
      .from('deal_room_leads')
      .select('deal_room_id, status')
      .in('deal_room_id', roomIds)
    for (const l of (leads ?? []) as Array<{ deal_room_id: string; status: string }>) {
      const cur = leadMap.get(l.deal_room_id) ?? { total: 0, fresh: 0 }
      cur.total += 1
      if (l.status === 'new') cur.fresh += 1
      leadMap.set(l.deal_room_id, cur)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12 text-neutral-100">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Feel The Gap · Seller</p>
          <h1 className="mt-1 text-3xl font-semibold" style={{ color: '#C9A84C' }}>Mes deal rooms</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Chaque deal room est un mini-site hébergé sous <code>feel-the-gap.com/deal/…</code>
            — SEO mutualisé, leads routés vers vous par email.
          </p>
        </div>
        <Link
          href="/seller/deal-rooms/new"
          className="rounded-xl bg-[#C9A84C] px-4 py-2.5 text-sm font-semibold text-[#07090F] hover:bg-[#d6b658]"
        >+ Créer une deal room</Link>
      </header>

      {rooms.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
          <p className="text-neutral-300">Aucune deal room pour le moment.</p>
          <p className="mt-2 text-sm text-neutral-500">
            Une deal room transforme une opportunité FTG en mini-site prêt à recevoir des acheteurs.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rooms.map(r => {
            const counts = leadMap.get(r.id) ?? { total: 0, fresh: 0 }
            return (
              <li key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest">
                  <StatusBadge status={r.status} />
                  {r.country_iso && <span className="text-neutral-500">· {r.country_iso}</span>}
                  {counts.fresh > 0 && (
                    <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      {counts.fresh} nouveau{counts.fresh > 1 ? 'x' : ''}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-semibold">{r.title}</h3>
                {r.product_label && <p className="text-sm text-neutral-400">{r.product_label}</p>}
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  {r.status === 'published' && (
                    <Link
                      href={`/deal/${r.slug}`}
                      target="_blank"
                      className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 hover:bg-white/10"
                    >Voir la page</Link>
                  )}
                  <Link
                    href={`/seller/deal-rooms/${r.id}`}
                    className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 hover:bg-white/10"
                  >Éditer</Link>
                  <Link
                    href={`/seller/deal-rooms/${r.id}/leads`}
                    className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 hover:bg-white/10"
                  >Leads ({counts.total})</Link>
                  {(r.status === 'published' || r.status === 'paused') && (
                    <Link
                      href={`/seller/deal-rooms/${r.id}/migrate`}
                      className="rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-2.5 py-1 text-[#C9A84C] hover:bg-[#C9A84C]/20"
                    >↗ Migrer vers OFA</Link>
                  )}
                  {r.status === 'migrated_to_standalone' && (
                    <Link
                      href={`/seller/deal-rooms/${r.id}/migrate`}
                      className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-violet-200 hover:bg-violet-500/20"
                    >Voir site OFA</Link>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    draft: { label: 'Brouillon', bg: 'rgba(156,163,175,.15)', color: '#D1D5DB' },
    published: { label: 'Publiée', bg: 'rgba(52,211,153,.15)', color: '#6EE7B7' },
    paused: { label: 'En pause', bg: 'rgba(251,191,36,.15)', color: '#FCD34D' },
    migrated_to_standalone: { label: 'Migrée OFA', bg: 'rgba(168,85,247,.15)', color: '#C4B5FD' },
    archived: { label: 'Archivée', bg: 'rgba(239,68,68,.12)', color: '#FCA5A5' },
  }
  const s = map[status] ?? map.draft
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}
