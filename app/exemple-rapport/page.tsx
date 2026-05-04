import Link from "next/link";
import {
  META,
  KPIS,
  EXEC_SUMMARY,
  TOP_EXPORTERS_IN,
  TOP_IMPORTERS_FR,
  MONTHLY_FLOW,
  TARIFF_EVENTS,
  COMPETITIVE_LANDSCAPE,
  RISKS_GEOPOLITICAL,
  OPPORTUNITY_BREAKDOWN,
  RECOMMENDATIONS,
  SOURCES,
} from "./_components/data";
import { MonthlyFlowChart, TariffEventsTimeline, OpportunityRadar } from "./_components/Charts";

export const metadata = {
  title: "Rapport-exemple FTG · HS-9018 instruments médicaux Inde → France · 12 mois UN Comtrade",
  description:
    "Rapport complet généré par Feel The Gap sur le flux d'importation HS-9018 Inde → France : volume $286M, 318 exporteurs IN, 412 importateurs FR, 7 axes opportunité, 6 risques géopolitiques, 6 recommandations actionnables, 15 sources sourcées.",
};

export const dynamic = "force-static";
export const revalidate = 86400;

export default function ExempleRapportPage() {
  return (
    <main style={{ background: "#07090F", color: "#FFFFFF", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Hero */}
      <section style={{ padding: "80px 24px 48px", background: "radial-gradient(circle at 30% 0%, rgba(201,168,76,0.18) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(6,182,212,0.12) 0%, transparent 60%), #07090F", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
            <Link href="/demo" style={{ color: "#C9A84C", fontSize: 13, textDecoration: "none", fontWeight: 600 }}>
              ← Retour à la page d&apos;accès démo
            </Link>
            <span style={{ fontSize: 11, color: "#94a3b8", letterSpacing: ".15em", textTransform: "uppercase", fontWeight: 600 }}>
              Exemple public · pas de login requis
            </span>
          </div>
          <div style={{ display: "inline-block", padding: "6px 14px", background: "rgba(201,168,76,0.15)", border: "1px solid #C9A84C", borderRadius: 999, fontSize: 11, fontWeight: 800, color: "#C9A84C", letterSpacing: 1.2, marginBottom: 18, textTransform: "uppercase" }}>
            📊 Rapport exemple · livré en 8 minutes par Feel The Gap
          </div>
          <h1 style={{ fontSize: 52, fontWeight: 900, margin: "0 0 18px", letterSpacing: -1.2, lineHeight: 1.1, color: "#fff" }}>
            HS-9018 instruments médicaux <span style={{ color: "#C9A84C" }}>Inde {META.origin.flag} → France {META.destination.flag}</span>
          </h1>
          <p style={{ fontSize: 17, color: "#cfd2dc", maxWidth: 880, lineHeight: 1.7, margin: "0 0 24px" }}>
            Rapport complet d&apos;intelligence trade · 12 derniers mois · 4 872 déclarations DGDDI agrégées · 8 sources cross-référencées
            (UN Comtrade, Eurostat, EU TARIC, DGDDI, Govt of India MOCI, WTO, registres fournisseurs, sources presse spécialisée).
            <br />
            Tu reçois exactement ce niveau de détail pour n&apos;importe quel HS-code × pays via FTG en 8 minutes.
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "#94a3b8" }}>
            <span>📅 Période : {META.period}</span>
            <span>⏱ Scan completed : {new Date(META.scan_completed_iso).toLocaleString("fr-FR")}</span>
            <span>📑 Code SH : {META.hs_code}</span>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 24px" }}>
        {/* KPI strip */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 18px", color: "#fff" }}>📊 KPI strip · vue 30 secondes</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {KPIS.map((k) => (
              <div key={k.label} style={{ background: "rgba(255,255,255,.025)", border: "1px solid rgba(201,168,76,.18)", borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600 }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginTop: 6, marginBottom: 4, lineHeight: 1.1 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>{k.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Executive summary */}
        <article style={cardStyle}>
          <h2 style={h2Style}>Executive summary · synthèse exécutive 5 paragraphes</h2>
          <div style={{ display: "grid", gap: 16 }}>
            {EXEC_SUMMARY.map((p, i) => (
              <p key={i} style={{ fontSize: 14, color: "#e2e4ed", lineHeight: 1.78, margin: 0, paddingLeft: 18, borderLeft: "2px solid rgba(201,168,76,.4)" }}>
                {p}
              </p>
            ))}
          </div>
        </article>

        {/* Monthly flow chart */}
        <article style={cardStyle}>
          <h2 style={h2Style}>📈 Flux mensuel sur 12 mois</h2>
          <MonthlyFlowChart data={MONTHLY_FLOW} />
        </article>

        {/* Top exporters */}
        <article style={cardStyle}>
          <h2 style={h2Style}>🇮🇳 Top 10 exporteurs indiens · 51 % du volume cumulé</h2>
          <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 18, fontStyle: "italic" }}>Identifiés via Govt of India shipping bills + UN Comtrade ventilation entreprise (où dispo) + cross-check sites web officiels.</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,.04)", color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".05em" }}>
                  <th style={th}>#</th><th style={th}>Exporteur</th><th style={th}>Ville</th><th style={th}>Volume USD</th><th style={th}>%</th><th style={th}>Lines</th><th style={th}>CE</th><th style={th}>ISO 13485</th><th style={th}>Ans EU</th><th style={th}>Agent EU</th>
                </tr>
              </thead>
              <tbody>
                {TOP_EXPORTERS_IN.map((e) => (
                  <tr key={e.rank} style={{ borderTop: "1px solid rgba(255,255,255,.04)" }}>
                    <td style={{ ...td, color: "#C9A84C", fontWeight: 800 }}>{e.rank}</td>
                    <td style={{ ...td, color: "#fff", fontWeight: 600 }}>{e.name}</td>
                    <td style={td}>{e.city}, {e.state}</td>
                    <td style={{ ...td, color: "#C9A84C", fontWeight: 700 }}>${(e.volume_usd / 1_000_000).toFixed(1)}M</td>
                    <td style={td}>{e.volume_share_pct.toFixed(1)}%</td>
                    <td style={{ ...td, fontSize: 10 }}>{e.lines.join(", ")}</td>
                    <td style={td}>{e.ce_certified ? "✅" : "—"}</td>
                    <td style={td}>{e.iso_13485 ? "✅" : "—"}</td>
                    <td style={td}>{e.eu_export_years}</td>
                    <td style={{ ...td, fontSize: 10, color: e.agent_eu === "Aucun (recherche actif)" || e.agent_eu === "—" ? "#fbbf24" : "#cfd2dc" }}>{e.agent_eu}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        {/* Top importers FR */}
        <article style={cardStyle}>
          <h2 style={h2Style}>🇫🇷 Top 8 importateurs français · marché fragmenté</h2>
          <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 18, fontStyle: "italic" }}>Identifiés via DGDDI + Pappers SIRET cross-check + analyse marchés publics BOAMP.</p>
          <div style={{ display: "grid", gap: 10 }}>
            {TOP_IMPORTERS_FR.map((imp) => (
              <div key={imp.rank} style={{ display: "grid", gridTemplateColumns: "40px 1.6fr 1fr 1fr 100px", gap: 14, alignItems: "center", padding: 14, background: "rgba(0,0,0,.22)", borderRadius: 10, border: "1px solid rgba(255,255,255,.04)" }}>
                <div style={{ fontSize: 16, color: "#C9A84C", fontWeight: 800, fontFamily: "monospace" }}>#{imp.rank}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{imp.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>SIRET {imp.siret} · {imp.city}</div>
                </div>
                <div style={{ fontSize: 11, color: "#cfd2dc" }}>{imp.type}</div>
                <div style={{ fontSize: 11, color: "#cfd2dc" }}>Cycle achat <strong style={{ color: "#fff" }}>{imp.procurement_cycle_days}j</strong> · paiement <strong style={{ color: "#fff" }}>{imp.payment_terms_days}j</strong></div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#C9A84C", textAlign: "right" }}>${(imp.volume_usd / 1_000_000).toFixed(1)}M</div>
              </div>
            ))}
          </div>
        </article>

        {/* Tariff & events timeline */}
        <article style={cardStyle}>
          <h2 style={h2Style}>📅 Timeline réglementaire & tarifaire · 5 événements clés</h2>
          <TariffEventsTimeline events={TARIFF_EVENTS} />
        </article>

        {/* Opportunity score radar */}
        <article style={cardStyle}>
          <h2 style={h2Style}>🎯 Score d&apos;opportunité FTG · 7 axes pondérés</h2>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(380px, 1fr) 1.4fr", gap: 24, alignItems: "center" }}>
            <OpportunityRadar axes={OPPORTUNITY_BREAKDOWN} />
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
              {OPPORTUNITY_BREAKDOWN.map((a) => (
                <li key={a.axis} style={{ background: "rgba(0,0,0,.22)", borderRadius: 8, padding: 12, border: "1px solid rgba(255,255,255,.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{a.axis} <span style={{ color: "#94a3b8", fontWeight: 400 }}>· poids {a.weight_pct}%</span></span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: a.score >= 80 ? "#34d399" : a.score >= 60 ? "#fbbf24" : "#ef4444" }}>{a.score}/100</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#cfd2dc", lineHeight: 1.5 }}>{a.comment}</div>
                </li>
              ))}
            </ul>
          </div>
        </article>

        {/* Competitive landscape */}
        <article style={cardStyle}>
          <h2 style={h2Style}>🥊 Concurrents intelligence trade · 6 alternatives</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,.04)", color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".05em" }}>
                  <th style={th}>Solution</th><th style={th}>Sources</th><th style={th}>Langues</th><th style={th}>HS codes</th><th style={th}>Pays</th><th style={th}>BPlan IA</th><th style={th}>Alertes</th><th style={th}>€/mo</th>
                </tr>
              </thead>
              <tbody>
                {COMPETITIVE_LANDSCAPE.map((c) => (
                  <tr key={c.name} style={{ background: c.name.includes("FTG") ? "rgba(201,168,76,.07)" : "transparent", borderTop: "1px solid rgba(255,255,255,.04)" }}>
                    <td style={{ ...td, color: "#fff", fontWeight: c.name.includes("FTG") ? 800 : 600 }}>{c.name}</td>
                    <td style={td}>{c.source_count}</td>
                    <td style={td}>{c.languages}</td>
                    <td style={td}>{c.hs_codes_covered.toLocaleString()}</td>
                    <td style={td}>{c.countries_covered}</td>
                    <td style={td}>{c.ai_bizplan ? "✅" : "—"}</td>
                    <td style={td}>{c.alerts_inflexion ? "✅" : "—"}</td>
                    <td style={{ ...td, color: c.name.includes("FTG") ? "#C9A84C" : "#cfd2dc", fontWeight: c.name.includes("FTG") ? 800 : 500 }}>€{c.pricing_eur_mo === 0 ? "0" : c.pricing_eur_mo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul style={{ listStyle: "none", padding: 0, marginTop: 16, display: "grid", gap: 6 }}>
            {COMPETITIVE_LANDSCAPE.map((c) => (
              <li key={c.name + "-v"} style={{ fontSize: 11, color: "#cfd2dc", lineHeight: 1.5 }}>
                <strong style={{ color: c.name.includes("FTG") ? "#C9A84C" : "#fff" }}>{c.name} :</strong> {c.summary}
              </li>
            ))}
          </ul>
        </article>

        {/* Risks */}
        <article style={cardStyle}>
          <h2 style={h2Style}>⚠ Risques géopolitiques & opérationnels · 6 risques chiffrés</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {RISKS_GEOPOLITICAL.map((r, i) => (
              <div key={i} style={{ borderRadius: 10, padding: 18, background: "rgba(0,0,0,.25)", border: `1px solid ${r.color}38`, display: "grid", gridTemplateColumns: "60px 1fr 130px", gap: 16, alignItems: "start" }}>
                <div><span style={{ background: r.color, color: "#000", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>{r.severity}</span></div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 6px", color: "#fff" }}>{r.title}</h3>
                  <p style={{ fontSize: 12.5, color: "#cfd2dc", margin: "0 0 8px", lineHeight: 1.6 }}>{r.desc}</p>
                  <p style={{ fontSize: 12, color: "#34d399", margin: 0, lineHeight: 1.6 }}><strong>Mitigation :</strong> {r.mitigation}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".1em" }}>Probabilité</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: r.color }}>{r.likelihood_pct}%</div>
                </div>
              </div>
            ))}
          </div>
        </article>

        {/* Recommendations */}
        <article style={cardStyle}>
          <h2 style={h2Style}>✅ Recommandations actionnables · 6 actions classées par ROI</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {RECOMMENDATIONS.map((r, i) => {
              const color = r.priority === "P0" ? "#ef4444" : r.priority === "P1" ? "#fbbf24" : "#A78BFA";
              return (
                <div key={i} style={{ background: "rgba(0,0,0,.25)", borderRadius: 10, padding: 18, border: `1px solid ${color}28` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
                    <div>
                      <span style={{ background: color, color: "#000", padding: "3px 9px", borderRadius: 5, fontSize: 11, fontWeight: 800, marginRight: 8 }}>{r.priority}</span>
                      <strong style={{ fontSize: 14, color: "#fff" }}>{r.title}</strong>
                    </div>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>Deadline ≈ {r.deadline_days} j</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: "#cfd2dc", margin: "0 0 6px", lineHeight: 1.55 }}><strong style={{ color: "#fbbf24" }}>Rationale :</strong> {r.rationale}</p>
                  <p style={{ fontSize: 12, color: "#34d399", margin: 0, lineHeight: 1.55 }}><strong>Outcome attendu :</strong> {r.expected_outcome}</p>
                </div>
              );
            })}
          </div>
        </article>

        {/* Bizplan teaser */}
        <article style={{ ...cardStyle, background: "linear-gradient(135deg, rgba(201,168,76,.12), rgba(6,182,212,.08))", border: "1px solid rgba(201,168,76,.28)" }}>
          <h2 style={h2Style}>🧠 BPlan IA inclus · transforme ce rapport en BP banque/BPI</h2>
          <p style={{ fontSize: 14, color: "#cfd2dc", lineHeight: 1.7, marginBottom: 16 }}>
            FTG inclut nativement la génération d&apos;un Business Plan 28 pages structuré (BPI / Banque / VC) à partir de ton rapport HS×pays. Tu colles ce rapport en annexe, tu réponds 12 questions sur ton équipe et ta stratégie commerciale, et tu reçois un BP éditable PDF + Word + Google Docs en moins de 24h.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, fontSize: 13 }}>
            {[
              "✅ Executive summary multi-paragraphes",
              "✅ TAM/SAM/SOM avec sources sourcées",
              "✅ Cap table + plan ESOP",
              "✅ Forecast 36 mois P10/P50/P90",
              "✅ Risques chiffrés P0/P1/P2",
              "✅ Plan d&apos;usage des fonds détaillé",
              "✅ Audit anti-rejet BPI 47 patterns",
              "✅ Re-run après amendement BPI",
            ].map((b, i) => (
              <li key={i} style={{ color: "#fff", padding: "8px 12px", background: "rgba(0,0,0,.25)", borderRadius: 8 }}>{b}</li>
            ))}
          </ul>
        </article>

        {/* Sources */}
        <article style={cardStyle}>
          <h2 style={h2Style}>📚 Sources citées · {SOURCES.length} références</h2>
          <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 18, fontStyle: "italic" }}>Toutes les sources sont publiques + URL résolvable. La règle interne FTG : aucune statistique sans citation, aucune citation sans URL résolvable.</p>
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {SOURCES.map((s, i) => (
              <li key={i} style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 10, padding: "8px 12px", background: "rgba(0,0,0,.22)", borderRadius: 8 }}>
                <span style={{ color: "#C9A84C", fontWeight: 800, fontSize: 12 }}>[{i + 1}]</span>
                <div>
                  <div style={{ fontSize: 12, color: "#cfd2dc", marginBottom: 4, lineHeight: 1.55 }}>{s.citation}</div>
                  <a href={s.url} target="_blank" rel="noreferrer noopener" style={{ fontSize: 11, color: "#06B6D4", textDecoration: "none", wordBreak: "break-all" }}>{s.url}</a>
                </div>
              </li>
            ))}
          </ol>
        </article>

        {/* CTA final */}
        <section style={{ textAlign: "center", padding: 32, background: "linear-gradient(135deg, rgba(201,168,76,.18), rgba(6,182,212,.12))", borderRadius: 16, border: "1px solid rgba(201,168,76,.28)" }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 10px", color: "#fff" }}>
            Tu veux le même rapport sur <span style={{ color: "#C9A84C" }}>ton HS × pays</span> ?
          </h2>
          <p style={{ fontSize: 14, color: "#cfd2dc", maxWidth: 700, margin: "0 auto 22px", lineHeight: 1.6 }}>
            Demande l&apos;accès au tour interactif FTG (4 parcours dédiés : entrepreneur · influenceur · financeur · investisseur) — modération admin sous 24h ouvrées.
          </p>
          <Link href="/demo" style={{ display: "inline-block", padding: "14px 28px", background: "#C9A84C", color: "#1F1535", borderRadius: 10, fontWeight: 800, fontSize: 14, textDecoration: "none" }}>
            Demander mon accès démo →
          </Link>
        </section>
      </div>

      <footer style={{ padding: "32px 24px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,.06)", fontSize: 12, color: "#6b7280", marginTop: 24 }}>
        🔄 Cette page exemple-rapport a été générée par Feel The Gap — dogfood callout : le pipeline complet (UN Comtrade scraping + EU TARIC + DGDDI + Pappers cross-check + sentiment + bizplan IA) tourne en interne pour générer ce niveau de rapport sur n&apos;importe quel HS-code × pays en 8 minutes.
      </footer>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,.025)",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,.06)",
  padding: 28,
  marginBottom: 24,
};

const h2Style: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  margin: "0 0 18px",
  color: "#fff",
};

const th: React.CSSProperties = { padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 700 };
const td: React.CSSProperties = { padding: "10px 12px", fontSize: 11, color: "#cfd2dc" };
