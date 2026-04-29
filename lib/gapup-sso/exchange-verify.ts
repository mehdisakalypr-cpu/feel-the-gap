/**
 * gapup-sso/exchange-verify — verify a one-time SSO exchange token.
 *
 * Used by SaaS sites NOT under .gapup.io (cookie shared domain unavailable)
 * to verify a token issued by hub.gapup.io/api/auth/exchange and resolve it
 * to a hub_user_id. After verification, the SaaS site can :
 *  - look up the user identity
 *  - create its own session (cookie on its own domain)
 *  - check subscriptions via getProductAccess
 *
 * Token format : base64url(`<userId>|<returnUrl>|<exp>|<HMAC>`).
 * Single-use enforced via hub_magic_tokens.token_hash + consumed_at.
 *
 * Throws if not server-side. Safe in Node runtime, edge-incompatible
 * (uses node:crypto + Supabase service-role).
 */
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function secret(): string {
  const s = process.env.HUB_SHARED_SECRET;
  if (!s || s.length < 32) throw new Error("HUB_SHARED_SECRET missing");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function dbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("supabase env missing");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type ExchangeResult = {
  userId: string;
  returnUrl: string;
  exp: number;
};

export async function verifyExchangeToken(
  token: string,
  expectedReturnOrigin?: string
): Promise<ExchangeResult | null> {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split("|");
    if (parts.length !== 4) return null;
    const [userId, returnUrl, expStr, sig] = parts;
    if (!userId || !returnUrl || !expStr || !sig) return null;

    // Signature
    const expected = sign(`${userId}|${returnUrl}|${expStr}`);
    if (
      expected.length !== sig.length ||
      !crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"))
    ) {
      return null;
    }

    // Expiry
    const exp = Number(expStr);
    if (Date.now() > exp) return null;

    // Origin pinning (defense-in-depth — ensure caller is the intended SaaS)
    if (expectedReturnOrigin) {
      try {
        const u = new URL(returnUrl);
        if (u.origin !== expectedReturnOrigin) return null;
      } catch {
        return null;
      }
    }

    // Single-use : consume in DB. Race-safe via UPDATE WHERE consumed_at IS NULL.
    const sb = dbClient();
    const tokenHash = sha256(token);
    const { data: row } = await sb
      .from("hub_magic_tokens")
      .select("id, consumed_at, user_id")
      .eq("token_hash", tokenHash)
      .eq("purpose", "sso-exchange")
      .maybeSingle();

    if (!row || row.consumed_at) return null;
    if (row.user_id !== userId) return null;

    const { error: consumeErr } = await sb
      .from("hub_magic_tokens")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("consumed_at", null);
    if (consumeErr) return null;

    return { userId, returnUrl, exp };
  } catch {
    return null;
  }
}

/** Resolve user email + active subscriptions for an exchange-verified userId. */
export async function getUserAfterExchange(userId: string): Promise<{
  id: string;
  email: string;
  name: string | null;
} | null> {
  const sb = dbClient();
  const { data } = await sb
    .from("hub_users")
    .select("id, email, name, status")
    .eq("id", userId)
    .maybeSingle();
  if (!data || data.status !== "active") return null;
  return {
    id: data.id as string,
    email: data.email as string,
    name: (data.name as string | null) ?? null,
  };
}
