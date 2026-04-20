// © 2025-2026 Feel The Gap — Seller : leads d'une deal room

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
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

interface Props { params: Promise<{ id: string }> }

export default async function DealRoomLeadsPage({ params }: Props) {
  const { id } = await params
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect(`/login?next=/seller/deal-rooms/${id}/leads`)

  const a = admin()
  const { data: room } = await a
    .from('deal_rooms')
    .select('id, slug, title, seller_id, product_label')
    .eq('id', id)
    .maybeSingle()
  if (!room || room.seller_id !== user.id) notFound()

  const { data: leads } = await a
    .from('deal_room_leads')
    .select('id, channel, buyer_name, buyer_email, buyer_phone, buyer_country, company, qty_requested, message, status, created_at')
    .eq('deal_room_id', id)
    .order('created_at', { ascending: false })
    .limit(100)

  const list = (leads ?? []) as Array<{
    id: string; channel: string; buyer_name: string | null; buyer_email: string | null
    buyer_phone: string | null; buyer_country: string | null; company: string | null
    qty_requested: string | null; message: string | null; status: string; created_at: string
  }>

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12 text-neutral-100">
      <nav className="mb-6 text-xs text-neutral-500">
        <Link href="/seller/deal-rooms" className="hover:text-neutral-300">Mes deal rooms</Link>
        {' / '}
        <Link href={`/deal/${room.slug}`} className="hover:text-neutral-300" target="_blank">{room.title}</Link>
      </nav>

      <h1 className="text-3xl font-semibold" style={{ color: '#C9A84C' }}>Leads reçus</h1>
      <p className="mt-1 text-sm text-neutral-400">
        {list.length} lead{list.length > 1 ? 's' : ''} — produit : {room.product_label ?? '—'}
      </p>

      {list.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
          <p className="text-neutral-300">Aucun lead pour le moment.</p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {list.map(l => (
            <li key={l.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full bg-white/10 px-2 py-0.5 uppercase tracking-widest text-neutral-300">{l.channel}</span>
                <StatusPill status={l.status} />
                <span className="ml-auto text-neutral-500">{new Date(l.created_at).toLocaleString('fr-FR')}</span>
              </div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
                <Info label="Nom" value={l.buyer_name} />
                <Info label="Email" value={l.buyer_email} copyable />
                <Info label="Téléphone" value={l.buyer_phone} copyable />
                <Info label="Pays" value={l.buyer_country} />
                <Info label="Société" value={l.company} />
                <Info label="Quantité demandée" value={l.qty_requested} />
              </div>
              {l.message && (
                <p className="mt-3 whitespace-pre-wrap rounded-lg border border-white/5 bg-black/30 p-3 text-sm text-neutral-300">
                  {l.message}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function Info({ label, value }: { label: string; value: string | null; copyable?: boolean }) {
  if (!value) return null
  return (
    <div className="text-sm">
      <span className="text-neutral-500">{label} : </span>
      <span className="text-neutral-100">{value}</span>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    new: { label: 'Nouveau', bg: 'rgba(52,211,153,.15)', color: '#6EE7B7' },
    contacted: { label: 'Contacté', bg: 'rgba(96,165,250,.15)', color: '#93C5FD' },
    qualified: { label: 'Qualifié', bg: 'rgba(201,168,76,.18)', color: '#FCD34D' },
    closed_won: { label: 'Gagné', bg: 'rgba(52,211,153,.25)', color: '#6EE7B7' },
    closed_lost: { label: 'Perdu', bg: 'rgba(239,68,68,.15)', color: '#FCA5A5' },
    spam: { label: 'Spam', bg: 'rgba(156,163,175,.12)', color: '#9CA3AF' },
  }
  const s = map[status] ?? map.new
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}
