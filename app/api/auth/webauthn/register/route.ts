import { NextRequest, NextResponse } from "next/server";
import { startRegistration, finishRegistration } from "@/lib/webauthn";
import { cookies, headers } from "next/headers";
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

  const h = await headers();
  const host = h.get("host");
  const options = await startRegistration(user.id, user.email ?? user.id, host);
  return NextResponse.json(options);
}

// POST — finish registration
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const h = await headers();
  const host = h.get("host");
  const { response, deviceName } = await req.json();
  try {
    const result = await finishRegistration(user.id, response, deviceName, host);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Registration failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
