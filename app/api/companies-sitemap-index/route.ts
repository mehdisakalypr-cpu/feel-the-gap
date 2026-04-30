import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const revalidate = 86400;

const PAGE_SIZE = 50_000;
const BASE_URL = process.env.APP_URL || "https://www.gapup.io";

export async function GET() {
  const sb = supabaseAdmin();
  const { count, error } = await sb
    .schema("gapup_leads" as never)
    .from("lv_companies")
    .select("id", { count: "exact", head: true });

  if (error || count === null) {
    return new NextResponse("count error", { status: 500 });
  }

  const numChunks = Math.ceil(count / PAGE_SIZE);
  const today = new Date().toISOString().split("T")[0];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (let i = 0; i < numChunks; i++) {
    xml += "  <sitemap>\n";
    xml += `    <loc>${BASE_URL}/api/companies-sitemap/${i}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += "  </sitemap>\n";
  }

  xml += "</sitemapindex>\n";

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
