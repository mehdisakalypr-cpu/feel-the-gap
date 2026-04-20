/**
 * Cart abandonment recovery — scheduler.
 *
 * NOTE EMPLACEMENT : ce fichier devrait idéalement vivre sous
 * `lib/cart-recovery/scheduler.ts` (cf. spec STORE_PLATFORM_SPEC_V2_ADDITIONS
 * §6.2.2). Il est colocalisé ici parce que le sandbox subagent n'a pas
 * accès à `/lib/` racine pour cette session — à déplacer dans un commit
 * suivant par un agent root. Les imports dans `route.ts` pointent vers ce
 * fichier `_scheduler.ts` (préfixe `_` → ignoré par le router Next.js).
 *
 * Vagues :
 *   1 → cart.updated_at < now - 1h  AND recovery_email_1_sent_at IS NULL
 *   2 → cart.updated_at < now - 24h AND recovery_email_2_sent_at IS NULL
 *                                   AND recovery_email_1_sent_at IS NOT NULL
 *   3 → cart.updated_at < now - 72h AND recovery_email_3_sent_at IS NULL
 *                                   AND recovery_email_2_sent_at IS NOT NULL
 *
 * Tous les paniers `status='active'` (les `abandoned/converted/expired` sont
 * filtrés). Limite de batch : 200 par vague pour éviter les timeouts.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type RecoveryWave = 1 | 2 | 3

export interface AbandonedCart {
  id: string
  store_id: string
  store_slug: string
  store_name: string
  buyer_user_id: string | null
  buyer_email: string | null
  items: Array<{
    product_id?: string
    variant_id?: string
    qty?: number
    name?: string
    price_cents?: number
    image_url?: string
  }>
  subtotal_cents: number
  currency: string
  updated_at: string
}

const BATCH_LIMIT = 200

let _admin: SupabaseClient | null = null
function getAdmin(): SupabaseClient {
  if (_admin) return _admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env missing (cart-recovery scheduler)')
  _admin = createClient(url, key, { auth: { persistSession: false } })
  return _admin
}

const HOURS = 60 * 60 * 1000
function cutoffFor(wave: RecoveryWave, now: Date): string {
  const offsetH = wave === 1 ? 1 : wave === 2 ? 24 : 72
  return new Date(now.getTime() - offsetH * HOURS).toISOString()
}

interface RawCartRow {
  id: string
  store_id: string
  buyer_user_id: string | null
  buyer_email: string | null
  items: AbandonedCart['items'] | null
  subtotal_cents: number
  currency: string
  updated_at: string
  stores: { slug: string; name: string } | { slug: string; name: string }[] | null
}

function normalizeStore(stores: RawCartRow['stores']): { slug: string; name: string } | null {
  if (!stores) return null
  if (Array.isArray(stores)) return stores[0] ?? null
  return stores
}

/**
 * Sélectionne les paniers à traiter pour la vague donnée.
 */
export async function findAbandonedCarts(now: Date, wave: RecoveryWave): Promise<AbandonedCart[]> {
  const db = getAdmin()
  const cutoff = cutoffFor(wave, now)

  let q = db
    .from('store_carts')
    .select(
      'id, store_id, buyer_user_id, buyer_email, items, subtotal_cents, currency, updated_at, stores ( slug, name )',
    )
    .eq('status', 'active')
    .lt('updated_at', cutoff)
    .gt('subtotal_cents', 0)
    .order('updated_at', { ascending: true })
    .limit(BATCH_LIMIT)

  if (wave === 1) {
    q = q.is('recovery_email_1_sent_at', null)
  } else if (wave === 2) {
    q = q.is('recovery_email_2_sent_at', null).not('recovery_email_1_sent_at', 'is', null)
  } else {
    q = q.is('recovery_email_3_sent_at', null).not('recovery_email_2_sent_at', 'is', null)
  }

  const { data, error } = await q
  if (error) throw new Error(`findAbandonedCarts wave=${wave}: ${error.message}`)

  const rows = (data ?? []) as RawCartRow[]
  return rows
    .map((r): AbandonedCart | null => {
      const store = normalizeStore(r.stores)
      if (!store) return null
      return {
        id: r.id,
        store_id: r.store_id,
        store_slug: store.slug,
        store_name: store.name,
        buyer_user_id: r.buyer_user_id,
        buyer_email: r.buyer_email,
        items: Array.isArray(r.items) ? r.items : [],
        subtotal_cents: r.subtotal_cents,
        currency: r.currency,
        updated_at: r.updated_at,
      }
    })
    .filter((c): c is AbandonedCart => c !== null)
}

/**
 * Marque le cart comme ayant reçu l'email de la vague donnée.
 * Idempotent : ne touche pas les autres timestamps.
 */
export async function markCartAbandoned(cartId: string, wave: RecoveryWave): Promise<void> {
  const db = getAdmin()
  const col =
    wave === 1
      ? 'recovery_email_1_sent_at'
      : wave === 2
      ? 'recovery_email_2_sent_at'
      : 'recovery_email_3_sent_at'

  const update: Record<string, unknown> = { [col]: new Date().toISOString() }
  // Vague 3 = on bascule le statut en 'abandoned' (terminal pour le funnel
  // recovery, le cart reste re-convertible si l'acheteur revient).
  if (wave === 3) update.status = 'abandoned'

  const { error } = await db.from('store_carts').update(update).eq('id', cartId)
  if (error) throw new Error(`markCartAbandoned cart=${cartId} wave=${wave}: ${error.message}`)
}

/**
 * Génère et insère un code promo unique pour la vague 3.
 * Format : RECOVER-XXXXXX (6 chars alphanum) — 10% par défaut, 1 usage, 7j de validité.
 *
 * Si la table `store_discount_codes` n'est pas accessible (env partiel),
 * on retourne un code "fictif" non persisté — l'email part quand même mais
 * le code ne sera pas activable. Log warn pour audit.
 */
export async function generateRecoveryDiscountCode(
  storeId: string,
  percent: number = 10,
): Promise<string> {
  const code = `RECOVER-${randomCode(6)}`
  const ends = new Date(Date.now() + 7 * 24 * HOURS).toISOString()
  try {
    const db = getAdmin()
    const { error } = await db.from('store_discount_codes').insert({
      store_id: storeId,
      code,
      discount_type: 'percent',
      discount_value: percent,
      max_uses: 1,
      used_count: 0,
      ends_at: ends,
      applies_to: 'cart',
      active: true,
    })
    if (error) {
      console.warn('[cart-recovery] discount insert failed', error.message)
    }
  } catch (err) {
    console.warn('[cart-recovery] discount insert exception', err)
  }
  return code
}

function randomCode(len: number): string {
  // Évite I/O/0/1 pour lisibilité
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}
