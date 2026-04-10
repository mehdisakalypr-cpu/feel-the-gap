import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/admin/cms?site=ftg&collection=landing
export async function GET(req: NextRequest) {
  const site = req.nextUrl.searchParams.get("site");
  const collection = req.nextUrl.searchParams.get("collection");
  const sb = supabaseAdmin();

  let query = sb.from("cms_content").select("*").order("order");
  if (site) query = query.eq("site", site);
  if (collection) query = query.eq("collection", collection);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/admin/cms — upsert a content entry + save history
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { site, collection, slug, field_type, value_en, value_fr, metadata, order, published } = body;
  if (!site || !collection || !slug) {
    return NextResponse.json({ error: "site, collection, slug required" }, { status: 400 });
  }

  const sb = supabaseAdmin();

  // Check if entry exists (for history)
  const { data: existing } = await sb
    .from("cms_content")
    .select("id, value_en, value_fr, metadata")
    .eq("site", site)
    .eq("collection", collection)
    .eq("slug", slug)
    .single();

  // Upsert
  const row = {
    site,
    collection,
    slug,
    field_type: field_type ?? "text",
    value_en: value_en ?? "",
    value_fr: value_fr ?? "",
    metadata: metadata ?? {},
    order: order ?? 0,
    published: published ?? true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await sb
    .from("cms_content")
    .upsert(row, { onConflict: "site,collection,slug" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Save previous version to history (if content changed)
  if (existing && (existing.value_en !== value_en || existing.value_fr !== value_fr)) {
    await sb.from("cms_history").insert({
      content_id: data.id,
      value_en: existing.value_en,
      value_fr: existing.value_fr,
      metadata: existing.metadata,
    });

    // Keep only last 5 history entries per content
    const { data: history } = await sb
      .from("cms_history")
      .select("id")
      .eq("content_id", data.id)
      .order("changed_at", { ascending: false });

    if (history && history.length > 5) {
      const toDelete = history.slice(5).map((h) => h.id);
      await sb.from("cms_history").delete().in("id", toDelete);
    }
  }

  return NextResponse.json(data);
}

// DELETE /api/admin/cms?id=xxx
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("cms_content").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
