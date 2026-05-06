import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import type { Metadata } from "next";

export const dynamicParams = true;
export const revalidate = 86400; // 24h ISR

type Company = {
  id: string;
  legal_name: string | null;
  trade_name: string | null;
  domain: string | null;
  country_iso: string;
  region: string | null;
  city: string | null;
  postal_code: string | null;
  address: string | null;
  nace_code: string | null;
  sic_code: string | null;
  industry_tags: string[] | null;
  is_import_export: boolean | null;
  size_bucket: string | null;
  employees_estimate: number | null;
  revenue_estimate_eur: number | null;
  founded_year: number | null;
  status: string | null;
  primary_source: string | null;
  siren: string | null;
  crn: string | null;
  vat_number: string | null;
};

function isoToLower(iso: string): string {
  if (iso.length === 3) {
    const map: Record<string, string> = {
      GBR: "gb", FRA: "fr", DEU: "de", ITA: "it", ESP: "es",
      NLD: "nl", BEL: "be", PRT: "pt", USA: "us", IRL: "ie",
      LUX: "lu", AUT: "at", DNK: "dk", SWE: "se", FIN: "fi",
      NOR: "no", POL: "pl", CZE: "cz", HUN: "hu", EST: "ee",
      LVA: "lv", LTU: "lt", GRC: "gr", BGR: "bg", ROU: "ro",
      SVK: "sk", SVN: "si", HRV: "hr",
    };
    return map[iso] || iso.toLowerCase().slice(0, 2);
  }
  return iso.toLowerCase();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function extractIdPrefix(slug: string): string | null {
  // Slug ends with -[12-char-hex-prefix]
  const m = slug.match(/-([a-f0-9]{12})$/);
  return m ? m[1]! : null;
}

async function fetchCompany(country: string, slug: string): Promise<Company | null> {
  const idPrefix = extractIdPrefix(slug);
  if (!idPrefix) return null;
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .schema("gapup_leads" as never)
    .from("lv_companies")
    .select(
      "id, legal_name, trade_name, domain, country_iso, region, city, postal_code, address, nace_code, sic_code, industry_tags, is_import_export, size_bucket, employees_estimate, revenue_estimate_eur, founded_year, status, primary_source, siren, crn, vat_number",
    )
    .ilike("id", `${idPrefix}%`)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  if (isoToLower(data.country_iso) !== country.toLowerCase()) return null;
  return data as Company;
}

// Escape JSON-LD output to prevent XSS via </script> injection.
function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

type RouteParams = Promise<{ country: string; slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: RouteParams;
}): Promise<Metadata> {
  const { country, slug } = await params;
  const c = await fetchCompany(country, slug);
  if (!c) return { title: "Company not found · Feel The Gap" };

  const name = c.trade_name || c.legal_name || "Unnamed";
  const desc = `${name} · ${[c.city, c.country_iso].filter(Boolean).join(", ")}${c.nace_code ? ` · NACE ${c.nace_code}` : ""}. Trade flow data, founded ${c.founded_year || "—"}, registered ${c.primary_source || "public registry"}.`;

  return {
    title: `${name} — Trade Profile · Feel The Gap`,
    description: desc.slice(0, 160),
    alternates: {
      canonical: `https://www.gapup.io/companies/${country}/${slug}`,
    },
    openGraph: {
      title: `${name} — Trade Profile`,
      description: desc.slice(0, 200),
      type: "website",
    },
    robots: c.legal_name ? "index,follow" : "noindex",
  };
}

export default async function CompanyPage({
  params,
}: {
  params: RouteParams;
}) {
  const { country, slug } = await params;
  const c = await fetchCompany(country, slug);
  if (!c) notFound();

  const displayName = c.trade_name || c.legal_name || "Unnamed Company";
  const cityCountry = [c.city, c.country_iso].filter(Boolean).join(", ");
  const fmtNum = (n: number | null) =>
    n ? new Intl.NumberFormat("en", { notation: "compact" }).format(n) : "—";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: c.legal_name,
    alternateName: c.trade_name || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: c.address || undefined,
      addressLocality: c.city || undefined,
      addressRegion: c.region || undefined,
      postalCode: c.postal_code || undefined,
      addressCountry: c.country_iso,
    },
    url: c.domain ? `https://${c.domain}` : undefined,
    foundingDate: c.founded_year ? `${c.founded_year}` : undefined,
    identifier: c.siren || c.crn || c.vat_number || c.id,
    naics: c.sic_code || undefined,
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-sm text-muted-foreground mb-2">
          <Link href="/companies" className="hover:underline">Companies</Link>
          {" / "}
          <Link href={`/companies/${country}`} className="hover:underline">
            {c.country_iso}
          </Link>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-2">{displayName}</h1>

        <div className="text-muted-foreground mb-6 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {cityCountry && <span>📍 {cityCountry}</span>}
          {c.founded_year && <span>📅 Founded {c.founded_year}</span>}
          {c.nace_code && <span>🏭 NACE {c.nace_code}</span>}
          {c.is_import_export && <span>🌍 Import/Export</span>}
          {c.status && <span>Status: {c.status}</span>}
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card title="Company">
            <Row label="Legal name" value={c.legal_name} />
            <Row label="Trade name" value={c.trade_name} />
            <Row label="Domain" value={c.domain} link={c.domain ? `https://${c.domain}` : null} />
            <Row label="Founded" value={c.founded_year} />
            <Row label="Status" value={c.status} />
          </Card>

          <Card title="Identifiers">
            <Row label="SIREN (FR)" value={c.siren} />
            <Row label="CRN (UK)" value={c.crn} />
            <Row label="VAT" value={c.vat_number} />
            <Row label="Source" value={c.primary_source} />
          </Card>

          <Card title="Location">
            <Row label="Address" value={c.address} />
            <Row label="City" value={c.city} />
            <Row label="Region" value={c.region} />
            <Row label="Postal code" value={c.postal_code} />
            <Row label="Country" value={c.country_iso} />
          </Card>

          <Card title="Activity">
            <Row label="NACE code" value={c.nace_code} />
            <Row label="SIC code" value={c.sic_code} />
            <Row
              label="Industry tags"
              value={c.industry_tags && c.industry_tags.length > 0 ? c.industry_tags.slice(0, 3).join(", ") : null}
            />
            <Row label="Size bucket" value={c.size_bucket} />
            <Row label="Employees" value={fmtNum(c.employees_estimate)} />
            <Row label="Revenue (EUR)" value={c.revenue_estimate_eur ? `€${fmtNum(c.revenue_estimate_eur)}` : null} />
          </Card>
        </section>

        <section className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-6 mb-8">
          <h2 className="text-xl font-semibold mb-2">🔒 Trade flow detail</h2>
          <p className="text-muted-foreground mb-4">
            Voir l'historique 5 ans des import/export de {displayName} : top trading
            partners, HS codes, volumes mensuels, sanctions exposures.
          </p>
          <Link
            href={`https://hub.gapup.io/waitlist?ref=companies-${country}`}
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-md font-medium"
          >
            Rejoindre la waitlist Founders →
          </Link>
        </section>

        <section className="text-sm text-muted-foreground">
          <p className="mb-2">
            <strong>Source:</strong> Public registry data ({c.primary_source}). Updated daily.
          </p>
          <p>
            Data is provided as-is from official public sources. This page is a directory
            listing — not an endorsement, review, or financial advice. Companies may request
            removal via{" "}
            <Link href="/companies/remove" className="underline">
              this form
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="font-semibold mb-3">{title}</h3>
      <div className="grid gap-2 text-sm">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  link,
}: {
  label: string;
  value: string | number | null | undefined;
  link?: string | null;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </span>
    </div>
  );
}

export { slugify };
