import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// One-shot migration endpoint to create cms_content table
// Call: GET /api/admin/cms-migrate
export async function GET() {
  const sb = supabaseAdmin();

  try {
    // Test if table already exists
    const { error: testErr } = await sb
      .from("cms_content")
      .select("id")
      .limit(1);

    if (!testErr) {
      return NextResponse.json({ ok: true, message: "Table cms_content already exists" });
    }

    // Table doesn't exist — return SQL for manual creation
    return NextResponse.json({
      needsManualMigration: true,
      message: "Run this SQL in Supabase Dashboard → SQL Editor",
      sql: `
create table if not exists cms_content (
  id          uuid primary key default gen_random_uuid(),
  site        text not null,
  collection  text not null,
  slug        text not null,
  field_type  text not null default 'text',
  value_en    text default '',
  value_fr    text default '',
  metadata    jsonb default '{}',
  "order"     integer default 0,
  published   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(site, collection, slug)
);

alter table cms_content enable row level security;
create policy "Public read cms_content" on cms_content for select using (true);
create policy "Service write cms_content" on cms_content for all using (true) with check (true);

create index if not exists idx_cms_content_site_collection on cms_content(site, collection);
      `.trim(),
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
