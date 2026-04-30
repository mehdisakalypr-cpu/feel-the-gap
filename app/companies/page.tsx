import Link from "next/link";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Trade Companies Directory — Import/Export Profiles · Feel The Gap",
  description:
    "Annuaire mondial d'entreprises import/export, classées par pays. Profils basés sur registres publics : Companies House UK, Sirene FR, Handelsregister DE, et plus.",
  alternates: {
    canonical: "https://www.gapup.io/companies",
  },
};

export const revalidate = 86400;

const ISO3_TO_2: Record<string, string> = {
  GBR: "gb", FRA: "fr", DEU: "de", ITA: "it", ESP: "es",
  NLD: "nl", BEL: "be", PRT: "pt", USA: "us", IRL: "ie",
  LUX: "lu", AUT: "at", DNK: "dk", SWE: "se", FIN: "fi",
  NOR: "no", POL: "pl", CZE: "cz", HUN: "hu", EST: "ee",
  LVA: "lv", LTU: "lt", GRC: "gr", BGR: "bg", ROU: "ro",
  SVK: "sk", SVN: "si", HRV: "hr",
};

const COUNTRY_LABEL: Record<string, { name: string; flag: string }> = {
  GBR: { name: "United Kingdom", flag: "🇬🇧" },
  FRA: { name: "France", flag: "🇫🇷" },
  DEU: { name: "Germany", flag: "🇩🇪" },
  ITA: { name: "Italy", flag: "🇮🇹" },
  ESP: { name: "Spain", flag: "🇪🇸" },
  NLD: { name: "Netherlands", flag: "🇳🇱" },
  BEL: { name: "Belgium", flag: "🇧🇪" },
  PRT: { name: "Portugal", flag: "🇵🇹" },
  USA: { name: "United States", flag: "🇺🇸" },
  IRL: { name: "Ireland", flag: "🇮🇪" },
  LUX: { name: "Luxembourg", flag: "🇱🇺" },
  AUT: { name: "Austria", flag: "🇦🇹" },
  POL: { name: "Poland", flag: "🇵🇱" },
  EST: { name: "Estonia", flag: "🇪🇪" },
};

async function fetchCountrySummary() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .schema("gapup_leads" as never)
    .from("lv_companies")
    .select("country_iso", { count: "exact", head: false })
    .limit(0);
  // Group by country via SQL aggregation done client-side from a separate call:
  const { data: countByCountry } = await sb
    .schema("gapup_leads" as never)
    .from("lv_companies")
    .select("country_iso")
    .limit(50000);
  if (!countByCountry) return [];
  const counts: Record<string, number> = {};
  for (const row of countByCountry as Array<{ country_iso: string }>) {
    counts[row.country_iso] = (counts[row.country_iso] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([iso, n]) => ({
      iso,
      iso2: ISO3_TO_2[iso] || iso.toLowerCase().slice(0, 2),
      label: COUNTRY_LABEL[iso] || { name: iso, flag: "🏳️" },
      count: n,
    }))
    .filter((c) => c.count >= 5)
    .sort((a, b) => b.count - a.count);
}

export default async function CompaniesIndexPage() {
  const countries = await fetchCountrySummary();
  const total = countries.reduce((s, c) => s + c.count, 0);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-3">Trade Companies Directory</h1>
        <p className="text-lg text-muted-foreground mb-8">
          {total.toLocaleString("fr-FR")}+ entreprises import/export indexées depuis registres publics
          officiels. Données : Companies House (UK), Sirene (FR), Handelsregister (DE), GLEIF, OpenCorporates.
        </p>

        <section className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-6 mb-12">
          <h2 className="text-xl font-semibold mb-2">🔒 Trade flow analysis</h2>
          <p className="text-muted-foreground mb-4">
            Pour chaque company : voir l'historique 5 ans des import/export, top trading partners,
            HS codes, sanctions exposures, suppliers/buyers similaires.
          </p>
          <Link
            href="https://hub.gapup.io/waitlist?ref=companies-index"
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-md font-medium"
          >
            Rejoindre la waitlist Founders →
          </Link>
        </section>

        <h2 className="text-2xl font-semibold mb-4">Browse by country</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-12">
          {countries.map((c) => (
            <Link
              key={c.iso}
              href={`/companies/${c.iso2}`}
              className="rounded-lg border border-border p-4 hover:border-purple-500/50 hover:bg-purple-500/5 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    <span>{c.label.flag}</span>
                    {c.label.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 uppercase">
                    {c.iso}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">
                    {c.count.toLocaleString("fr-FR")}
                  </div>
                  <div className="text-xs text-muted-foreground">companies</div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <section className="text-sm text-muted-foreground border-t border-border pt-6">
          <p className="mb-2">
            <strong>Source:</strong> Données publiques officielles. Mises à jour quotidiennes
            depuis les registres pays par pays.
          </p>
          <p className="mb-2">
            <strong>RGPD :</strong> Listing entités légales uniquement (pas de données dirigeants).
            Une entreprise peut demander la suppression de sa fiche via{" "}
            <Link href="/companies/remove" className="underline">
              ce formulaire
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
