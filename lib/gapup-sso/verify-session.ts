/**
 * gapup-sso/verify-session — HMAC-signed session token verification.
 *
 * The cookie value is base64url(`<userId>|<exp>|<sig>`). The signature is
 * HMAC-SHA256(`<userId>|<exp>`, AUTH_SECRET). No DB call required for the
 * identity check; the cookie is self-contained and tamper-evident.
 *
 * For session revocation, query `hub_sessions` (token_hash) — see
 * `is-session-revoked.ts`. Most callers don't need that; revocation is a
 * defense-in-depth knob, not a hot-path requirement.
 */
import crypto from "node:crypto";
import { cookies } from "next/headers";

export const HUB_COOKIE_NAME = "gapup_session";

function secret(): string {
  const s = process.env.HUB_SHARED_SECRET;
  if (!s || s.length < 32) {
    throw new Error("HUB_SHARED_SECRET must be set and >= 32 chars (shared with hub)");
  }
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

export type HubSession = {
  userId: string;
  exp: number;
  /** raw token (use to query hub_sessions for revocation) */
  raw: string;
};

export function verifyHubToken(token: string): HubSession | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [userId, expStr, sig] = decoded.split("|");
    if (!userId || !expStr || !sig) return null;
    const expected = sign(`${userId}|${expStr}`);
    if (
      expected.length !== sig.length ||
      !crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"))
    ) {
      return null;
    }
    const exp = Number(expStr);
    if (Date.now() > exp) return null;
    return { userId, exp, raw: token };
  } catch {
    return null;
  }
}

/** Read the gapup_session cookie from Next.js server context and verify. */
export async function verifyHubSession(): Promise<HubSession | null> {
  const c = await cookies();
  const tok = c.get(HUB_COOKIE_NAME)?.value;
  if (!tok) return null;
  return verifyHubToken(tok);
}

/** Read the gapup_session cookie from a raw Cookie header (e.g. middleware). */
export function verifyHubSessionFromHeader(
  cookieHeader: string | null | undefined
): HubSession | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${HUB_COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return verifyHubToken(decodeURIComponent(match[1]));
}
