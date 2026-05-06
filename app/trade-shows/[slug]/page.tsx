import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { TRADE_SHOWS, bySlug } from "@/lib/trade-shows";

export const dynamicParams = false;
export const revalidate = 86400;

export function generateStaticParams() {
  return TRADE_SHOWS.map((s) => ({ slug: s.slug }));
}

// XSS-safe JSON-LD output: escape `<` to prevent </script> injection.
// Input is curated from /lib/trade-shows.ts (no user-controlled data).
function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) {
    return `${s.getDate()}–${e.getDate()} ${e.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`;
  }
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

type RouteParams = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: RouteParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const show = bySlug(slug);
  if (!show) return { title: "Trade show not found · Feel The Gap" };

  return {
    title: `${show.name} — Exhibitors + Trade Flow Analysis · Feel The Gap`,
    description: `${show.name} ${fmtRange(show.startDate, show.endDate)} à ${show.city}. ${show.attendees.toLocaleString("fr-FR")} visiteurs, ${show.exhibitors.toLocaleString("fr-FR")} exposants. Pre-show analysis + lead magnets.`,
    alternates: {
      canonical: `https://www.gapup.io/trade-shows/${slug}`,
    },
    openGraph: {
      title: `${show.name} — Trade Analysis`,
      description: `Pre-show + post-show trade flow analysis for ${show.name}. ${show.exhibitors.toLocaleString("fr-FR")} exhibitors, ${show.attendees.toLocaleString("fr-FR")} attendees.`,
      type: "article",
    },
    robots: "index,follow",
  };
}

export default async function TradeShowPage({
  params,
}: {
  params: RouteParams;
}) {
  const { slug } = await params;
  const show = bySlug(slug);
  if (!show) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: show.name,
    startDate: show.startDate,
    endDate: show.endDate,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: show.venue,
      address: {
        "@type": "PostalAddress",
        addressLocality: show.city,
        addressCountry: show.country,
      },
    },
    url: show.url,
    description: show.description,
  };

  const ldHtml = safeJsonLd(jsonLd);

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* JSON-LD safe — input curated, < escaped */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldHtml }}
      />

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-sm text-muted-foreground mb-2">
          <Link href="/trade-shows" className="hover:underline">Trade shows</Link>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-2">{show.name}</h1>

        <div className="text-muted-foreground mb-6 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>📅 {fmtRange(show.startDate, show.endDate)}</span>
          <span>{show.countryFlag} {show.city}</span>
          <span>🏢 {show.venue}</span>
          <span>🏭 {show.industry}</span>
        </div>

        <p className="text-lg mb-8">{show.description}</p>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Stat label="Visiteurs" value={show.attendees.toLocaleString("fr-FR")} />
          <Stat label="Exposants" value={show.exhibitors.toLocaleString("fr-FR")} />
          <Stat label="Pays" value={show.country} />
          <Stat label="Industrie" value={show.industry} />
        </section>

        <section className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-6 mb-8">
          <h2 className="text-xl font-semibold mb-2">📊 Pre-show analysis</h2>
          <p className="text-muted-foreground mb-4">
            Recevez 30 jours avant le salon : liste des top 50 exposants matchés avec leurs trade flows
            réels (imports/exports historique 5 ans), analyse sectorielle, top buyers attendus, sanctions
            updates affectant les exposants.
          </p>
          <Link
            href={`https://hub.gapup.io/waitlist?ref=trade-show-${show.slug}&services=ftg`}
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-md font-medium"
          >
            Recevoir l'analyse pre-show →
          </Link>
        </section>

        <section className="rounded-lg border border-border p-6 mb-8">
          <h2 className="text-xl font-semibold mb-3">📥 Lead magnets gratuits</h2>
          <ul className="grid gap-3 text-sm">
            <li>
              <strong>📄 PDF Pre-show Brief</strong> — 28 pages :
              top 50 exhibitors + sectoral breakdown + 3 regulatory changes affecting attendees
            </li>
            <li>
              <strong>🎯 Pre-show Matchmaking</strong> — find which exhibitors match your buyer profile
              based on FTG trade flow data
            </li>
            <li>
              <strong>📧 Post-show Update</strong> — 30 jours après : trade flows shifts + deals
              announcés + companies à suivre
            </li>
          </ul>
          <p className="text-xs text-muted-foreground mt-4">
            Gratuit avec inscription waitlist Founders. Aucun spam.
          </p>
        </section>

        <section className="rounded-lg border border-border p-6">
          <h3 className="font-semibold mb-3">À propos de {show.name}</h3>
          <div className="text-sm space-y-2 text-muted-foreground">
            <p>
              <strong>Site officiel :</strong>{" "}
              <a
                href={show.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:underline"
              >
                {show.url}
              </a>
            </p>
            <p>
              <strong>Lieu :</strong> {show.venue}, {show.city}, {show.country}
            </p>
            <p>
              <strong>Dates :</strong> {fmtRange(show.startDate, show.endDate)}
            </p>
          </div>
        </section>

        <section className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            Cette page est un listing informatif basé sur des données publiques.
            Pas d'affiliation officielle avec les organisateurs du salon.
          </p>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border p-4 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
