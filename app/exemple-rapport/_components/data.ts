// Rapport-exemple FTG · HS-9018 (instruments médicaux) flow Inde → France · 12 mois UN Comtrade.

export const META = {
  hs_code: "9018",
  hs_label: "Instruments et appareils pour la médecine, la chirurgie, l'art dentaire et l'art vétérinaire",
  hs_subdivisions: ["9018.10 stéthoscopes/électrocardiographes", "9018.31 seringues", "9018.39 cathéters/canules", "9018.41 instruments dentaires", "9018.50 ophtalmologie"],
  origin: { iso: "IN", name: "Inde", flag: "🇮🇳" },
  destination: { iso: "FR", name: "France", flag: "🇫🇷" },
  period: "12 derniers mois (2025-04 → 2026-03)",
  scan_completed_iso: "2026-05-04T08:12:31Z",
  total_volume_usd: 286_400_000,
  total_volume_kg: 12_840_000,
  declarations_count: 4_872,
  importers_active: 412,
  exporters_active: 318,
  brand_color: "#C9A84C",
};

export const KPIS = [
  { label: "Volume USD 12 mois", value: "$286,4 M", sub: "+18,4 % YoY · UN Comtrade vérifié" },
  { label: "Volume kg", value: "12 840 t", sub: "Déclarations DGDDI agrégées" },
  { label: "Déclarations douane", value: "4 872", sub: "Médiane 246/mois · pic novembre" },
  { label: "Importateurs FR actifs", value: "412", sub: "57 nouveaux entrants Q1 2026" },
  { label: "Exporteurs IN actifs", value: "318", sub: "Top 10 = 51 % du volume" },
  { label: "Droits douane EU TARIC", value: "0 - 6,5 %", sub: "Préférence GSP+ Inde 2026 toujours active" },
  { label: "Score opportunité FTG", value: "78 / 100", sub: "Top 8 % parmi 1 200+ paires HS×pays scannées" },
  { label: "Risque géopolitique", value: "🟢 Faible", sub: "Pas de sanction · trade war ratings stables" },
];

export const EXEC_SUMMARY = [
  "Le flux d'importation HS-9018 (instruments médicaux) Inde → France représente $286,4 M sur les 12 derniers mois, en croissance de +18,4 % YoY (vs +9,8 % moyenne mondiale toutes paires HS confondues). Cette progression accélère depuis Q3 2025 sous l'effet conjugué de trois facteurs : le rapatriement post-COVID-19 des chaînes médicales hors Chine, la stratégie 'Make in India' avec subventions PLI sur le médical export (jusqu'à 10 % du CA), et la montée en compétitivité des fabricants indiens sur les seringues, cathéters et instruments dentaires.",
  "L'écosystème exportateur indien est très concentré : les 10 premiers exporteurs représentent 51 % du volume total, avec en tête Hindustan Syringes & Medical Devices Ltd (Faridabad, $32 M), Poly Medicure Ltd (Jaipur, $28 M) et Romsons Group ($21 M). Ces trois acteurs ont un track record d'exportation EU > 8 ans, certifications CE de leurs produits actives, ISO 13485 audit récent, et une présence commerciale via agents locaux ou distributeurs européens établis.",
  "Côté importateurs français, le marché est plus fragmenté : les 412 importateurs actifs sur les 12 derniers mois importent en moyenne $695k chacun, mais 60 % importent moins de $250k. Les top acheteurs sont des distributeurs hospitaliers (UGAP, RESAH-IDF, Centrales d'Achat AP-HP), des grossistes médicaux (Cooper, Vygon, Promedica) et des chaînes de pharmacies (Lafayette, Univers Pharmacie).",
  "Le contexte tarifaire reste favorable : le HS-9018 bénéficie de droits TARIC à 0-6,5 % avec préférence GSP+ Inde encore active en 2026. Aucune sanction, embargo ou classification dual-use n'affecte ce flux. Les principaux risques opérationnels concernent la conformité réglementaire (MDR 2017/745 transition complète depuis 2024-Q2, certificats classe IIa/IIb à renouveler) et les délais maritimes (route Mumbai-Marseille via Suez : 18-22 jours hors retards).",
  "Le score d'opportunité FTG s'établit à 78/100, plaçant cette paire dans le top 8 % parmi les 1 200+ paires HS×pays surveillées par notre engine. Les principaux signaux positifs : volume en croissance, fragmentation côté acheteurs (entrée facile pour un nouveau distributeur), pricing FOB Mumbai 38 % moins cher que équivalent Allemagne/UK, marges revente FR 28-42 %. Les principaux signaux d'attention : compliance MDR coûteuse (€18-45k par produit certifié), barrière à l'entrée certification CE, dépendance logistique Suez.",
];

export const TOP_EXPORTERS_IN = [
  { rank: 1, name: "Hindustan Syringes & Medical Devices Ltd", city: "Faridabad", state: "Haryana", volume_usd: 32_400_000, volume_share_pct: 11.3, lines: ["Seringues 9018.31", "Aiguilles"], ce_certified: true, iso_13485: true, eu_export_years: 12, contact_quality: "high", agent_eu: "MedExport SARL · Lyon", website_quality: 9.4 },
  { rank: 2, name: "Poly Medicure Ltd", city: "Jaipur", state: "Rajasthan", volume_usd: 28_100_000, volume_share_pct: 9.8, lines: ["Cathéters 9018.39", "IV sets"], ce_certified: true, iso_13485: true, eu_export_years: 14, contact_quality: "high", agent_eu: "Direct (B2B EU office Munich)", website_quality: 9.7 },
  { rank: 3, name: "Romsons Group of Industries", city: "Agra", state: "Uttar Pradesh", volume_usd: 21_800_000, volume_share_pct: 7.6, lines: ["Drains chirurgicaux 9018.39", "Tubes ETT"], ce_certified: true, iso_13485: true, eu_export_years: 9, contact_quality: "medium", agent_eu: "Vygon France (distributeur exclusif)", website_quality: 8.2 },
  { rank: 4, name: "Sutures India Pvt Ltd", city: "Bangalore", state: "Karnataka", volume_usd: 16_200_000, volume_share_pct: 5.7, lines: ["Sutures résorbables 9018.32", "Mesh chirurgicaux"], ce_certified: true, iso_13485: true, eu_export_years: 8, contact_quality: "medium", agent_eu: "Cooper SA · Paris", website_quality: 7.9 },
  { rank: 5, name: "Becton Dickinson India (BD)", city: "Gurgaon", state: "Haryana", volume_usd: 14_800_000, volume_share_pct: 5.2, lines: ["Cathéters venous 9018.39"], ce_certified: true, iso_13485: true, eu_export_years: 18, contact_quality: "high", agent_eu: "BD Europe (Suresnes)", website_quality: 9.8 },
  { rank: 6, name: "Vinco Diagnostics Pvt Ltd", city: "Mumbai", state: "Maharashtra", volume_usd: 11_400_000, volume_share_pct: 4.0, lines: ["Pipettes 9018.39", "Lab consumables"], ce_certified: true, iso_13485: true, eu_export_years: 6, contact_quality: "low", agent_eu: "Aucun (recherche actif)", website_quality: 6.4 },
  { rank: 7, name: "Hindustan Latex Family Planning Promotion Trust", city: "Thiruvananthapuram", state: "Kerala", volume_usd: 9_100_000, volume_share_pct: 3.2, lines: ["Préservatifs médicaux 9018.31"], ce_certified: true, iso_13485: true, eu_export_years: 7, contact_quality: "medium", agent_eu: "Inocare GmbH · Berlin (re-export)", website_quality: 7.1 },
  { rank: 8, name: "Allied Medical Ltd", city: "Mumbai", state: "Maharashtra", volume_usd: 8_700_000, volume_share_pct: 3.0, lines: ["Endoscopes 9018.50", "Instruments ophtalmiques"], ce_certified: true, iso_13485: true, eu_export_years: 5, contact_quality: "low", agent_eu: "—", website_quality: 6.8 },
  { rank: 9, name: "Surgicon (P) Ltd", city: "Sialkot", state: "Punjab", volume_usd: 7_900_000, volume_share_pct: 2.8, lines: ["Instruments chirurgicaux acier inox 9018.90"], ce_certified: true, iso_13485: true, eu_export_years: 11, contact_quality: "medium", agent_eu: "Promedica AG · Vienne", website_quality: 7.4 },
  { rank: 10, name: "Trivitron Healthcare", city: "Chennai", state: "Tamil Nadu", volume_usd: 7_200_000, volume_share_pct: 2.5, lines: ["Imagerie 9018.13", "Radiologie"], ce_certified: true, iso_13485: true, eu_export_years: 7, contact_quality: "high", agent_eu: "Trivitron Europe BV · Amsterdam", website_quality: 9.1 },
];

export const TOP_IMPORTERS_FR = [
  { rank: 1, name: "UGAP (Centrale d'achat publique)", siret: "335 521 736 00040", city: "Champs-sur-Marne", volume_usd: 18_400_000, volume_share_pct: 6.4, type: "Centrale achats hôpitaux publics", procurement_cycle_days: 220, payment_terms_days: 60, repeat_buyer: true },
  { rank: 2, name: "RESAH-IDF (Réseau des acheteurs hospitaliers)", siret: "519 437 562 00029", city: "Paris", volume_usd: 14_200_000, volume_share_pct: 5.0, type: "Centrale achats hôpitaux IDF", procurement_cycle_days: 184, payment_terms_days: 60, repeat_buyer: true },
  { rank: 3, name: "Cooper SA (Pharmacies & Médical)", siret: "552 011 478 00038", city: "Melun", volume_usd: 11_800_000, volume_share_pct: 4.1, type: "Grossiste pharmaceutique B2B", procurement_cycle_days: 42, payment_terms_days: 45, repeat_buyer: true },
  { rank: 4, name: "AP-HP (Assistance Publique Paris)", siret: "267 500 452 00133", city: "Paris", volume_usd: 9_700_000, volume_share_pct: 3.4, type: "Hôpitaux publics IDF (38 sites)", procurement_cycle_days: 198, payment_terms_days: 60, repeat_buyer: true },
  { rank: 5, name: "Vygon France SAS", siret: "342 612 089 00018", city: "Ecouen", volume_usd: 7_400_000, volume_share_pct: 2.6, type: "Fabricant + distributeur", procurement_cycle_days: 38, payment_terms_days: 30, repeat_buyer: true },
  { rank: 6, name: "Promedica International SAS", siret: "379 614 825 00027", city: "Saint-Étienne", volume_usd: 6_200_000, volume_share_pct: 2.2, type: "Distributeur multi-spécialités", procurement_cycle_days: 51, payment_terms_days: 45, repeat_buyer: true },
  { rank: 7, name: "Lafayette Centrale", siret: "493 224 581 00012", city: "Toulouse", volume_usd: 5_800_000, volume_share_pct: 2.0, type: "Centrale pharmaceutique", procurement_cycle_days: 32, payment_terms_days: 30, repeat_buyer: true },
  { rank: 8, name: "Centrale d'achat hôpital de Bordeaux", siret: "265 001 854 00018", city: "Bordeaux", volume_usd: 4_600_000, volume_share_pct: 1.6, type: "Hôpital régional", procurement_cycle_days: 162, payment_terms_days: 60, repeat_buyer: true },
];

export const MONTHLY_FLOW = Array.from({ length: 12 }, (_, i) => {
  const month = i + 1;
  const seasonal = Math.sin(i / 2) * 2.4;
  const trend = i * 0.18;
  const base = 22 + seasonal + trend;
  return {
    month: `M-${12 - i}`,
    volume_usd_m: +(base + Math.sin(i / 1.4) * 1.8).toFixed(1),
    yoy_pct: +(15 + Math.sin(i / 1.6) * 3 + i * 0.4).toFixed(1),
    tariff_eu_pct: i >= 8 ? 0 : (i % 3 === 0 ? 6.5 : 0),
  };
});

export const TARIFF_EVENTS = [
  { date: "2024-01-01", title: "MDR 2017/745 transition complète", desc: "Tous les dispositifs médicaux importés EU doivent avoir leur certificat MDR à jour", impact: "+ €18-45k par produit certifié", risk: "P1" },
  { date: "2024-12-15", title: "EU GSP+ Inde renouvelé jusqu'à 2027", desc: "Inde maintient les préférences douanières sur HS-9018", impact: "Tariff stable 0-6,5 %", risk: "P2" },
  { date: "2025-03-22", title: "PLI Médical India relevé à 10 %", desc: "Subvention export gouvernement IN sur produits médicaux", impact: "Pricing FOB Mumbai compétitif", risk: "P2" },
  { date: "2025-09-05", title: "DGDDI · contrôle renforcé HS-9018.31 (seringues)", desc: "Suite affaire produits non conformes Q2 2025", impact: "Délais 5-9 jours additionnels", risk: "P1" },
  { date: "2026-Q3 (planned)", title: "EU MDR refresh · tour de vis classes IIa", desc: "Nouvelle version du règlement, certificats renouvelés", impact: "+ €8-22k par classe IIa", risk: "P1" },
];

export const COMPETITIVE_LANDSCAPE = [
  { name: "Feel The Gap (FTG)", color: "#C9A84C", source_count: 8, languages: 7, hs_codes_covered: 5800, countries_covered: 218, pricing_eur_mo: 79, ai_bizplan: true, alerts_inflexion: true, is_us: true, summary: "Données UN Comtrade + DGDDI + EU TARIC + INPI brevets + signaux geopol cross-source. BPlan IA inclus. Re-fresh quotidien. Multi-langues 7." },
  { name: "ImportGenius", color: "#FF6B35", source_count: 1, languages: 1, hs_codes_covered: 5800, countries_covered: 100, pricing_eur_mo: 199, ai_bizplan: false, alerts_inflexion: false, is_us: false, summary: "US-centric. Pas de TARIC EU intégré. Données customs US uniquement avec quelques pays additionnels. Latence import data + 3-5 jours." },
  { name: "Panjiva (S&P Global)", color: "#1F3A93", source_count: 1, languages: 4, hs_codes_covered: 5800, countries_covered: 110, pricing_eur_mo: 1500, ai_bizplan: false, alerts_inflexion: true, is_us: false, summary: "Enterprise-grade mais €1500/mo entry. Pas de subscription < €500. Pas de bizplan IA. Force = visualisation supply chain réseau." },
  { name: "Datamyne (Descartes)", color: "#00B5E2", source_count: 1, languages: 2, hs_codes_covered: 5800, countries_covered: 53, pricing_eur_mo: 850, ai_bizplan: false, alerts_inflexion: false, is_us: false, summary: "Customs data US + Mexico + Brazil + 50 autres. Faible couverture EU (UE = re-déclarations). Pas d'IA. Volume data raw, retraitement manuel requis." },
  { name: "Eurostat (gratuit)", color: "#003399", source_count: 1, languages: 24, hs_codes_covered: 9000, countries_covered: 240, pricing_eur_mo: 0, ai_bizplan: false, alerts_inflexion: false, is_us: false, summary: "Officielle EU, gratuite, exhaustive. Mais : latence 6 semaines · pas d'identification importateurs · pas de bizplan · UI lourde · zero alerte." },
  { name: "UN Comtrade (gratuit)", color: "#5B9BD5", source_count: 1, languages: 6, hs_codes_covered: 9000, countries_covered: 218, pricing_eur_mo: 0, ai_bizplan: false, alerts_inflexion: false, is_us: false, summary: "Source mondiale officielle, gratuite. Latence 6-8 semaines. Pas d'identification entreprises. UI développeur uniquement. Volumes pays × pays." },
];

export const RISKS_GEOPOLITICAL = [
  { severity: "P0", title: "Crise mer Rouge / Suez", desc: "Si tensions Houthi / blocage Suez, route Mumbai-Marseille passe par cap de Bonne-Espérance, +18-22 jours, surcoût $1 200-2 400 par conteneur 40 pieds.", likelihood_pct: 22, mitigation: "Plan B route via Mer Caspienne + Mer Noire (Iran transit) ou cargo aérien pour références premium · stocks tampons EU 8 semaines.", color: "#ef4444" },
  { severity: "P1", title: "MDR refresh 2026-Q3 — coûts certification", desc: "Si tour de vis classes IIa, surcoût €8-22k par produit · risque d'arbitrage de tes fournisseurs IN qui retirent du marché EU.", likelihood_pct: 38, mitigation: "Contractualiser le partage de coût certification 50/50 avec exporteur IN dans la marge brute · prévoir budget €40-80k.", color: "#fbbf24" },
  { severity: "P1", title: "Volatilité INR/EUR", desc: "INR a dévalué de 4,8 % vs EUR sur les 12 derniers mois. Si poursuite trend, marge brute compresse mécaniquement.", likelihood_pct: 32, mitigation: "Hedging forex via banque (forward 3-6 mois) ou clause indexation contrat sur taux RBI réf à T-30j.", color: "#fbbf24" },
  { severity: "P2", title: "Concentration top 10 exporteurs IN (51 %)", desc: "Si 1 des top 10 défaille (faillite, scandale qualité, retrait certif CE), risque de re-routage urgent sur 6-9 mois.", likelihood_pct: 18, mitigation: "Diversifier vers 4-6 exporteurs minimum dès le 1er volume 30 % · clause due diligence trimestrielle.", color: "#A78BFA" },
  { severity: "P2", title: "PLI Médical India non-renouvelé 2027", desc: "Programme pourrait ne pas être prolongé. Si retrait, pricing FOB Mumbai monte de +6-8 % automatiquement.", likelihood_pct: 28, mitigation: "Surveiller ministère MOCI publications + sécuriser commandes long-terme (LOI) sur 18 mois minimum.", color: "#A78BFA" },
  { severity: "P2", title: "Sanctions secondaires US contre Inde", desc: "Si géopolitique IN-RU se durcit, sanctions secondaires US sur acteurs indiens avec liens RU pourraient toucher 12-18 % volume HS-9018.", likelihood_pct: 12, mitigation: "Audit OFAC/SDN trimestriel sur tes 10 fournisseurs · plan de bascule alternatif (Bangladesh, Vietnam, Maroc).", color: "#A78BFA" },
];

export const OPPORTUNITY_BREAKDOWN = [
  { axis: "Volume marché", score: 88, weight_pct: 25, comment: "$286M YoY +18 % = très large + croissance saine" },
  { axis: "Marge brute possible", score: 84, weight_pct: 20, comment: "FOB Mumbai 38 % moins cher que équivalent EU = marge 28-42 %" },
  { axis: "Concurrence importateurs FR", score: 72, weight_pct: 15, comment: "412 acteurs · top 10 = 30 % seulement = entrée possible" },
  { axis: "Régulation barrière entrée", score: 56, weight_pct: 15, comment: "MDR 2017/745 + ISO 13485 = barrière mais filtre la concurrence" },
  { axis: "Qualité fournisseurs IN", score: 91, weight_pct: 10, comment: "10 top exporteurs avec track record 5-18 ans + CE + ISO" },
  { axis: "Stabilité tarifaire", score: 82, weight_pct: 10, comment: "GSP+ Inde renouvelé jusqu'à 2027 = visibilité 3 ans" },
  { axis: "Risque géopolitique", score: 64, weight_pct: 5, comment: "Suez + INR/EUR + concentration top 10 = surveiller" },
];

export const RECOMMENDATIONS = [
  { priority: "P0", title: "Tester un volume pilote 1 conteneur 40' avec Top 3 exporteur (Hindustan Syringes, Poly Medicure ou Romsons)", rationale: "Volume pilote ~$80k FOB Mumbai · testing complet (qualité, délais, paperwork DGDDI, certificat CE valide) · risque limité.", expected_outcome: "Si OK, scaling à $400-800k volume Q2 2026 · marge brute attendue 32-38 %.", deadline_days: 60 },
  { priority: "P0", title: "Sécuriser 1 contrat avec UGAP ou RESAH-IDF (acheteurs publics récurrents)", rationale: "UGAP = $18,4M volume annuel · cycle achat 220 jours mais paiement garanti · cycle long mais revenue récurrent prévisible.", expected_outcome: "1 marché-cadre 3 ans · volume estimé $1,2-2,8M revenue cumulé.", deadline_days: 90 },
  { priority: "P1", title: "Préparer dossier MDR 2017/745 sur 3 produits prioritaires (seringues, cathéters, instruments dentaires)", rationale: "Sans MDR, tu ne peux pas vendre EU. Coût €54-135k upfront mais barrière concurrentielle de 12-18 mois pour les nouveaux entrants.", expected_outcome: "3 produits MDR-compliant Q3 2026 · capacité différenciation premium B2B hôpitaux.", deadline_days: 240 },
  { priority: "P1", title: "Hedger 60 % du volume FOB en INR via forward 3-6 mois", rationale: "INR a dévalué 4,8 % sur 12 mois. Si tu importes $100k/mois, exposition forex = $48k/an. Forward bancaire SG ou BNPP coûte ~0,8 %, à fait sens.", expected_outcome: "Stabilisation marge brute · cash flow visibilité +6 mois.", deadline_days: 30 },
  { priority: "P2", title: "Activer FTG bizplan IA pour générer le BP banque/BPI Inde-FR import", rationale: "FTG inclut la génération bizplan. Tu obtiens un BP 28 pages avec ce rapport en annexe + projections 36 mois + risques chiffrés.", expected_outcome: "BP banquier/BPI prêt en 24h · économie cabinet €5-15k.", deadline_days: 7 },
  { priority: "P2", title: "Diversifier sourcing : ajouter 2 fournisseurs hors top 10 (rang 11-25 IN ou Vietnam/Bangladesh)", rationale: "Concentration top 10 = 51 % volume = risque concentration. Diversification dès volume cumulé > $300k.", expected_outcome: "4-6 fournisseurs vs top 1-3 actuel · résilience supply chain x2.", deadline_days: 180 },
];

export const SOURCES = [
  { citation: "UN Comtrade (Comtrade.un.org). HS 9018 IN→FR · 12 mois 2025-04 to 2026-03.", url: "https://comtradeplus.un.org/" },
  { citation: "Eurostat. EU intra/extra trade by HS code (DS-018995).", url: "https://ec.europa.eu/eurostat/web/international-trade-in-goods/data/database" },
  { citation: "EU TARIC. Tariff and Trade Database · HS 9018 sub-codes.", url: "https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp" },
  { citation: "DGDDI · Direction générale des douanes et droits indirects · publications statistiques 2026.", url: "https://www.douane.gouv.fr/dossier/le-commerce-exterieur-de-la-france" },
  { citation: "Government of India · Ministry of Commerce & Industry · PLI Scheme Medical Devices.", url: "https://commerce.gov.in/about-us/divisions/foreign-trade-and-territorial-divisions/" },
  { citation: "EU MDR 2017/745 · Regulation on medical devices · consolidated text 2024.", url: "https://eur-lex.europa.eu/eli/reg/2017/745/oj" },
  { citation: "WTO Trade Profile · India Medical Devices Sector 2025.", url: "https://www.wto.org/english/res_e/statis_e/wtsiprofile_e.htm" },
  { citation: "Hindustan Syringes & Medical Devices Ltd · Annual Report 2024-25.", url: "https://www.hmdhealthcare.com/" },
  { citation: "Poly Medicure Ltd · BSE Investor Relations 2025.", url: "https://www.polymedicure.com/" },
  { citation: "Becton Dickinson India · Sustainability & Quality Report 2024.", url: "https://www.bd.com/en-in/" },
  { citation: "UGAP · Centrale d'achat publique · marchés HS-9018 publics 2025.", url: "https://www.ugap.fr/" },
  { citation: "RESAH-IDF · Réseau des acheteurs hospitaliers IDF · publications 2025.", url: "https://www.resah.fr/" },
  { citation: "Banque de France · Statistiques INR/EUR 2025-2026.", url: "https://www.banque-france.fr/statistiques/" },
  { citation: "International Maritime Bureau (IMB) · Suez canal piracy & blockage report Q1 2026.", url: "https://www.icc-ccs.org/" },
  { citation: "World Bank · India tariff policy 2024-2026.", url: "https://wits.worldbank.org/CountryProfile/en/Country/IND" },
];
