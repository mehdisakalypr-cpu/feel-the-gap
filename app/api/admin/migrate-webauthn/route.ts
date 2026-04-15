import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/supabase-server";

export async function GET() {
  const gate = await requireAdmin(); if (gate) return gate;
  const sb = supabaseAdmin();

  try {
    // Test if rp_id column exists
    const { error: testErr } = await sb
      .from("webauthn_credentials")
      .select("rp_id")
      .limit(1);

    if (testErr && testErr.message.includes("rp_id")) {
      return NextResponse.json({
        error:
          "Column rp_id does not exist. Run in Supabase SQL Editor: ALTER TABLE webauthn_credentials ADD COLUMN IF NOT EXISTS rp_id text;",
        needsManualMigration: true,
      });
    }

    // Column exists — backfill old credentials with duckdns rpId
    const { data: updated } = await sb
      .from("webauthn_credentials")
      .update({ rp_id: "feel-the-gap.duckdns.org" })
      .is("rp_id", null)
      .select("id");

    return NextResponse.json({
      ok: true,
      updated: updated?.length ?? 0,
      message: "Migration complete — old credentials tagged as duckdns",
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
