import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Server-side password update using admin privileges.
 * The client exchanges the recovery code, extracts the user ID,
 * signs out immediately, then calls this endpoint to update the password.
 * This prevents the recovery session from being used to access the app.
 */
export async function POST(req: NextRequest) {
  const { userId, password } = await req.json();

  if (!userId || !password) {
    return NextResponse.json({ error: "Missing userId or password" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { error } = await sb.auth.admin.updateUserById(userId, { password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
