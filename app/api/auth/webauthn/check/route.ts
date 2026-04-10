import { NextRequest, NextResponse } from "next/server";
import { checkCredentialsForEmail } from "@/lib/webauthn";
import { supabaseAdmin } from "@/lib/supabase";

// Check if an email has biometric credentials registered
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ available: false, count: 0 });

  try {
    const result = await checkCredentialsForEmail(email);
    return NextResponse.json(result);
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
    const { data } = await sb
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();
    if (!data) return NextResponse.json({ ok: true });

    await sb.from("webauthn_credentials").delete().eq("user_id", data.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
