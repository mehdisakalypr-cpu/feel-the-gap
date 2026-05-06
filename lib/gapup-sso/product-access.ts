/**
 * gapup-sso/product-access — query active subscriptions for a hub user.
 *
 * Calls Supabase RPC `hub_active_product_slugs(p_user_id uuid)` which returns
 * one row per active product. Cached in memory for SHORT_TTL to avoid a DB
 * call per request. Use `getProductAccessUncached` if you must skip cache
 * (e.g. just-after-checkout webhook).
 */
import { createClient } from "@supabase/supabase-js";

export type ActiveSubscription = {
  service_slug: string;
  status: string;
  current_period_end: string | null;
};

const SHORT_TTL_MS = 60_000; // 1 min cache per process
const cache = new Map<string, { exp: number; subs: ActiveSubscription[] }>();

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "gapup-sso: missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getProductAccess(userId: string): Promise<ActiveSubscription[]> {
  const hit = cache.get(userId);
  if (hit && hit.exp > Date.now()) return hit.subs;
  const subs = await getProductAccessUncached(userId);
  cache.set(userId, { exp: Date.now() + SHORT_TTL_MS, subs });
  return subs;
}

export async function getProductAccessUncached(
  userId: string
): Promise<ActiveSubscription[]> {
  const sb = client();
  const { data } = await sb.rpc("hub_active_product_slugs", { p_user_id: userId });
  return (data ?? []) as ActiveSubscription[];
}

export async function hasProductAccess(
  userId: string,
  serviceSlug: string
): Promise<boolean> {
  const subs = await getProductAccess(userId);
  return subs.some((s) => s.service_slug === serviceSlug);
}

/** Bust the per-process cache (e.g. after a webhook fires). */
export function invalidateProductAccess(userId?: string) {
  if (userId) cache.delete(userId);
  else cache.clear();
}
