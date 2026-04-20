// © 2025-2026 Feel The Gap — server helper to load store + chrome props in one call

import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getStoreBySlug, type StoreContext } from './account/_lib/store-auth'
import { readCart } from './_cart'

export interface ChromeData {
  store: StoreContext
  user: { id: string; email: string | null } | null
  cartCount: number
  cartId: string | null
}

export async function loadChrome(slug: string): Promise<ChromeData> {
  const store = await getStoreBySlug(slug)
  if (!store) notFound()
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  const cart = await readCart(store.id).catch(() => null)
  const cartCount = cart ? cart.items.reduce((acc, it) => acc + (it.qty ?? 0), 0) : 0
  return {
    store,
    user: user ? { id: user.id, email: user.email ?? null } : null,
    cartCount,
    cartId: cart?.id ?? null,
  }
}
