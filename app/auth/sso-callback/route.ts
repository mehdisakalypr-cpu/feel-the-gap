import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { verifyExchangeToken, getUserAfterExchange } from "@/lib/gapup-sso/exchange-verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /auth/sso-callback?token=X
 *
 * Receives a single-use exchange token from hub.gapup.io/api/auth/exchange,
 * verifies it (HMAC + DB single-use), and sets a LOCAL gapup_session cookie
 * (signed HMAC with HUB_SHARED_SECRET) so the site middleware recognizes
 * this user. The cookie is scoped to THIS site's domain (no cross-domain
 * sharing — that's the whole point of the exchange flow).
 */

const COOKIE_NAME = "gapup_session";
const SESSION_TTL_DAYS = 30;

function sign(payload: string): string {
  const secret = process.env.HUB_SHARED_SECRET;
  if (!secret || secret.length < 32) throw new Error("HUB_SHARED_SECRET missing");
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function makeLocalSessionToken(userId: string): string {
  const exp = Date.now() + SESSION_TTL_DAYS * 86_400_000;
  const body = `${userId}|${exp}`;
  return Buffer.from(`${body}|${sign(body)}`).toString("base64url");
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.redirect(new URL("/auth/login?error=missing_token", req.url));
  }

  // Pin to this site's origin (defense-in-depth — exchange token is bound to a returnUrl)
  const result = await verifyExchangeToken(token, url.origin);
  if (!result) {
    return NextResponse.redirect(new URL("/auth/login?error=invalid_sso_token", req.url));
  }

  const user = await getUserAfterExchange(result.userId);
  if (!user) {
    return NextResponse.redirect(new URL("/auth/login?error=user_not_found", req.url));
  }

  // Mint local session cookie (HMAC, same format as hub gapup_session)
  const localToken = makeLocalSessionToken(user.id);
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(COOKIE_NAME, localToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 86_400,
  });
  return res;
}
