/**
 * /api/reports/ftg-vs-bloomberg-reuters — PDF stratégique
 * "FTG vs Bloomberg / Reuters — Analyse de positionnement"
 *
 * Pourquoi FTG crée une catégorie orthogonale que BBG/Reuters ne peuvent pas copier.
 * 7 moats inattaquables + AI matching + souveraineté + trajectoire ARR Y0-Y8.
 *
 * Utilise jsPDF primitives (rect, line, text) — pas de Puppeteer.
 */
import { NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Brand FTG
const BRAND = '#C9A84C'
const TEXT = '#111827'
const MUTED = '#6B7280'
const BG_ACCENT = '#FAF7EE'
const DARK = '#07090F'
const ACCENT_BLUE = '#60A5FA'
const ACCENT_RED = '#EF4444'
const ACCENT_GREEN = '#10B981'

export async function GET() {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentW = pageW - 2 * margin

  /* ═══════════ PAGE 1 — COVER ═══════════ */
  doc.setFillColor(DARK)
  doc.rect(0, 0, pageW, pageH, 'F')

  // Brand bar top
  doc.setFillColor(BRAND)
  doc.rect(0, 0, pageW, 3, 'F')

  // FTG logo block
  doc.setTextColor(BRAND)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.text('FEEL THE GAP', margin, 40)
  doc.setTextColor('#9CA3AF')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Strategic Analysis · Trade Operations Platform', margin, 48)

  // Title block (centered vertical)
  doc.setTextColor('#FFFFFF')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  const title1 = doc.splitTextToSize('FTG vs Bloomberg / Reuters', contentW) as string[]
  doc.text(title1, margin, 110)
  doc.setFontSize(18)
  doc.setTextColor(BRAND)
  doc.text('Analyse de positionnement', margin, 124)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor('#D1D5DB')
  const subtitle = doc.splitTextToSize(
    'Pourquoi FTG crée une catégorie orthogonale que Bloomberg et Reuters ne peuvent pas copier par construction — moats, AI matching, souveraineté et trajectoire ARR 2026-2034.',
    contentW,
  ) as string[]
  doc.text(subtitle, margin, 140)

  // Footer block
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(BRAND)
  doc.text('v1 · Avril 2026', margin, pageH - 30)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor('#9CA3AF')
  doc.text('Document confidentiel — Feel The Gap Strategic Analysis', margin, pageH - 24)
  doc.text('Consolidé depuis les décisions stratégiques 2026-04-17 (country-population + production 3.0).', margin, pageH - 19)

  /* ═══════════ PAGE 2 — EXECUTIVE SUMMARY ═══════════ */
  doc.addPage()
  let y = headerBar(doc, 'Executive Summary', margin, pageW)
  y += 4

  doc.setTextColor(TEXT)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('6 points à retenir', margin, y); y += 8

  const execBullets: [string, string][] = [
    [
      'Catégorie orthogonale, pas concurrent frontal.',
      'FTG est une "Trade Operations Platform" pour exportateurs/États/producteurs du Sud. Bloomberg et Reuters sont des plateformes de marchés financiers temps réel pour traders du Nord. Overlap minime (commodity data, angles opposés).',
    ],
    [
      '7 moats inattaquables par construction.',
      'Data crowdsourcée producteurs, partenariats étatiques exclusifs, network effect bilatéral, narrative "tech souveraine du Sud", stack full entrepreneur, 15 langues du Sud + mobile money natif, Solo Producer €19.99/mo post-IA.',
    ],
    [
      'Triangle AI Matching + Sovereignty + Training = non-copiable.',
      'Chaque axe pris seul se copie en 3-5 ans. Les trois ensemble = moat géopolitique + opérationnel que BBG (US Cloud Act), Reuters (héritage UK), Alibaba (transfert data CN) ne peuvent adresser.',
    ],
    [
      'Trajectoire ARR : €14M Y0 → €1 Md Y5 → €40-60 Mds Y8.',
      'Dépassement Bloomberg ($13 Mds CA) attendu Y5-Y6. Sans IPO, sans VC majoritaire, marge 70-85%, founder >80%.',
    ],
    [
      'Commission marketplace 2.5% alignée.',
      'Producteurs et acheteurs paient zéro accès — la plateforme gagne uniquement quand un deal est confirmé (escrow POD). BBG ne close pas de deal, donc ne capte pas le value layer.',
    ],
    [
      'Pilote validé E2E — café Côte d\'Ivoire.',
      '10 producteurs × 3 acheteurs → 24 matches ≥ 60 pts de score · GMV €195 005 · commission théorique €4 875 sur 1 seul run. Preuve que le scoring matche bien les paires réalistes.',
    ],
  ]

  y = paraBlocks(doc, execBullets, margin, y, contentW)
  addFooter(doc, pageW, pageH, margin)

  /* ═══════════ PAGE 3 — MATRICE POSITIONNEMENT ═══════════ */
  doc.addPage()
  y = headerBar(doc, 'Matrice de positionnement', margin, pageW)
  y += 4
  doc.setTextColor(MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const intro3 = doc.splitTextToSize(
    'Lecture côte-à-côte des trois acteurs sur les dimensions clés. La catégorie FTG est définie à un niveau différent : trade opérationnel long-cycle vs finance/news temps réel.',
    contentW,
  ) as string[]
  doc.text(intro3, margin, y); y += intro3.length * 4.5 + 4

  const matrixRows: string[][] = [
    ['Dimension', 'Bloomberg', 'Reuters / Refinitiv', 'FTG'],
    ['CA annuel', '~$13 Mds', '~$7 Mds', '€14M (base 2026)'],
    ['Cœur de data', 'Finance, markets,\ntemps réel', 'News finance,\nmarket data', 'Trade opérationnel\n(coûts, corridors, régul.)'],
    ['Clients', 'Traders, banques,\nhedge funds', 'Salles marché,\nmédia, compliance', 'Exportateurs, États,\nentrepreneurs, producteurs'],
    ['Horizon temps', 'Milliseconde', 'Minute', 'Mois — saisons'],
    ['Géographie', 'Developed markets', 'Developed markets', '195 pays dont Sud'],
    ['Source data', 'Feeds institutionnels\nachetés', 'Feeds institutionnels\nachetés', 'Native + crowdsourcée\nproducteurs'],
    ['Langues', 'EN + 5-8 majeures', 'EN + majeures', '15 langues dont SW,\nWO, AM, KH, KO'],
  ]

  y = simpleTable(doc, matrixRows, [40, 45, 45, 50], margin, y)

  y += 6
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.setTextColor(MUTED)
  const callout = doc.splitTextToSize(
    'Overlap réel : uniquement commodity data — et même là, angles opposés (BBG = spot prices pour traders, FTG = TCO export par corridor pour exportateurs). Positionnement officiel : "Trade Operations Platform" (nouvelle catégorie, complément Bloomberg, PAS concurrent).',
    contentW,
  ) as string[]
  doc.text(callout, margin, y)

  addFooter(doc, pageW, pageH, margin)

  /* ═══════════ PAGE 4 — 7 MOATS ═══════════ */
  doc.addPage()
  y = headerBar(doc, '7 moats inattaquables par construction', margin, pageW)
  y += 4

  doc.setTextColor(MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const intro4 = doc.splitTextToSize(
    'Chaque axe pris seul = copiable en 3-5 ans. Les 7 ensemble = moat géopolitique + opérationnel non-reproductible par BBG (US) / Reuters (UK) / Alibaba (CN) / Statista (DE).',
    contentW,
  ) as string[]
  doc.text(intro4, margin, y); y += intro4.length * 4.5 + 4

  const moats: [string, string, string][] = [
    ['Data crowdsourcée producteurs', 'Les producteurs ne contribuent que si la plateforme leur apporte déjà des clients — chicken-and-egg qu\'il faut avoir déjà résolu pour attaquer.', '>10 ans'],
    ['Partenariats étatiques exclusifs', 'Un État ne signe qu\'avec UNE référence par pays (politique). Si FTG est premier, BBG/Reuters sont définitivement bloqués sur ce pays.', 'Impossible si 1er'],
    ['Network effect bilatéral', 'Producteurs ↔ acheteurs : chaque nouveau côté renforce l\'autre. BBG n\'a jamais construit le side producteur.', '5-7 ans'],
    ['Narrative "tech souveraine du Sud"', 'BBG (US) = Cloud Act. Reuters (UK) = héritage colonial. Alibaba (CN) = transfert data CN. Aucun n\'a la crédibilité géopolitique Sud.', 'Non-copiable by design'],
    ['Stack full entrepreneur', 'Opportunité → training → suppliers → clients → financement. Concurrents = 1 brique max. Reconstruire le parcours complet = 5 ans + €500M.', '5-7 ans'],
    ['15 langues Sud + mobile money natif', 'SW, WO, AM, KH, KO, ID + Flutterwave/M-Pesa/Wave/Orange Money/MTN MoMo. Pas rentable pour BigTech, marché principal pour nous.', '3-5 ans pas rentable'],
    ['Solo Producer €19.99/mo (post-IA)', '200-400M personnes adressables mondialement. BBG ne baissera jamais à €19.99 (cannibalise $24K/terminal).', 'Impossible sans casser le modèle'],
  ]

  y = moatsTable(doc, moats, margin, y, contentW)

  addFooter(doc, pageW, pageH, margin)

  /* ═══════════ PAGES 5-6 — AI MATCHING DEEP-DIVE ═══════════ */
  doc.addPage()
  y = headerBar(doc, 'AI Matching — l\'algorithme qui ferme les deals', margin, pageW)
  y += 4

  doc.setTextColor(TEXT)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Scoring 100 points (agent matcher.ts opérationnel)', margin, y); y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(MUTED)
  const introMatch = doc.splitTextToSize(
    'Le matcher croise 8 dimensions techniques entre une offre producteur (production_volumes) et une demande acheteur (buyer_demands). Score ≥ 60 = match qualifié. Top 3 des deux côtés pour chaque item.',
    contentW,
  ) as string[]
  doc.text(introMatch, margin, y); y += introMatch.length * 4.5 + 4

  const scoringRows: [string, number, string][] = [
    ['Produit (HS6 exact)', 20, 'Synonymes multilingues (cacao / cocoa / kakao / ココア)'],
    ['Qualité', 15, 'Grades micro (Arabica 1 vs 2), grades industriels (lint textile)'],
    ['Certifications', 15, 'Compatibilité croisée Bio EU ↔ USDA Organic ↔ JAS'],
    ['Quantité', 15, 'Agrégation virtuelle : 50 producteurs × 100kg = lot 5T industriel'],
    ['Prix', 15, 'Fenêtre plancher-plafond dynamique, spot FAO/ICO'],
    ['Incoterm', 10, 'EXW ⇌ CIF selon logistique disponible (FOB, CIF, DAP…)'],
    ['Origine', 5, 'Corridors préférentiels (ZLECAf, OMC quotas, APE)'],
    ['Deadline', 5, 'Fenêtres saisonnières (récoltes, transformations)'],
  ]

  y = scoringTable(doc, scoringRows, margin, y, contentW)

  addFooter(doc, pageW, pageH, margin)

  // Page 6 — Pourquoi irrattrapable
  doc.addPage()
  y = headerBar(doc, 'AI Matching — 5 raisons irrattrapable', margin, pageW)
  y += 4

  const matchReasons: [string, string][] = [
    [
      '1. Agrégation virtuelle',
      'Alibaba = liste, pas match. FTG agrège automatiquement 50 petits producteurs pour matcher un lot industriel. Les petits n\'auraient jamais trouvé l\'acheteur seuls.',
    ],
    [
      '2. Réversibilité bilatérale',
      'Le match propose top-3 pour chaque côté, pas de lock-in. Producteur voit ses offres, acheteur voit ses options. Confiance mutuelle → accept rate plus élevé.',
    ],
    [
      '3. Data de contexte',
      'Le matcher lit country_regulations, logistics_corridors, production_cost_benchmarks. Il sait pourquoi une paire est possible OU bloquée (ex: cacao CIV → CN bloqué par quota import CN 2026).',
    ],
    [
      '4. Apprentissage closed-loop',
      'Chaque deal confirmed → released (escrow POD) enrichit les scores. Bloomberg ne ferme jamais un deal, donc n\'apprend jamais quelle paire matche vraiment.',
    ],
    [
      '5. Commission 2.5% alignée',
      'Ni producteur ni acheteur ne paie l\'accès. La plateforme est gagnante uniquement quand ils closent. Incentive pur : match mou = zéro revenu → l\'algorithme optimise sur la close rate.',
    ],
  ]

  y = paraBlocks(doc, matchReasons, margin, y, contentW)

  y += 4
  doc.setFillColor(BG_ACCENT)
  doc.rect(margin, y, contentW, 26, 'F')
  doc.setTextColor(BRAND)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Pilote validé E2E — café Côte d\'Ivoire', margin + 3, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(TEXT)
  doc.text('10 producteurs × 3 acheteurs → 24 matches ≥ 60 points', margin + 3, y + 13)
  doc.text('GMV matché : €195 005 · Commission théorique : €4 875 (2.5%) sur 1 seul run matcher', margin + 3, y + 19)
  doc.setTextColor(MUTED)
  doc.setFontSize(8.5)
  doc.text('Preuve que le scoring matche bien les paires réalistes avant activation Stripe Connect escrow.', margin + 3, y + 24)

  addFooter(doc, pageW, pageH, margin)

  /* ═══════════ PAGES 7-8 — SOUVERAINETÉ + FORMATION ═══════════ */
  doc.addPage()
  y = headerBar(doc, 'Souveraineté par production locale — le pitch aux États', margin, pageW)
  y += 4

  doc.setFillColor('#FEF3C7')
  doc.rect(margin, y, contentW, 28, 'F')
  doc.setTextColor(TEXT)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(10)
  const pitch = doc.splitTextToSize(
    '« Vous dépensez €50-200M/an en études McKinsey, subventions export, agences gouvernementales. Vos citoyens producteurs ne trouvent pas de clients internationaux et passent par des traders étrangers qui captent 20-30% de la valeur. Nous vous offrons la plateforme qui rend votre pays autonome. »',
    contentW - 6,
  ) as string[]
  doc.text(pitch, margin + 3, y + 6)
  y += 32

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(TEXT)
  doc.text('3 briques proposées aux gouvernements', margin, y); y += 7

  const briques: [string, string][] = [
    [
      '1. Exposition producteurs nationaux',
      'Chaque citoyen producteur reçoit un profil gratuit. Sa production devient visible pour acheteurs mondiaux filtrant par pays. Désintermédiation : le trader étranger qui prenait 25% disparaît de la chaîne.',
    ],
    [
      '2. Formation intégrée (Production 3.0)',
      'Chaque opportunité exposée = méthodes de fabrication documentées (washed/natural/honey pour café ; capex/opex par scénario artisanal/semi/industriel). Vidéos formation par produit (video-scripts-generator). Coaching optionnel Solo Producer (€29/session). Le producteur ne reste pas bloqué sur l\'artisanal — la plateforme lui montre la voie vers la transformation à plus forte valeur.',
    ],
    [
      '3. Data souveraine retournée à l\'État',
      'L\'État branche ses données douanières officielles. FTG les enrichit (prix réels marketplace, volumes crowdsourcés). L\'État récupère une version enrichie qu\'il ne peut produire seul (il n\'a pas la crowdsourced data). Dashboard souverain gratuit pour ministère commerce/agriculture.',
    ],
  ]
  y = paraBlocks(doc, briques, margin, y, contentW)

  addFooter(doc, pageW, pageH, margin)

  // Page 8 — Inattaquable par acteurs étrangers + effet composé
  doc.addPage()
  y = headerBar(doc, 'Pourquoi inattaquable — matrice géopolitique', margin, pageW)
  y += 4

  const geoMatrix: [string, string, string][] = [
    ['Bloomberg (US)', 'Pays du Sud se méfient du Cloud Act (surveillance US juridiquement imposable).', 'Disqualifié structurellement'],
    ['Reuters (UK)', 'Héritage colonial mal vu en Afrique francophone / lusophone. Neutralité perçue faible.', 'Disqualifié culturellement'],
    ['Alibaba (CN)', 'Transfert data CN obligatoire (PIPL + National Security Law). Souveraineté tiers-monde compromise.', 'Disqualifié légalement'],
    ['Statista (DE)', 'Pure data publication, zéro side producteur. Pas d\'incentive à crowdsourcer.', 'Disqualifié par modèle'],
  ]

  doc.setTextColor(TEXT)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('FTG = seul acteur privé positionnable sur la neutralité + Sud + bottom-up', margin, y); y += 8

  y = moatsTable(doc, geoMatrix, margin, y, contentW)

  y += 6
  doc.setFillColor(BG_ACCENT)
  doc.rect(margin, y, contentW, 32, 'F')
  doc.setTextColor(BRAND)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Effet composé — seuils de basculement', margin + 3, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(TEXT)
  doc.text('• 1 000 producteurs / pays = la data FTG dépasse FAO / World Bank sur ce pays', margin + 3, y + 13)
  doc.text('• 30 pays à ce seuil = FTG devient référence mondiale implicite commodities du Sud', margin + 3, y + 19)
  doc.text('• Chaque État signataire = 1 référence exclusive par pays — verrouille Bloomberg définitivement', margin + 3, y + 25)
  doc.setTextColor(MUTED)
  doc.setFontSize(8.5)
  doc.text('Source : docs/country-population-strategy.md v1 (2026-04-17)', margin + 3, y + 30)

  addFooter(doc, pageW, pageH, margin)

  /* ═══════════ PAGES 9-10 — TRAJECTOIRE ARR ═══════════ */
  doc.addPage()
  y = headerBar(doc, 'Trajectoire ARR 2026-2034 — dépassement Bloomberg', margin, pageW)
  y += 4

  doc.setTextColor(MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const introChart = doc.splitTextToSize(
    'Échelle log pour rendre visible les premières années (Y0 €14M) face aux dernières (Y8 €40-60Mds). La ligne horizontale = Bloomberg $13Mds ≈ €12Mds. FTG dépasse Bloomberg Y5-Y6.',
    contentW,
  ) as string[]
  doc.text(introChart, margin, y); y += introChart.length * 4.5 + 4

  // Chart area
  const chartX = margin + 2
  const chartY = y
  const chartW = contentW - 4
  const chartH = 100

  drawARRChart(doc, chartX, chartY, chartW, chartH)
  y += chartH + 8

  // Légende chart
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(BRAND)
  doc.text('■', margin, y)
  doc.setTextColor(TEXT)
  doc.setFont('helvetica', 'normal')
  doc.text('ARR FTG (barres, échelle log)', margin + 5, y)
  doc.setTextColor(ACCENT_RED)
  doc.text('─ ─', margin + 72, y)
  doc.setTextColor(TEXT)
  doc.text('Bloomberg ~€12Mds (seuil à dépasser)', margin + 82, y)

  addFooter(doc, pageW, pageH, margin)

  // Page 10 — Table trajectoire + répartition capital
  doc.addPage()
  y = headerBar(doc, 'Trajectoire ARR détaillée + répartition capital Y5', margin, pageW)
  y += 4

  const arrRows: string[][] = [
    ['Année', 'ARR', 'Capital levé cumulé', 'Dilution founder'],
    ['Y0 (2026)', '€14M', '€0 (bootstrap)', '0 %'],
    ['Y1 (2027)', '€70M', '€15-25M (Seed + A)', '~10 %'],
    ['Y2 (2028)', '€220M', '+€60-100M (B)', '~25 %'],
    ['Y3 (2029)', '€480M', '+€150-250M (C)', '~40 %'],
    ['Y4 (2030)', '€750M', '+€200-300M (D)', '~50 %'],
    ['Y5 (2031)', '€1 000M', '€450-700M total', '~55-65 %'],
    ['Y6 (2032)', '€15-20 Mds', 'Dividendes + M&A', 'Stabilisé'],
    ['Y8 (2034)', '€40-60 Mds', 'Self-funded (FCF)', '< 20 %'],
  ]
  y = simpleTable(doc, arrRows, [30, 40, 55, 45], margin, y)

  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(TEXT)
  doc.text('Répartition capital cumulé Y5 (€600M)', margin, y); y += 7

  const capSlices: [string, number, string][] = [
    ['M&A acquisitions trade data + boutiques consulting', 33, ACCENT_BLUE],
    ['Commercial (closers, SDR, call centers)', 24, BRAND],
    ['Runway buffer + ops + legal', 17, ACCENT_GREEN],
    ['International 6 bureaux régionaux', 9, '#A78BFA'],
    ['Tech + IA + infra', 8, '#34D399'],
    ['Marketing + SEO + partenariats', 8, '#F87171'],
    ['Réserve stratégique', 1, MUTED],
  ]
  y = horizontalBars(doc, capSlices, margin, y, contentW)

  addFooter(doc, pageW, pageH, margin)

  /* ═══════════ PAGE 11 — PIPELINE Y1 ═══════════ */
  doc.addPage()
  y = headerBar(doc, 'Pipeline Y1 institutionnel — 168 prospects', margin, pageW)
  y += 4

  doc.setTextColor(MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const introPipe = doc.splitTextToSize(
    'Source : docs/sales-playbook/institutional-prospects-v1.md. Conversion hypothèse 15%. Tickets alignés sur offre API institutionnelle (€12K Starter / €40K Pro / €120K Enterprise / €300K+ Sovereign).',
    contentW,
  ) as string[]
  doc.text(introPipe, margin, y); y += introPipe.length * 4.5 + 4

  const pipelineRows: string[][] = [
    ['Segment', '# prospects', 'Ticket moyen', 'ARR Y1 (15% conv.)'],
    ['Ministères FR / EU / Afrique', '30', '€100K', '€450K'],
    ['Agences export (Business France, Pro-XYZ)', '25', '€60K', '€225K'],
    ['Consulats & Service Éco. régionaux', '40', '€25K', '€150K'],
    ['Instituts stats (INSEE, HCP, ANSD)', '15', '€40K', '€90K'],
    ['CCI régionales + internationales', '30', '€30K', '€135K'],
    ['Orgs internationales (FAO, FMI, BM, UNCTAD)', '12', '€200K', '€360K'],
    ['Universités / recherche', '10', '€20K', '€30K'],
    ['White-label consulting (McKinsey, BCG)', '6', '€350K', '€315K'],
    ['TOTAL', '168', '—', '€1,75M'],
  ]
  y = simpleTable(doc, pipelineRows, [70, 28, 32, 40], margin, y)

  y += 8
  doc.setFillColor(BG_ACCENT)
  doc.rect(margin, y, contentW, 30, 'F')
  doc.setTextColor(BRAND)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Unit economics — stratégie acquisition', margin + 3, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(TEXT)
  doc.text('• CAC blended : €500-1 000 / deal (scout IA + warm-up + call closer local + AI Whisperer)', margin + 3, y + 13)
  doc.text('• Comparable : €1 500-3 000 / deal AE senior Europe — FTG 2-3x moins cher', margin + 3, y + 19)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(BRAND)
  doc.text('• LTV / CAC : 180-360×  (vs 30× top décile SaaS)', margin + 3, y + 25)

  addFooter(doc, pageW, pageH, margin)

  /* ═══════════ PAGE 12 — THESIS & CONCLUSION ═══════════ */
  doc.addPage()
  y = headerBar(doc, 'Thèse & Conclusion', margin, pageW)
  y += 4

  doc.setTextColor(TEXT)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Récapitulatif stratégique', margin, y); y += 8

  const conclusions: [string, string][] = [
    [
      'FTG ne joue pas la catégorie Bloomberg / Reuters.',
      'Trade opérationnel long-cycle ≠ marchés financiers temps réel. Overlap minime sur commodity data.',
    ],
    [
      'FTG crée "Trade Operations Platform pour le Sud".',
      'Catégorie ouverte, premier entrant, référence implicite dès 30 pays à seuil 1 000 producteurs.',
    ],
    [
      'Triangle moat : AI Matching + Sovereignty + Training = non-copiable.',
      'Chaque axe seul copiable en 3-5 ans. Les trois ensemble = moat géopolitique + opérationnel non-reproductible.',
    ],
    [
      'Trajectoire Y5 €1 Md ARR, Y8 €40-60 Mds.',
      'Dépassement Bloomberg Y5-Y6. Sans IPO, sans VC majoritaire, marge 70-85%, founder >80%.',
    ],
    [
      'Commission 2.5% alignée sur la close rate.',
      'Marketplace opéré, pas juste listé. Zéro friction d\'accès — revenu uniquement sur deals confirmés (POD).',
    ],
    [
      'Conditions d\'exécution hockey-stick',
      '10+ contrats institutionnels signés M12 · Category creation "Trade Operations Platform" validée par VC tier-1 · Data moat 195 pays × 50 produits × 10 ans · M&A opportuniste (Trading Economics, IHS Maritime, boutiques consulting trade).',
    ],
  ]
  y = paraBlocks(doc, conclusions, margin, y, contentW)

  y += 4
  doc.setFillColor(DARK)
  doc.rect(margin, y, contentW, 36, 'F')
  doc.setTextColor(BRAND)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('La phrase qui dit tout', margin + 3, y + 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor('#FFFFFF')
  const finalLine = doc.splitTextToSize(
    '« Aucun concurrent privé ne peut copier le network effect parce qu\'il faut déjà avoir la masse pour attirer les contributeurs. Aucun concurrent étatique ne peut gagner parce que sa neutralité géopolitique est douteuse. FTG = seule position neutre + Sud + bottom-up disponible. »',
    contentW - 6,
  ) as string[]
  doc.text(finalLine, margin + 3, y + 16)

  addFooter(doc, pageW, pageH, margin)

  /* ═══════════ FOOTER FINAL ═══════════ */
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(MUTED)
    if (i > 1) {
      doc.text('Feel The Gap · Analyse Stratégique v1 · Avril 2026', margin, pageH - 7)
      doc.text(`Page ${i} / ${total}`, pageW - margin, pageH - 7, { align: 'right' })
    }
  }

  const buf = Buffer.from(doc.output('arraybuffer'))
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="ftg-vs-bloomberg-reuters-v1.pdf"',
      'Cache-Control': 'no-store',
    },
  })
}

/* ═══════════ helpers jsPDF ═══════════ */

function headerBar(doc: jsPDF, title: string, margin: number, pageW: number): number {
  doc.setFillColor(DARK)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setFillColor(BRAND)
  doc.rect(0, 22, pageW, 1.5, 'F')
  doc.setTextColor(BRAND)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('FEEL THE GAP', margin, 10)
  doc.setTextColor('#FFFFFF')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(13)
  doc.text(title, margin, 18)
  return 32
}

function addFooter(doc: jsPDF, pageW: number, pageH: number, margin: number) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(MUTED)
  doc.text('Feel The Gap · Analyse Stratégique v1 · Avril 2026', margin, pageH - 7)
}

function paraBlocks(
  doc: jsPDF,
  blocks: [string, string][],
  x: number,
  y: number,
  w: number,
): number {
  const pageH = doc.internal.pageSize.getHeight()
  for (const [label, text] of blocks) {
    if (y > pageH - 30) { doc.addPage(); y = 15 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(BRAND)
    const labelLines = doc.splitTextToSize(label, w) as string[]
    doc.text(labelLines, x, y)
    y += labelLines.length * 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(TEXT)
    const lines = doc.splitTextToSize(text, w) as string[]
    doc.text(lines, x, y)
    y += lines.length * 4.5 + 4
  }
  return y
}

function simpleTable(
  doc: jsPDF,
  rows: string[][],
  colWidths: number[],
  x: number,
  y: number,
): number {
  const pageH = doc.internal.pageSize.getHeight()
  const rowH = 8
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    const isHead = r === 0
    const isTotal = row[0] === 'TOTAL'

    // Compute wrapped row height
    let maxLines = 1
    const cellTexts: string[][] = []
    for (let c = 0; c < row.length; c++) {
      const lines = doc.splitTextToSize(row[c], colWidths[c] - 2) as string[]
      cellTexts.push(lines)
      if (lines.length > maxLines) maxLines = lines.length
    }
    const thisH = Math.max(rowH, maxLines * 4.5 + 2)

    if (y + thisH > pageH - 18) { doc.addPage(); y = 15 }

    // Background
    if (isHead) {
      doc.setFillColor(DARK)
      doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), thisH, 'F')
    } else if (isTotal) {
      doc.setFillColor(BG_ACCENT)
      doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), thisH, 'F')
    } else if (r % 2 === 0) {
      doc.setFillColor('#F9FAFB')
      doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), thisH, 'F')
    }

    // Text
    let cx = x
    for (let c = 0; c < row.length; c++) {
      doc.setFont('helvetica', isHead || isTotal ? 'bold' : 'normal')
      doc.setFontSize(9)
      doc.setTextColor(isHead ? '#FFFFFF' : isTotal ? BRAND : TEXT)
      doc.text(cellTexts[c], cx + 1.5, y + 5.5)
      cx += colWidths[c]
    }

    // Border
    doc.setDrawColor('#E5E7EB')
    doc.setLineWidth(0.1)
    doc.line(x, y + thisH, x + colWidths.reduce((a, b) => a + b, 0), y + thisH)

    y += thisH
  }
  return y
}

function moatsTable(
  doc: jsPDF,
  rows: [string, string, string][],
  x: number,
  y: number,
  w: number,
): number {
  const pageH = doc.internal.pageSize.getHeight()
  const col1W = 55
  const col2W = w - col1W - 35
  const col3W = 35

  // Header
  doc.setFillColor(DARK)
  doc.rect(x, y, w, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(BRAND)
  doc.text('Moat / Dimension', x + 1.5, y + 5.5)
  doc.setTextColor('#FFFFFF')
  doc.text('Pourquoi inattaquable', x + col1W + 1.5, y + 5.5)
  doc.text('Time-to-copy', x + col1W + col2W + 1.5, y + 5.5)
  y += 8

  for (let i = 0; i < rows.length; i++) {
    const [m, why, time] = rows[i]
    const whyLines = doc.splitTextToSize(why, col2W - 3) as string[]
    const mLines = doc.splitTextToSize(m, col1W - 3) as string[]
    const timeLines = doc.splitTextToSize(time, col3W - 3) as string[]
    const h = Math.max(mLines.length, whyLines.length, timeLines.length) * 4.3 + 4

    if (y + h > pageH - 18) { doc.addPage(); y = 15 }

    if (i % 2 === 0) {
      doc.setFillColor('#F9FAFB')
      doc.rect(x, y, w, h, 'F')
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(TEXT)
    doc.text(mLines, x + 1.5, y + 4)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(MUTED)
    doc.text(whyLines, x + col1W + 1.5, y + 4)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(BRAND)
    doc.text(timeLines, x + col1W + col2W + 1.5, y + 4)

    y += h
    doc.setDrawColor('#E5E7EB')
    doc.setLineWidth(0.1)
    doc.line(x, y, x + w, y)
  }
  return y
}

function scoringTable(
  doc: jsPDF,
  rows: [string, number, string][],
  x: number,
  y: number,
  w: number,
): number {
  const pageH = doc.internal.pageSize.getHeight()
  const col1W = 50
  const col2W = 20
  const col3W = w - col1W - col2W

  // Header
  doc.setFillColor(DARK)
  doc.rect(x, y, w, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(BRAND)
  doc.text('Dimension', x + 1.5, y + 5.5)
  doc.setTextColor('#FFFFFF')
  doc.text('Points', x + col1W + 1.5, y + 5.5)
  doc.text('Ce qu\'un humain rate', x + col1W + col2W + 1.5, y + 5.5)
  y += 8

  for (let i = 0; i < rows.length; i++) {
    const [dim, pts, human] = rows[i]
    const humanLines = doc.splitTextToSize(human, col3W - 3) as string[]
    const h = Math.max(8, humanLines.length * 4.3 + 3)

    if (y + h > pageH - 18) { doc.addPage(); y = 15 }

    if (i % 2 === 0) {
      doc.setFillColor('#F9FAFB')
      doc.rect(x, y, w, h, 'F')
    }

    // Score bar visualization
    const barW = (pts / 20) * (col2W - 5)
    doc.setFillColor(BRAND)
    doc.rect(x + col1W + 1.5, y + 2.5, barW, 3, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(TEXT)
    doc.text(dim, x + 1.5, y + 5)
    doc.setTextColor(BRAND)
    doc.text(`${pts}`, x + col1W + 1.5, y + 8.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(MUTED)
    doc.text(humanLines, x + col1W + col2W + 1.5, y + 4)

    y += h
    doc.setDrawColor('#E5E7EB')
    doc.setLineWidth(0.1)
    doc.line(x, y, x + w, y)
  }
  return y
}

function drawARRChart(doc: jsPDF, x: number, y: number, w: number, h: number) {
  // Axis
  doc.setDrawColor(MUTED)
  doc.setLineWidth(0.3)
  doc.line(x, y + h, x + w, y + h) // X
  doc.line(x, y, x, y + h) // Y

  const years = ['Y0', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8']
  const arrEUR_M = [14, 70, 220, 480, 750, 1000, 17500, 30000, 50000] // in €M, Y6/Y7/Y8 mid-range

  // Log scale
  const maxLog = Math.log10(60000)
  const minLog = Math.log10(10)
  const logRange = maxLog - minLog

  const barW = w / years.length * 0.6
  const gap = w / years.length

  // Bloomberg line at €12 000M
  const bbgLog = Math.log10(12000)
  const bbgY = y + h - ((bbgLog - minLog) / logRange) * h
  doc.setDrawColor(ACCENT_RED)
  doc.setLineWidth(0.5)
  doc.setLineDashPattern([1.5, 1.5], 0)
  doc.line(x + 2, bbgY, x + w - 2, bbgY)
  doc.setLineDashPattern([], 0)
  doc.setTextColor(ACCENT_RED)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Bloomberg ~€12 Mds', x + w - 42, bbgY - 1.5)

  // Gridlines + labels
  doc.setDrawColor('#E5E7EB')
  doc.setLineWidth(0.1)
  const ticks = [10, 100, 1000, 10000]
  doc.setTextColor(MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  for (const t of ticks) {
    const tY = y + h - ((Math.log10(t) - minLog) / logRange) * h
    doc.line(x, tY, x + w, tY)
    const label = t >= 1000 ? `€${t / 1000} Mds` : `€${t}M`
    doc.text(label, x - 2, tY + 1, { align: 'right' })
  }

  // Bars
  for (let i = 0; i < years.length; i++) {
    const cx = x + i * gap + (gap - barW) / 2
    const arr = arrEUR_M[i]
    const aLog = Math.log10(Math.max(arr, 10))
    const barH = ((aLog - minLog) / logRange) * h
    const isPostBloomberg = arr > 12000
    doc.setFillColor(isPostBloomberg ? ACCENT_GREEN : BRAND)
    doc.rect(cx, y + h - barH, barW, barH, 'F')

    // Value label on top
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(TEXT)
    const labelTxt = arr >= 1000 ? `${(arr / 1000).toFixed(arr >= 10000 ? 0 : 1)}Md` : `€${arr}M`
    doc.text(labelTxt, cx + barW / 2, y + h - barH - 1.5, { align: 'center' })

    // Year label
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(MUTED)
    doc.text(years[i], cx + barW / 2, y + h + 4, { align: 'center' })
  }
}

function horizontalBars(
  doc: jsPDF,
  slices: [string, number, string][],
  x: number,
  y: number,
  w: number,
): number {
  const pageH = doc.internal.pageSize.getHeight()
  const labelW = 90
  const barMaxW = w - labelW - 20

  for (const [label, pct, color] of slices) {
    if (y > pageH - 18) { doc.addPage(); y = 15 }
    const barW = (pct / 33) * barMaxW // max = 33% (M&A)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(TEXT)
    const labelLines = doc.splitTextToSize(label, labelW - 3) as string[]
    doc.text(labelLines, x, y + 4)
    doc.setFillColor(color)
    doc.rect(x + labelW, y + 1.5, barW, 4, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(BRAND)
    doc.text(`${pct}%`, x + labelW + barW + 2, y + 5)
    y += Math.max(7, labelLines.length * 4.5 + 2)
  }
  return y
}
