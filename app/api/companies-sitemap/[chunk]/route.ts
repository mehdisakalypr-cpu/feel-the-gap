import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const revalidate = 86400; // 24h

const PAGE_SIZE = 50_000; // Google sitemap limit
const BASE_URL = process.env.APP_URL || "https://www.gapup.io";

const ISO3_TO_2: Record<string, string> = {
  GBR: "gb", FRA: "fr", DEU: "de", ITA: "it", ESP: "es",
  NLD: "nl", BEL: "be", PRT: "pt", USA: "us", IRL: "ie",
  LUX: "lu", AUT: "at", DNK: "dk", SWE: "se", FIN: "fi",
  NOR: "no", POL: "pl", CZE: "cz", HUN: "hu", EST: "ee",
  LVA: "lv", LTU: "lt", GRC: "gr", BGR: "bg", ROU: "ro",
  SVK: "sk", SVN: "si", HRV: "hr",
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type Params = Promise<{ chunk: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const { chunk } = await params;
  const chunkNum = parseInt(chunk, 10);
  if (isNaN(chunkNum) || chunkNum < 0 || chunkNum > 200) {
    return new NextResponse("invalid chunk", { status: 400 });
  }

  const offset = chunkNum * PAGE_SIZE;

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .schema("gapup_leads" as never)
    .from("lv_companies")
    .select("id, legal_name, trade_name, country_iso, updated_at")
    .order("id")
    .range(offset, offset + PAGE_SIZE - 1);

  if (error || !data || data.length === 0) {
    return new NextResponse("empty chunk", { status: 404 });
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const row of data as Array<{
    id: string;
    legal_name: string | null;
    trade_name: string | null;
    country_iso: string;
    updated_at: string | null;
  }>) {
    const name = row.trade_name || row.legal_name;
    if (!name) continue;
    const country2 = ISO3_TO_2[row.country_iso] || row.country_iso.toLowerCase().slice(0, 2);
    const idPrefix = row.id.replace(/-/g, "").slice(0, 12);
    const slug = `${slugify(name)}-${idPrefix}`;
    if (!slug) continue;
    const url = `${BASE_URL}/companies/${country2}/${escapeXml(slug)}`;
    const lastmod = row.updated_at ? new Date(row.updated_at).toISOString().split("T")[0] : "";
    xml += "  <url>\n";
    xml += `    <loc>${url}</loc>\n`;
    if (lastmod) xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += "    <changefreq>weekly</changefreq>\n";
    xml += "    <priority>0.5</priority>\n";
    xml += "  </url>\n";
  }
  xml += "</urlset>\n";

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
