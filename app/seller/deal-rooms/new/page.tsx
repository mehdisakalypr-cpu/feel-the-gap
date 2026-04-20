// © 2025-2026 Feel The Gap — Seller : nouvelle deal room

import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { NewDealRoomForm } from './NewDealRoomForm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function NewDealRoomPage() {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/seller/deal-rooms/new')

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12 text-neutral-100">
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Feel The Gap · Seller</p>
      <h1 className="mt-1 text-3xl font-semibold" style={{ color: '#C9A84C' }}>Nouvelle deal room</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Créez un mini-site sous <code>feel-the-gap.com/deal/…</code> pour transformer une opportunité en leads qualifiés.
      </p>
      <NewDealRoomForm defaultEmail={user.email ?? ''} />
    </main>
  )
}
