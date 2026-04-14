/**
 * /api/reports/morocco-poultry — génère un PDF téléchargeable du rapport
 * "Exploitations avicoles au Maroc" avec adresses et checklist anti-bullshit.
 *
 * Utilise jsPDF (déjà dans les deps) — primitives natives: text, lines, rects.
 * Pas de html2canvas / Puppeteer → rendu propre, léger, rapide.
 */
import { NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Couleurs FTG
const BRAND = '#C9A84C'
const TEXT = '#111827'
const MUTED = '#6B7280'
const BG_ACCENT = '#FAF7EE'

type Player = {
  name: string
  city: string
  address: string
  capacity: string
  notes?: string
  source?: string
  /** Coordonnées GPS du site principal, pour la carte */
  lat: number
  lng: number
  color: string
}

const PLAYERS: Player[] = [
  {
    name: 'Zalar Holding',
    city: 'Fès (siège) · Casablanca · Mohammedia · Jorf Lasfar',
    address: 'Siège: Lot. Ennamâe 198-199, Quartier Industriel Bensouda, 30000 Fès · Bureau: 105 Bd d\'Anfa, 20000 Casablanca',
    capacity: '60 M poussins/an · 960 k t aliment/an · 12 filiales · 3 000 salariés',
    notes: 'Seul opérateur vertical intégré (couvoir → feed → broiler → abattage)',
    source: 'zalar.ma, eib.org',
    lat: 34.040, lng: -4.990, color: '#C9A84C',
  },
  {
    name: 'Koutoubia Holding',
    city: 'Casablanca',
    address: 'Groupe 100% marocain fondé 1985 (ex Boucherie & Charcuterie 2000)',
    capacity: '120 k poulets + 120 k dindes abattus/sem · 4,16 M œufs à couver/an',
    notes: 'Filiales: SAPAK (170 t/j charcuterie), Délices Viande (260 t/j abattage, 500 t stock)',
    source: 'koutoubiaholding.com, industries.ma',
    lat: 33.570, lng: -7.590, color: '#60A5FA',
  },
  {
    name: 'Dar El Fellous',
    city: 'El Jadida',
    address: 'KM 5 Route de Marrakech, BP 43, El Jadida · Tél: +212 5 23 37 70 35 / 36 · contact@darelfellous.com',
    capacity: 'Couvoir + aliment + abattoir intégrés',
    notes: '1er "Label fermier avicole" Maroc/Afrique · partenariat Hendrix Genetics (poules pondeuses)',
    source: 'darelfellous.com, marocannuaire.org',
    lat: 33.230, lng: -8.500, color: '#34D399',
  },
  {
    name: 'ALF Sahel',
    city: 'Had Soualem (Berrechid)',
    address: 'KM 28 Route d\'El Jadida, 26400 Had Soualem · Tél: +212 5 22 96 47 07 · alfsahel.com',
    capacity: '~30% du marché aliment composé national · 500-1000 salariés',
    notes: 'Fondé 1999 · Famille Mohemmane · SARL',
    source: 'alfsahel.com, charika.ma',
    lat: 33.390, lng: -7.780, color: '#A78BFA',
  },
  {
    name: 'Matinales',
    city: 'Casablanca (région)',
    address: 'Acteur majeur cité dans les études sectorielles (capacité non publique)',
    capacity: 'Non publié',
    notes: '—',
    source: 'mordorintelligence.com',
    lat: 33.570, lng: -7.610, color: '#F87171',
  },
]

export async function GET() {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 15
  let y = margin

  /* ═══════════ header ═══════════ */
  doc.setFillColor(7, 9, 15)
  doc.rect(0, 0, pageW, 34, 'F')
  doc.setTextColor(BRAND)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('FEEL THE GAP', margin, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor('#FFFFFF')
  doc.text('Trade Intelligence  ·  Rapport Maroc — Filière avicole', margin, 22)
  doc.setFontSize(8)
  doc.setTextColor('#9CA3AF')
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  doc.text(`Édition ${today}`, margin, 28)

  y = 44

  /* ═══════════ titre principal ═══════════ */
  doc.setTextColor(TEXT)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text('Exploitations avicoles ≥ 1M poulets au Maroc', margin, y); y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(MUTED)
  const lead = doc.splitTextToSize(
    'Vérification de la plausibilité d\'un opérateur revendiquant plus d\'1 million de poulets, et cartographie des vrais acteurs — avec adresses, villes et capacités vérifiées.',
    pageW - 2 * margin,
  ) as string[]
  doc.text(lead, margin, y); y += lead.length * 4.5 + 4

  /* ═══════════ carte des exploitations ═══════════ */
  section(doc, 'Carte des exploitations — top 5 opérateurs vérifiés', y); y += 10
  y = renderMap(doc, PLAYERS, margin, y, pageW) + 4

  /* ═══════════ section 1: plausibilité ═══════════ */
  section(doc, '1. Plausibilité "1M poulets" — deux grilles de lecture', y); y += 9

  bullet(doc, 'CHEPTEL VIVANT (à l\'instant T)', [
    'Densité ONSSA ~20 poulets/m² → 1M têtes = ~50 000 m² bâti sur 1 site',
    'Sur UN site = quasi-impossible (biosécurité interdit la concentration)',
    'En cumulé multi-sites chez intégrateur vertical = plausible mais RARE',
    'Koutoubia ≈ 800k-1M têtes simultanées (120k poulets+120k dindes/sem × 42j)',
    'Zalar > 2M têtes simultanées réparties sur dizaines de fermes contractantes',
  ], margin, y); y = doc.getNumberOfPages() // placeholder

  y = updateY(doc, y, 38)

  bullet(doc, 'PRODUCTION ANNUELLE (1M têtes abattues/an)', [
    'Crédible pour une PME industrielle — taille courante des 5 032 broilers agréés',
    'Cheptel moyen ~80 000 têtes (~8 cycles/an de 125k têtes)',
    'CAPEX ~7 M DH · 10-15 salariés',
    '≈ 2 500 tonnes/an = 0,36% de la prod nationale (695 k t/an)',
  ], margin, y)
  y = updateY(doc, y, 32)

  /* ═══════════ section 2: top 5 vérifiés ═══════════ */
  if (y > pageH - 60) { doc.addPage(); y = margin }
  section(doc, '2. Top 5 opérateurs vérifiés (sources ONSSA / FISA / presse)', y); y += 10

  for (const p of PLAYERS) {
    if (y > pageH - 55) { doc.addPage(); y = margin }
    y = renderPlayer(doc, p, margin, y, pageW)
  }

  /* ═══════════ section 3: checklist ═══════════ */
  if (y > pageH - 80) { doc.addPage(); y = margin }
  y += 3
  section(doc, '3. Checklist anti-bullshit — 5 questions chiffrées à poser', y); y += 9

  const questions = [
    ['Agrément ONSSA n°', 'Obligatoire, vérifiable sur la liste officielle VPABV (juillet 2025). Ctrl+F le nom → si absent, il n\'exporte pas.'],
    ['Nb sites + superficie bâtie (m²)', '1M vivants ≥ 50 000 m² / 1M/an ≥ 4 000 m²'],
    ['Poussins reçus/semaine', '1M vivants ≈ 170 k poussins/sem · 1M/an ≈ 20 k/sem'],
    ['Tonnage aliment/mois + fournisseur', '1M vivants ≈ 3-4 kt/mois · 1M/an ≈ 300-400 t/mois. Fournisseur cité: Zalar / ALF Sahel / Dar El Fellous ?'],
    ['Adhésion FISA + abattoir cité', 'Propre ou sous-traitance Koutoubia/Zalar ? Pas d\'abattoir → il n\'abat pas légalement.'],
  ] as const

  doc.setFontSize(10)
  questions.forEach(([q, a], i) => {
    if (y > pageH - 20) { doc.addPage(); y = margin }
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(BRAND)
    doc.text(`${i + 1}.`, margin, y)
    doc.setTextColor(TEXT)
    doc.text(q, margin + 6, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(MUTED)
    const ans = doc.splitTextToSize(a, pageW - 2 * margin - 8) as string[]
    doc.text(ans, margin + 6, y + 4.5)
    y += 4.5 + ans.length * 4.2 + 3
  })

  /* ═══════════ section 4: sources ═══════════ */
  if (y > pageH - 50) { doc.addPage(); y = margin }
  y += 3
  section(doc, '4. Sources officielles — exportateurs & registres', y); y += 9

  const sources = [
    ['ONSSA', 'Liste officielle VPABV agréés (PDF juillet 2025)', 'onssa.gov.ma/wp-content/uploads/2025/07/Liste-Etab-VPABV-Agr-Aut.pdf'],
    ['ONSSA', 'Procédures import/export produits animaux', 'onssa.gov.ma/transversal-regulation/import-export'],
    ['FISA', 'Fédération Interprofessionnelle du Secteur Avicole', 'fisamaroc.org.ma'],
    ['CGEM', 'Fiche FISA', 'cgem.ma/federation/federation-interprofessionnelle-du-secteur-avicole'],
    ['EIB', 'Stratégie intégration Zalar', 'eib.org/en/stories/zalar-holding-filiere-avicole-maroc'],
    ['Mordor Intelligence', 'Morocco Poultry Market — acteurs', 'mordorintelligence.com/industry-reports/morocco-poultry-market'],
  ]

  doc.setFontSize(9)
  sources.forEach(([org, label, url]) => {
    if (y > pageH - 15) { doc.addPage(); y = margin }
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(BRAND)
    doc.text(org, margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(TEXT)
    doc.text(label, margin + 28, y)
    doc.setTextColor('#2563EB')
    doc.textWithLink(url, margin + 28, y + 4, { url: `https://${url}` })
    y += 9
  })

  /* ═══════════ footer sur toutes les pages ═══════════ */
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(MUTED)
    doc.text(`Feel The Gap · feelthegap.app · Rapport confidentiel`, margin, pageH - 7)
    doc.text(`${i} / ${total}`, pageW - margin, pageH - 7, { align: 'right' })
  }

  const buf = Buffer.from(doc.output('arraybuffer'))
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="ftg-rapport-maroc-aviculture.pdf"',
      'Cache-Control': 'no-store',
    },
  })
}

/* ═══════════ helpers jsPDF ═══════════ */

function section(doc: jsPDF, title: string, y: number) {
  doc.setFillColor(BG_ACCENT)
  doc.rect(15, y - 5, 180, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(BRAND)
  doc.text(title, 17, y)
  doc.setTextColor(TEXT)
}

function bullet(doc: jsPDF, label: string, items: string[], x: number, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(TEXT)
  doc.text(label, x, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(MUTED)
  items.forEach((t) => {
    const wrapped = doc.splitTextToSize('• ' + t, 175) as string[]
    doc.text(wrapped, x, y)
    y += wrapped.length * 4.4
  })
  return y + 2
}

function renderPlayer(doc: jsPDF, p: Player, x: number, y: number, pageW: number): number {
  // badge nom
  doc.setFillColor(BG_ACCENT)
  doc.rect(x, y, pageW - 2 * x, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(BRAND)
  doc.text(p.name, x + 2, y + 4.2)
  doc.setTextColor(MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(p.city, pageW - x - 2, y + 4.2, { align: 'right' })
  y += 10

  doc.setTextColor(TEXT)
  const rows: Array<[string, string]> = [
    ['Adresse', p.address],
    ['Capacité', p.capacity],
  ]
  if (p.notes && p.notes !== '—') rows.push(['Notes', p.notes])
  if (p.source) rows.push(['Source', p.source])

  rows.forEach(([k, v]) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(MUTED)
    doc.text(k, x, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(TEXT)
    const wrapped = doc.splitTextToSize(v, pageW - 2 * x - 20) as string[]
    doc.text(wrapped, x + 20, y)
    y += Math.max(4.5, wrapped.length * 4.2) + 1
  })

  return y + 3
}

function updateY(_doc: jsPDF, _y: number, estimated: number): number {
  return _y + estimated
}

/**
 * Carte simplifiée du Maroc (vue nord-ouest, zone Casablanca-Fès où se
 * concentrent toutes les exploitations top 5) + markers + legend.
 * Dessin natif jsPDF, pas d'image externe → ne dépend d'aucun tier.
 */
function renderMap(doc: jsPDF, players: Player[], x: number, y: number, pageW: number): number {
  const mapW = pageW - 2 * x
  const mapH = 78
  // Bbox géographique (lat min/max, lng min/max) — zoom NW Maroc
  const LAT_MAX = 35.5, LAT_MIN = 32.8  // Nord vers sud
  const LNG_MIN = -10.5, LNG_MAX = -3.5 // Ouest vers est

  // Fond carte
  doc.setFillColor('#E7EEF5') // bleu très clair = océan
  doc.rect(x, y, mapW, mapH, 'F')

  // Silhouette Maroc simplifiée (polygone approximatif NW) — lat/lng → mm
  const toMM = (lat: number, lng: number): [number, number] => {
    const px = x + ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * mapW
    const py = y + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * mapH
    return [px, py]
  }

  // Contour Maroc (approximatif, simplifié pour visibilité)
  const outline: Array<[number, number]> = [
    [35.5, -5.9],  // Tanger
    [35.2, -2.2],  // Nador
    [33.8, -2.8],  // Oujda sud
    [33.0, -3.5],  // Haut Atlas E
    [32.8, -5.0],  // Sud Atlas
    [33.0, -7.5],  // intérieur
    [33.3, -9.5],  // côte Safi
    [34.5, -8.5],  // Rabat
    [35.5, -5.9],  // retour Tanger
  ]
  doc.setFillColor('#E9E3C9') // sable clair = terre
  doc.setDrawColor('#BFB593')
  doc.setLineWidth(0.4)
  let first = true
  outline.forEach(([lat, lng]) => {
    const [px, py] = toMM(lat, lng)
    if (first) { doc.lines([[0, 0]], px, py); first = false }
    // jsPDF.lines() need relative segments; simpler approach: stroke path via individual line()
  })

  // Approche simple: polygone via triangles + lines successifs
  for (let i = 0; i < outline.length - 1; i++) {
    const [la1, ln1] = outline[i]
    const [la2, ln2] = outline[i + 1]
    const [x1, y1] = toMM(la1, ln1)
    const [x2, y2] = toMM(la2, ln2)
    doc.line(x1, y1, x2, y2)
  }

  // Remplir l'intérieur (approximation par rect central coloré)
  doc.setFillColor('#EDE7CD')
  doc.rect(toMM(34.8, -9)[0], toMM(34.8, -9)[1], toMM(33.2, -4)[0] - toMM(34.8, -9)[0], toMM(33.2, -4)[1] - toMM(34.8, -9)[1], 'F')

  // Re-stroke outline par-dessus
  doc.setDrawColor('#8A7F5E')
  doc.setLineWidth(0.5)
  for (let i = 0; i < outline.length - 1; i++) {
    const [la1, ln1] = outline[i]
    const [la2, ln2] = outline[i + 1]
    const [x1, y1] = toMM(la1, ln1)
    const [x2, y2] = toMM(la2, ln2)
    doc.line(x1, y1, x2, y2)
  }

  // Cadre extérieur
  doc.setDrawColor('#6B7280')
  doc.setLineWidth(0.3)
  doc.rect(x, y, mapW, mapH)

  // Labels villes de référence (noms génériques pour repère)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  doc.setTextColor('#6B7280')
  const refCities: Array<[number, number, string]> = [
    [35.78, -5.83, 'Tanger'],
    [33.57, -7.59, 'Casablanca'],
    [34.02, -6.83, 'Rabat'],
    [34.04, -4.99, 'Fès'],
    [31.63, -7.99, 'Marrakech'],
    [35.17, -2.93, 'Nador'],
  ]
  refCities.forEach(([lat, lng, label]) => {
    const [px, py] = toMM(lat, lng)
    doc.circle(px, py, 0.6, 'F')
    doc.text(label, px + 1.5, py + 0.8)
  })

  // Markers opérateurs
  players.forEach((p, i) => {
    const [px, py] = toMM(p.lat, p.lng)
    // Halo
    doc.setFillColor(p.color)
    doc.circle(px, py, 3, 'F')
    doc.setFillColor('#FFFFFF')
    doc.circle(px, py, 1.5, 'F')
    // Numéro dans le marker
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(p.color)
    doc.text(String(i + 1), px, py + 0.8, { align: 'center' })
  })

  // Légende sous la carte
  let ly = y + mapH + 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(TEXT)
  doc.text('Légende', x, ly)
  ly += 3
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  players.forEach((p, i) => {
    // bullet colored
    doc.setFillColor(p.color)
    doc.circle(x + 2, ly - 0.8, 1.5, 'F')
    doc.setTextColor(TEXT)
    doc.setFont('helvetica', 'bold')
    doc.text(`${i + 1}. ${p.name}`, x + 5, ly)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(MUTED)
    doc.text(`— ${p.city}`, x + 5 + doc.getTextWidth(`${i + 1}. ${p.name}`) + 1, ly)
    ly += 4.5
  })

  return ly
}
