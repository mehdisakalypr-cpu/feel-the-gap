import { NextRequest, NextResponse } from "next/server";
import { getCredentials } from "@/lib/webauthn";
import { supabaseAdmin } from "@/lib/supabase";

// Check if an email has biometric credentials registered
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ available: false, count: 0 });

  try {
    const sb = supabaseAdmin();
    const { data } = await sb.auth.admin.listUsers();
    const user = data?.users?.find((u) => u.email === email);
    if (!user) return NextResponse.json({ available: false, count: 0 });

    const creds = await getCredentials(user.id);
    return NextResponse.json({ available: creds.length > 0, count: creds.length });
  } catch {
    return NextResponse.json({ available: false, count: 0 });
  }
}

// DELETE — remove all biometric credentials for an email (reset)
export async function DELETE(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ ok: false });

  try {
    const sb = supabaseAdmin();
    const { data } = await sb.auth.admin.listUsers();
    const user = data?.users?.find((u) => u.email === email);
    if (!user) return NextResponse.json({ ok: true });

    // Delete all webauthn credentials for this user
    await sb.from("webauthn_credentials").delete().eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
