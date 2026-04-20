// © 2025-2026 Feel The Gap — public cart helpers (server-only)
// Anonymous carts use a cookie `ftg_cart_<storeId>` containing the cart UUID.
// On login, buyer_user_id is patched on the cart row so it survives across devices.

import 'server-only'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase-server'
import type { CartItem } from '@/components/store-public/_lib'

const ADMIN_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

/** Service-role client (bypasses RLS) — only used for anonymous cart writes */
function admin() {
  return createClient(ADMIN_URL, ADMIN_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const cookieKey = (storeId: string) => `ftg_cart_${storeId.replace(/-/g, '').slice(0, 16)}`

export interface CartRecord {
  id: string
  store_id: string
  buyer_user_id: string | null
  buyer_email: string | null
  items: CartItem[]
  subtotal_cents: number
  currency: string
  status: 'active' | 'abandoned' | 'converted' | 'expired'
}

interface CartRow {
  id: string
  store_id: string
  buyer_user_id: string | null
  buyer_email: string | null
  items: unknown
  subtotal_cents: number | null
  currency: string | null
  status: string
}

function rowToRecord(row: CartRow): CartRecord {
  const items = Array.isArray(row.items) ? (row.items as CartItem[]) : []
  return {
    id: row.id,
    store_id: row.store_id,
    buyer_user_id: row.buyer_user_id,
    buyer_email: row.buyer_email,
    items,
    subtotal_cents: row.subtotal_cents ?? 0,
    currency: row.currency ?? 'EUR',
    status: (['active', 'abandoned', 'converted', 'expired'].includes(row.status)
      ? row.status
      : 'active') as CartRecord['status'],
  }
}

/**
 * Read the cart for a store. Resolves the cart by user (preferred) or by cookie.
 * Returns null if no cart exists yet.
 */
export async function readCart(storeId: string): Promise<CartRecord | null> {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  const ck = await cookies()
  const cookieId = ck.get(cookieKey(storeId))?.value || null

  if (user) {
    const { data: row } = await admin()
      .from('store_carts')
      .select('id, store_id, buyer_user_id, buyer_email, items, subtotal_cents, currency, status')
      .eq('store_id', storeId)
      .eq('buyer_user_id', user.id)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (row) {
      // If the user just logged in but had a cookie cart, merge once
      if (cookieId && cookieId !== row.id) {
        await mergeCookieCartIntoUserCart(storeId, cookieId, row.id)
      }
      return rowToRecord(row as CartRow)
    }
    if (cookieId) {
      // Promote the cookie cart to a user-owned cart
      const { data: promoted } = await admin()
        .from('store_carts')
        .update({ buyer_user_id: user.id, buyer_email: user.email ?? null, updated_at: new Date().toISOString() })
        .eq('id', cookieId)
        .eq('store_id', storeId)
        .eq('status', 'active')
        .select('id, store_id, buyer_user_id, buyer_email, items, subtotal_cents, currency, status')
        .maybeSingle()
      if (promoted) return rowToRecord(promoted as CartRow)
    }
    return null
  }

  if (cookieId) {
    const { data: row } = await admin()
      .from('store_carts')
      .select('id, store_id, buyer_user_id, buyer_email, items, subtotal_cents, currency, status')
      .eq('id', cookieId)
      .eq('store_id', storeId)
      .eq('status', 'active')
      .maybeSingle()
    if (row) return rowToRecord(row as CartRow)
  }
  return null
}

/** Create or fetch a cart, ensuring a cookie is set for anonymous flows. */
export async function ensureCart(storeId: string): Promise<CartRecord> {
  const existing = await readCart(storeId)
  if (existing) return existing

  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()

  const { data: created, error } = await admin()
    .from('store_carts')
    .insert({
      store_id: storeId,
      buyer_user_id: user?.id ?? null,
      buyer_email: user?.email ?? null,
      items: [],
      subtotal_cents: 0,
      currency: 'EUR',
      status: 'active',
    })
    .select('id, store_id, buyer_user_id, buyer_email, items, subtotal_cents, currency, status')
    .single()
  if (error || !created) {
    throw new Error(`cart_create_failed: ${error?.message || 'unknown'}`)
  }
  if (!user) {
    const ck = await cookies()
    ck.set(cookieKey(storeId), created.id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
  }
  return rowToRecord(created as CartRow)
}

/** Replace items in a cart and recompute subtotal. */
export async function writeItems(cartId: string, items: CartItem[]): Promise<CartRecord> {
  const subtotal = items.reduce((acc, it) => acc + it.unit_price_cents * it.qty, 0)
  const { data, error } = await admin()
    .from('store_carts')
    .update({
      items,
      subtotal_cents: subtotal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cartId)
    .select('id, store_id, buyer_user_id, buyer_email, items, subtotal_cents, currency, status')
    .single()
  if (error || !data) throw new Error(`cart_write_failed: ${error?.message}`)
  return rowToRecord(data as CartRow)
}

/** Merge a cookie cart into the user cart (additive, qty summed by product+variant). */
async function mergeCookieCartIntoUserCart(storeId: string, cookieCartId: string, userCartId: string) {
  const a = admin()
  const { data: cookieRow } = await a
    .from('store_carts')
    .select('items, status')
    .eq('id', cookieCartId)
    .eq('store_id', storeId)
    .maybeSingle()
  if (!cookieRow || cookieRow.status !== 'active') return
  const cookieItems = Array.isArray(cookieRow.items) ? (cookieRow.items as CartItem[]) : []
  if (cookieItems.length === 0) return

  const { data: userRow } = await a
    .from('store_carts')
    .select('items')
    .eq('id', userCartId)
    .maybeSingle()
  const userItems = (Array.isArray(userRow?.items) ? userRow!.items : []) as CartItem[]

  const map = new Map<string, CartItem>()
  for (const it of [...userItems, ...cookieItems]) {
    const key = `${it.product_id}::${it.variant_id ?? ''}`
    const prev = map.get(key)
    if (prev) {
      prev.qty += it.qty
    } else {
      map.set(key, { ...it })
    }
  }
  const merged = Array.from(map.values())
  await writeItems(userCartId, merged)
  // Mark cookie cart as expired
  await a.from('store_carts')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('id', cookieCartId)
  const ck = await cookies()
  ck.delete(cookieKey(storeId))
}

/**
 * Mark a cart as converted (called after successful Stripe payment).
 */
export async function markCartConverted(cartId: string, orderId: string): Promise<void> {
  await admin()
    .from('store_carts')
    .update({
      status: 'converted',
      recovered_order_id: orderId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cartId)
}
