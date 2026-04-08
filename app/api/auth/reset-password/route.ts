import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createHmac, timingSafeEqual } from "crypto";

const RESET_SECRET = process.env.RESET_TOKEN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "ftg-reset-fallback";

/**
 * Generate a short-lived HMAC token binding userId to a 10-minute window.
 */
export function makeResetToken(userId: string): string {
  const window = Math.floor(Date.now() / (10 * 60 * 1000)); // 10-min window
  const payload = `${userId}:${window}`;
  const sig = createHmac("sha256", RESET_SECRET).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

function verifyResetToken(token: string, userId: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const currentWindow = Math.floor(Date.now() / (10 * 60 * 1000));

  // Accept current window and previous (max ~20 min validity)
  for (const w of [currentWindow, currentWindow - 1]) {
    const payload = `${userId}:${w}`;
    const expectedSig = createHmac("sha256", RESET_SECRET).update(payload).digest("hex");
    try {
      const sigBuf = Buffer.from(parts[1], "hex");
      const expectedBuf = Buffer.from(expectedSig, "hex");
      if (sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

/**
 * GET — generate a reset token for a verified user (called after code exchange).
 * Requires a valid Supabase session (the temporary recovery session).
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const token = makeResetToken(userId);
  return NextResponse.json({ token });
}

/**
 * POST — update password using a verified HMAC reset token.
 * No Supabase session required (user is signed out), but token must be valid.
 */
export async function POST(req: NextRequest) {
  const { userId, password, resetToken } = await req.json();

  if (!userId || !password || !resetToken) {
    return NextResponse.json({ error: "Missing userId, password, or resetToken" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // Verify HMAC token
  if (!verifyResetToken(resetToken, userId)) {
    return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { error } = await sb.auth.admin.updateUserById(userId, { password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
