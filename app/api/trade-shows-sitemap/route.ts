import { NextResponse } from "next/server";
import { TRADE_SHOWS } from "@/lib/trade-shows";

export const runtime = "nodejs";
export const revalidate = 86400;

const BASE_URL = process.env.APP_URL || "https://www.gapup.io";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  xml += "  <url>\n";
  xml += `    <loc>${BASE_URL}/trade-shows</loc>\n`;
  xml += "    <changefreq>weekly</changefreq>\n";
  xml += "    <priority>0.8</priority>\n";
  xml += "  </url>\n";

  for (const show of TRADE_SHOWS) {
    xml += "  <url>\n";
    xml += `    <loc>${BASE_URL}/trade-shows/${escapeXml(show.slug)}</loc>\n`;
    xml += `    <lastmod>${show.startDate}</lastmod>\n`;
    xml += "    <changefreq>weekly</changefreq>\n";
    xml += "    <priority>0.7</priority>\n";
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
