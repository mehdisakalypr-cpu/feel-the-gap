import Link from "next/link";
import type { Metadata } from "next";
import { TRADE_SHOWS, upcoming } from "@/lib/trade-shows";

export const metadata: Metadata = {
  title: "Major B2B Trade Shows 2026 — Trade Flow Analysis · Feel The Gap",
  description: `${TRADE_SHOWS.length} salons import/export majeurs 2026 : Hannover Messe, IFA Berlin, IMEX Frankfurt, MWC Barcelona, Canton Fair, Anuga, SIAL Paris... Pre-show + post-show analysis.`,
  alternates: {
    canonical: "https://www.gapup.io/trade-shows",
  },
};

export const revalidate = 86400;

export default function TradeShowsIndexPage() {
  const shows = upcoming();

  // Group by month for SEO friendliness
  const byMonth: Record<string, typeof shows> = {};
  for (const s of shows) {
    const month = s.startDate.slice(0, 7); // YYYY-MM
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month]!.push(s);
  }

  const months = Object.keys(byMonth).sort();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-3">Major B2B Trade Shows 2026</h1>
        <p className="text-lg text-muted-foreground mb-8">
          {TRADE_SHOWS.length} salons import/export & B2B couverts. Pre-show analysis, exposants matchés
          avec trade flows réels, lead magnets gratuits.
        </p>

        <section className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-6 mb-12">
          <h2 className="text-xl font-semibold mb-2">Pre-show briefs gratuits</h2>
          <p className="text-muted-foreground mb-4">
            Recevez 30 jours avant chaque salon : top exposants + analyse sectorielle + sanctions
            updates affectant les attendees.
          </p>
          <Link
            href="https://hub.gapup.io/waitlist?ref=trade-shows-index"
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-md font-medium"
          >
            Recevoir tous les briefs (gratuit) →
          </Link>
        </section>

        {months.map((month) => {
          const date = new Date(month + "-01");
          const label = date.toLocaleDateString("fr-FR", {
            month: "long",
            year: "numeric",
          });
          const list = byMonth[month] || [];
          return (
            <section key={month} className="mb-10">
              <h2 className="text-2xl font-semibold mb-4 capitalize">{label}</h2>
              <div className="grid gap-3">
                {list.map((show) => (
                  <Link
                    key={show.slug}
                    href={`/trade-shows/${show.slug}`}
                    className="rounded-lg border border-border p-4 hover:border-purple-500/50 hover:bg-purple-500/5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <h3 className="font-semibold">{show.name}</h3>
                        <div className="text-sm text-muted-foreground mt-1">
                          {show.countryFlag} {show.city} · {show.venue} · {show.industry}
                        </div>
                      </div>
                      <div className="text-sm text-right">
                        <div className="text-muted-foreground">
                          {show.startDate.slice(8, 10)}–{show.endDate.slice(8, 10)} {label.split(" ")[0]}
                        </div>
                        <div className="text-xs mt-1">
                          {show.attendees.toLocaleString("fr-FR")} visiteurs ·{" "}
                          {show.exhibitors.toLocaleString("fr-FR")} exposants
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}

        <section className="mt-12 text-center text-sm text-muted-foreground">
          <p>
            Salon manquant ? <Link href="/contact" className="underline">Suggérer un ajout</Link> —
            on couvre +200 salons B2B import/export en 2026.
          </p>
        </section>
      </div>
    </main>
  );
}
