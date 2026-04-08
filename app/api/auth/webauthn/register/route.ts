import { NextRequest, NextResponse } from "next/server";
import { createSupabaseBrowser } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { startRegistration, finishRegistration } from "@/lib/webauthn";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

async function getUser() {
  const jar = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => jar.getAll() } }
  );
  const { data } = await sb.auth.getUser();
  return data?.user ?? null;
}

// GET — start registration
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const options = await startRegistration(user.id, user.email ?? user.id);
  return NextResponse.json(options);
}

// POST — finish registration
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { response, deviceName } = await req.json();
  try {
    const result = await finishRegistration(user.id, response, deviceName);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Registration failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
