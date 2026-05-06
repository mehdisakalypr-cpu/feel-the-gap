/**
 * gapup-sso — public surface.
 *
 * Import in a SaaS site as:
 *   import { verifyHubSession, hasProductAccess } from "@/lib/gapup-sso";
 *
 * Server-only. AUTH_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY must be
 * set in the SaaS site env (same values as hub).
 */
export {
  verifyHubSession,
  verifyHubToken,
  verifyHubSessionFromHeader,
  HUB_COOKIE_NAME,
  type HubSession,
} from "./verify-session";

export {
  getProductAccess,
  getProductAccessUncached,
  hasProductAccess,
  invalidateProductAccess,
  type ActiveSubscription,
} from "./product-access";

/** Convenience: verify + check access in one call. */
import { verifyHubSession } from "./verify-session";
import { hasProductAccess } from "./product-access";
export async function requireProductAccess(serviceSlug: string): Promise<{
  userId: string;
  exp: number;
} | null> {
  const session = await verifyHubSession();
  if (!session) return null;
  const allowed = await hasProductAccess(session.userId, serviceSlug);
  if (!allowed) return null;
  return { userId: session.userId, exp: session.exp };
}

export {
  verifyExchangeToken,
  getUserAfterExchange,
  type ExchangeResult,
} from "./exchange-verify";
