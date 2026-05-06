import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const companyName = String(body?.companyName ?? "").trim();
    const profileUrl = String(body?.profileUrl ?? "").trim();
    const reason = String(body?.reason ?? "").trim();
    const proof = String(body?.proof ?? "").trim();

    if (!EMAIL_RX.test(email)) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }
    if (companyName.length < 2 || companyName.length > 200) {
      return NextResponse.json({ error: "invalid_company_name" }, { status: 400 });
    }
    if (reason.length < 5 || reason.length > 2000) {
      return NextResponse.json({ error: "invalid_reason" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent")?.slice(0, 200) ?? null;

    const sb = supabaseAdmin();
    // Best-effort log to a generic table; fall back to console if missing.
    const row = {
      email,
      kind: "company_profile_removal",
      payload: {
        companyName,
        profileUrl: profileUrl.slice(0, 500),
        reason: reason.slice(0, 2000),
        proof: proof.slice(0, 1000),
      },
      ip,
      user_agent: ua,
      created_at: new Date().toISOString(),
    };
    const { error } = await sb.from("rgpd_requests").insert(row);
    if (error) {
      // If table doesn't exist, log to console — request still goes through
      // (a follow-up cron / manual review will pick it up).
      console.warn("[rgpd_requests insert]", error.message, row);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
