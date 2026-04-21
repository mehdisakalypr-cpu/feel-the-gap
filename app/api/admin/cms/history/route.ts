import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from '@/lib/supabase-server'
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/admin/cms/history?content_id=xxx — list last 5 versions
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(); if (gate) return gate
  const contentId = req.nextUrl.searchParams.get("content_id");
  if (!contentId) return NextResponse.json({ error: "content_id required" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("cms_history")
    .select("*")
    .eq("content_id", contentId)
    .order("changed_at", { ascending: false })
    .limit(5);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/admin/cms/history — rollback to a specific version
export async function POST(req: NextRequest) {
  const gate = await requireAdmin(); if (gate) return gate
  const { history_id } = await req.json();
  if (!history_id) return NextResponse.json({ error: "history_id required" }, { status: 400 });

  const sb = supabaseAdmin();

  // Get the history entry
  const { data: hist, error: hErr } = await sb
    .from("cms_history")
    .select("*")
    .eq("id", history_id)
    .single();

  if (hErr || !hist) return NextResponse.json({ error: "History entry not found" }, { status: 404 });

  // Get current content (to save it as new history before rollback)
  const { data: current } = await sb
    .from("cms_content")
    .select("id, value_en, value_fr, metadata")
    .eq("id", hist.content_id)
    .single();

  if (current) {
    // Save current as history
    await sb.from("cms_history").insert({
      content_id: current.id,
      value_en: current.value_en,
      value_fr: current.value_fr,
      metadata: current.metadata,
    });
  }

  // Rollback: update content with history values
  const { data, error } = await sb
    .from("cms_content")
    .update({
      value_en: hist.value_en,
      value_fr: hist.value_fr,
      metadata: hist.metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", hist.content_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Keep only last 5
  const { data: allHist } = await sb
    .from("cms_history")
    .select("id")
    .eq("content_id", hist.content_id)
    .order("changed_at", { ascending: false });

  if (allHist && allHist.length > 5) {
    const toDelete = allHist.slice(5).map((h) => h.id);
    await sb.from("cms_history").delete().in("id", toDelete);
  }

  return NextResponse.json({ ok: true, restored: data });
}
