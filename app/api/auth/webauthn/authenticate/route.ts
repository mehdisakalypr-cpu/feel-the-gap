import { NextRequest, NextResponse } from "next/server";
import { startAuthenticationForEmail, finishAuthentication } from "@/lib/webauthn";
import { supabaseAdmin } from "@/lib/supabase";

// POST — two actions: "start" and "finish"
export async function POST(req: NextRequest) {
  const body = await req.json();

  // Step 1: Start authentication — client sends { action: "start", email }
  if (body.action === "start") {
    const { email } = body;
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const result = await startAuthenticationForEmail(email);
    if (!result) return NextResponse.json({ available: false });

    return NextResponse.json({ available: true, options: result.options, userId: result.userId });
  }

  // Step 2: Finish authentication — client sends { action: "finish", userId, response }
  if (body.action === "finish") {
    const { userId, response } = body;
    try {
      const result = await finishAuthentication(userId, response);
      if (!result.verified) {
        return NextResponse.json({ error: "Verification failed" }, { status: 401 });
      }

      // Generate a magic link to sign in the user without password
      const sb = supabaseAdmin();
      const { data: userData } = await sb.auth.admin.getUserById(userId);
      if (!userData?.user?.email) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Generate a one-time login link
      const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
        type: "magiclink",
        email: userData.user.email,
      });

      if (linkErr || !linkData) {
        return NextResponse.json({ error: "Session creation failed" }, { status: 500 });
      }

      // Return the token hash + type for client to exchange
      const url = new URL(linkData.properties.action_link);
      const token_hash = url.searchParams.get("token_hash") || url.hash;

      return NextResponse.json({
        ok: true,
        token_hash: linkData.properties.hashed_token,
        email: userData.user.email,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      return NextResponse.json({ error: msg }, { status: 401 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
