import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/supabase-server";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    return NextResponse.json(
      { error: "DEMO_PASSWORD env var not set" },
      { status: 500 }
    );
  }
  return NextResponse.json({ password });
}
