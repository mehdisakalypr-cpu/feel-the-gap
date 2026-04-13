// @ts-nocheck
/**
 * Feel The Gap — Seed Demo Accounts
 *
 * Crée 4 profils démo avec données réalistes pour les démos live :
 *   1. demo.entrepreneur@feelthegap.app  — entrepreneur + seller
 *      · 4 produits opt-in dans products_catalog
 *      · 1 dossier funding_dossiers type=financement (rempli + submitted)
 *      · 1 dossier funding_dossiers type=investissement (rempli + submitted)
 *      · 1 cached_business_plans pour CIV/cacao
 *
 *   2. demo.influenceur@feelthegap.app  — influenceur + entrepreneur
 *      · influencer_profiles setup
 *      · 3 favoris dans influencer_favorites
 *
 *   3. demo.financeur@feelthegap.app  — financeur
 *      · peut voir les dossiers type=financement de l'entrepreneur
 *
 *   4. demo.investisseur@feelthegap.app  — investisseur
 *      · peut voir les dossiers type=investissement de l'entrepreneur
 *
 * Tous les comptes utilisent le mot de passe défini dans process.env.DEMO_PASSWORD
 *
 * Usage:
 *   npx tsx scripts/seed-demo-accounts.ts          # create/update
 *   npx tsx scripts/seed-demo-accounts.ts --reset  # delete + recreate
 */

import * as fs from 'fs'
import * as path from 'path'

function loadEnv() {
  const p = path.resolve('.env.local')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}
loadEnv()

// Password sourced from env (DEMO_PASSWORD). Never commit a literal — sharing a
// password between code, docs and a running deployment causes silent password
// resets when the seeder runs against a user who has changed it elsewhere.
// Set DEMO_PASSWORD in .env.local AND in Vercel env (Production/Preview).
const DEMO_PASSWORD = process.env.DEMO_PASSWORD
if (!DEMO_PASSWORD || DEMO_PASSWORD.length < 8) {
  console.error('[seed-demo] DEMO_PASSWORD env var is missing or too short (min 8 chars). Set it in .env.local and Vercel env.')
  process.exit(1)
}
const DEMO_ACCOUNTS = [
  {
    email: 'demo.entrepreneur@feelthegap.app',
    full_name: 'Amélie Dubois (Demo)',
    company: 'Cacao de Côte d\'Ivoire SARL',
    roles: ['entrepreneur'],
    active_role: 'entrepreneur',
  },
  {
    email: 'demo.influenceur@feelthegap.app',
    full_name: 'Léa Martin (Demo)',
    company: 'Léa Martin Media',
    roles: ['entrepreneur', 'influenceur'],
    active_role: 'influenceur',
  },
  {
    email: 'demo.financeur@feelthegap.app',
    full_name: 'Pierre Laurent (Demo)',
    company: 'Banque Éthique SA',
    roles: ['entrepreneur', 'financeur'],
    active_role: 'financeur',
  },
  {
    email: 'demo.investisseur@feelthegap.app',
    full_name: 'Marie Chen (Demo)',
    company: 'Green Ventures Capital',
    roles: ['entrepreneur', 'investisseur'],
    active_role: 'investisseur',
  },
]

const reset = process.argv.includes('--reset')

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !serviceKey) throw new Error('Missing Supabase credentials')

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('[seed-demo] Starting…')

  const createdIds: Record<string, string> = {}

  for (const acc of DEMO_ACCOUNTS) {
    // Check if user exists
    const { data: list } = await admin.auth.admin.listUsers()
    const existing = list?.users.find((u) => u.email === acc.email)

    let userId: string
    if (existing) {
      if (reset) {
        console.log(`  ↻ delete ${acc.email}`)
        await admin.auth.admin.deleteUser(existing.id)
        const { data: created, error } = await admin.auth.admin.createUser({
          email: acc.email,
          password: DEMO_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: acc.full_name },
        })
        if (error || !created.user) throw new Error(`createUser ${acc.email}: ${error?.message}`)
        userId = created.user.id
      } else {
        // Existing user: do NOT overwrite password (would clobber any /auth/forgot
        // change). Use --reset to force-rotate, or --rotate-password explicitly.
        userId = existing.id
        if (process.argv.includes('--rotate-password')) {
          await admin.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD, email_confirm: true })
          console.log(`  ↻ rotated password for ${acc.email}`)
        } else {
          await admin.auth.admin.updateUserById(userId, { email_confirm: true })
        }
      }
      console.log(`  ✓ ${acc.email} (${userId.slice(0, 8)})`)
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: acc.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: acc.full_name },
      })
      if (error || !created.user) throw new Error(`createUser ${acc.email}: ${error?.message}`)
      userId = created.user.id
      console.log(`  + ${acc.email} (${userId.slice(0, 8)})`)
    }
    createdIds[acc.email] = userId

    // Upsert profile
    await admin.from('profiles').upsert({
      id: userId,
      email: acc.email,
      full_name: acc.full_name,
      company: acc.company,
      tier: acc.roles.includes('influenceur') || acc.roles.includes('financeur') || acc.roles.includes('investisseur') ? 'premium' : 'strategy',
      roles: acc.roles,
      active_role: acc.active_role,
    }, { onConflict: 'id' })
  }

  const entrepreneurId = createdIds['demo.entrepreneur@feelthegap.app']
  const influenceurId = createdIds['demo.influenceur@feelthegap.app']

  // ── 1. Produits dans products_catalog (owned by entrepreneur) ──────
  console.log('\n[seed-demo] Creating products…')
  const products = [
    {
      name: 'Barre chocolatée bio — Cacao de Côte d\'Ivoire',
      slug: 'barre-choco-bio-civ',
      short_pitch: 'Le chocolat comme il devrait toujours avoir été : noble, tracé, équitable.',
      description: 'Barre chocolatée 70% cacao issue de coopératives certifiées du sud-ouest de la Côte d\'Ivoire. Transformation artisanale, zéro huile de palme, emballage compostable. Chaque achat rémunère directement les planteurs (+ 30% vs marché conventionnel).',
      price_eur: 6.5,
      category: 'food',
      hero_image_url: 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=800&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1511381939415-e44015466834?w=800&auto=format&fit=crop&q=80',
      ],
      benefits: [
        'Cacao 100% Côte d\'Ivoire tracé au village',
        'Production éco-responsable, sans huile de palme',
        'Empreinte carbone : -40% vs moyenne du marché',
        'Rémunération directe des planteurs +30%',
        'Emballage 100% compostable',
      ],
      ingredients: ['cacao', 'sucre de canne non raffiné', 'beurre de cacao', 'vanille bourbon'],
      variants: ['Nature 70%', 'Fraise-framboise', 'Pistache-sel de Guérande'],
      origin_country: 'Côte d\'Ivoire',
      impact_data: { carbon_kg_per_unit: 0.18, fair_trade: true, water_l_per_unit: 12 },
      commission_pct: 12,
      platform_pct: 30,
      influencer_pct: 70,
      external_url: 'https://example.com/cacao-civ',
    },
    {
      name: 'Savon artisanal à l\'huile d\'argan du Maroc',
      slug: 'savon-argan-maroc',
      short_pitch: 'L\'or liquide de l\'Atlas, travaillé à froid par des coopératives de femmes.',
      description: 'Savon saponifié à froid enrichi à 30% d\'huile d\'argan bio première pression. Produit par une coopérative de 45 femmes à Essaouira. Parfum naturel, sans conservateurs, emballage kraft recyclé.',
      price_eur: 12,
      category: 'cosmetics',
      hero_image_url: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=800&auto=format&fit=crop&q=80',
      images: ['https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=800&auto=format&fit=crop&q=80'],
      benefits: [
        'Huile d\'argan bio pressée à froid à 30%',
        'Empowerment : coopérative 100% féminine',
        'Saponification à froid, sans chauffage',
        'Sans parfum de synthèse ni conservateurs',
      ],
      ingredients: ['huile d\'argan bio', 'huile d\'olive', 'soude', 'huile essentielle de rose'],
      variants: ['Rose de Damas', 'Fleur d\'oranger', 'Lavande'],
      origin_country: 'Maroc',
      impact_data: { fair_trade: true, women_empowerment: true, biodegradable: true },
      commission_pct: 15,
      platform_pct: 30,
      influencer_pct: 70,
      external_url: 'https://example.com/savon-argan',
    },
    {
      name: 'Panier de mangues du Sénégal',
      slug: 'mangues-senegal',
      short_pitch: 'La Kent de Casamance, cueillie à maturité et acheminée par avion solaire.',
      description: 'Mangues variété Kent récoltées à la main en Casamance (Sénégal), calibre 400-600g. Livraison par fret hybride avec compensation carbone à 120%. Récolte limitée de mai à août.',
      price_eur: 28,
      category: 'food',
      hero_image_url: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=800&auto=format&fit=crop&q=80',
      images: ['https://images.unsplash.com/photo-1553279768-865429fa0078?w=800&auto=format&fit=crop&q=80'],
      benefits: [
        'Mangues cueillies à maturité (meilleur goût)',
        'Variété Kent, calibre 400-600 g',
        'Circuit court : J+4 entre récolte et livraison',
        'Compensation carbone à 120% du transport',
      ],
      ingredients: ['mangue fraîche Kent'],
      variants: ['Panier 3 kg', 'Panier 6 kg'],
      origin_country: 'Sénégal',
      impact_data: { fair_trade: true, carbon_neutral: true },
      commission_pct: 10,
      platform_pct: 30,
      influencer_pct: 70,
      external_url: 'https://example.com/mangues-sn',
    },
    {
      name: 'Sac cabas en raphia tissé — Madagascar',
      slug: 'cabas-raphia-mada',
      short_pitch: 'Un accessoire qui fait vivre un village entier.',
      description: 'Cabas en raphia 100% naturel tressé à la main dans le sud-est de Madagascar. Chaque pièce est unique. Anses en cuir vachette tanné végétal. Portraits des artisans fournis avec chaque achat.',
      price_eur: 85,
      category: 'fashion',
      hero_image_url: 'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800&auto=format&fit=crop&q=80',
      images: ['https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800&auto=format&fit=crop&q=80'],
      benefits: [
        'Tissage main — chaque pièce est unique',
        '40 artisans rémunérés équitablement',
        'Raphia 100% naturel, cuir tannage végétal',
        'Portrait de l\'artisan fourni avec le sac',
      ],
      ingredients: ['raphia naturel', 'cuir tannage végétal'],
      variants: ['Nature', 'Noir', 'Terracotta', 'Bleu nuit'],
      origin_country: 'Madagascar',
      impact_data: { fair_trade: true, artisanal: true },
      commission_pct: 18,
      platform_pct: 30,
      influencer_pct: 70,
      external_url: 'https://example.com/cabas-mada',
    },
  ]

  // Delete existing demo products first to avoid unique constraint issues
  await admin.from('products_catalog').delete().eq('seller_id', entrepreneurId)

  const productRows = products.map((p) => ({
    seller_id: entrepreneurId,
    ...p,
    catalog_opt_in: true,
    catalog_consent_at: new Date().toISOString(),
    status: 'active',
    our_go_code: Math.random().toString(36).slice(2, 10),
  }))
  const { data: insertedProducts, error: prodErr } = await admin.from('products_catalog').insert(productRows).select('id, slug')
  if (prodErr) throw new Error(`products insert: ${prodErr.message}`)
  console.log(`  + ${insertedProducts?.length} products`)

  // ── 2. Favoris influenceur (3 premiers produits) ───────────────────
  console.log('\n[seed-demo] Creating influencer favorites…')
  await admin.from('influencer_favorites').delete().eq('influencer_id', influenceurId)
  const favRows = (insertedProducts ?? []).slice(0, 3).map((p) => ({
    influencer_id: influenceurId,
    product_id: p.id,
    notes: `Super produit, parfait pour ma communauté`,
  }))
  if (favRows.length > 0) {
    const { error: favErr } = await admin.from('influencer_favorites').insert(favRows)
    if (favErr) console.warn(`  ! favorites: ${favErr.message}`)
    else console.log(`  + ${favRows.length} favorites`)
  }

  // ── 3. Influencer profile (pour le dashboard /influencer) ──────────
  console.log('\n[seed-demo] Creating influencer_profiles…')
  await admin.from('influencer_profiles').upsert({
    id: influenceurId,
    platform_handle: 'lea.martin',
    bio: 'Créatrice de contenu éthique · 45k abonnés Instagram · Amoureuse des circuits courts',
    social_networks: { instagram: 'lea.martin', tiktok: 'lea.martin.eco', youtube: null },
    audience_data: { followers: 45000, engagement_rate: 4.2, geos: ['FR', 'BE', 'CH'] },
    status: 'active',
  }, { onConflict: 'id' })
  console.log('  ✓ influencer profile')

  // ── 4. Dossier financement (rempli + submitted) ─────────────────────
  console.log('\n[seed-demo] Creating funding dossier (financement)…')
  const financementStructure = {
    version: 1,
    type: 'financement',
    generated_at: new Date().toISOString(),
    context: { amount_eur: 180000, country_iso: 'CIV', product_slug: 'cacao', sector: 'agroalimentaire', stage: 'croissance' },
    sections: [
      {
        key: 'company', title: 'Identité de l\'entreprise', description: '',
        questions: [
          { key: 'company_name', label: 'Raison sociale', type: 'text', required: true },
          { key: 'legal_form', label: 'Forme juridique', type: 'select', required: true, options: [{ value: 'sarl', label: 'SARL' }, { value: 'sas', label: 'SAS' }] },
          { key: 'siren', label: 'SIREN', type: 'text', required: true },
          { key: 'headcount', label: 'Effectifs', type: 'number', required: true },
        ],
      },
      {
        key: 'project', title: 'Projet', description: '',
        questions: [
          { key: 'project_summary', label: 'Description du projet', type: 'textarea', required: true },
          { key: 'use_of_funds', label: 'Usage des fonds', type: 'textarea', required: true },
        ],
      },
      {
        key: 'financials', title: 'Finances historiques', description: '',
        questions: [
          { key: 'revenue_y1', label: 'CA N-1', type: 'currency_eur', required: true },
          { key: 'ebitda_y1', label: 'EBITDA N-1', type: 'currency_eur', required: true },
          { key: 'debt', label: 'Endettement actuel', type: 'currency_eur', required: true },
        ],
      },
    ],
  }
  const financementAnswers = {
    company_name: 'Cacao de Côte d\'Ivoire SARL',
    legal_form: 'sarl',
    siren: '904 123 456',
    headcount: 12,
    project_summary: 'Expansion de la ligne de production artisanale de barres chocolatées bio, ajout de 2 variantes (fraise, pistache), certification Fair Trade et Demeter. Construction d\'un nouvel atelier de 200 m² à Abidjan avec 6 nouveaux emplois à créer.',
    use_of_funds: '· Atelier neuf 200m² : 90 000 €\n· Équipement (conche, tempéreuse, emballage) : 55 000 €\n· Certification Fair Trade + Demeter : 15 000 €\n· BFR premier cycle de production : 20 000 €',
    revenue_y1: 420000,
    ebitda_y1: 68000,
    debt: 45000,
  }
  await admin.from('funding_dossiers').delete().eq('user_id', entrepreneurId)
  const { data: fundingDossier, error: fdErr } = await admin.from('funding_dossiers').insert({
    user_id: entrepreneurId,
    type: 'financement',
    title: 'Financement 180 000 € — CIV/cacao — Cacao de Côte d\'Ivoire SARL',
    country_iso: 'CIV',
    product_slug: 'cacao',
    amount_eur: 180000,
    status: 'submitted',
    structure: financementStructure,
    answers: financementAnswers,
    completion_pct: 100,
    quality_score: 82,
    public_number: 1,
    submitted_at: new Date().toISOString(),
  }).select('id').single()
  if (fdErr) throw new Error(`funding dossier: ${fdErr.message}`)
  console.log(`  + financement dossier ${fundingDossier.id.slice(0, 8)}`)

  // ── 5. Dossier investissement (rempli + submitted) ──────────────────
  console.log('\n[seed-demo] Creating funding dossier (investissement)…')
  const investStructure = {
    version: 1,
    type: 'investissement',
    generated_at: new Date().toISOString(),
    context: { amount_eur: 350000, country_iso: 'CIV', product_slug: 'cacao', sector: 'agroalimentaire', stage: 'amorcage' },
    sections: [
      {
        key: 'team', title: 'Équipe', description: '',
        questions: [
          { key: 'founders', label: 'Fondateurs + parcours', type: 'textarea', required: true },
          { key: 'team_size', label: 'Taille équipe', type: 'number', required: true },
        ],
      },
      {
        key: 'market', title: 'Marché', description: '',
        questions: [
          { key: 'tam_eur', label: 'TAM estimé (EUR)', type: 'currency_eur', required: true },
          { key: 'sam_eur', label: 'SAM estimé (EUR)', type: 'currency_eur', required: true },
          { key: 'traction', label: 'Traction à date', type: 'textarea', required: true },
        ],
      },
      {
        key: 'financials', title: 'Projections', description: '',
        questions: [
          { key: 'revenue_y3_target', label: 'CA cible à 3 ans', type: 'currency_eur', required: true },
          { key: 'burn_monthly', label: 'Burn mensuel', type: 'currency_eur', required: true },
        ],
      },
      {
        key: 'valuation', title: 'Valorisation', description: '',
        questions: [
          { key: 'pre_money', label: 'Pre-money proposée', type: 'currency_eur', required: true },
          { key: 'equity_offered', label: '% equity proposé', type: 'percent', required: true },
        ],
      },
    ],
  }
  const investAnswers = {
    founders: 'Amélie Dubois (CEO) — 15 ans d\'expérience dans le cacao premium, anciennement chez Valrhona. Kouassi N\'Guessan (COO) — ingénieur agronome, ex-Nestlé Côte d\'Ivoire, expertise chaîne de valeur planteurs.',
    team_size: 12,
    tam_eur: 2400000000,
    sam_eur: 180000000,
    traction: '420 k€ CA 2025, croissance +65% YoY. Distribution BioCoop, Nature & Découvertes, 12 épiceries fines. 4 coopératives partenaires CI. 22% EBITDA marge.',
    revenue_y3_target: 3200000,
    burn_monthly: 28000,
    pre_money: 2800000,
    equity_offered: 12.5,
  }
  const { data: investDossier, error: invErr } = await admin.from('funding_dossiers').insert({
    user_id: entrepreneurId,
    type: 'investissement',
    title: 'Investissement 350 000 € — CIV/cacao — Série Seed Cacao de CI',
    country_iso: 'CIV',
    product_slug: 'cacao',
    amount_eur: 350000,
    status: 'submitted',
    structure: investStructure,
    answers: investAnswers,
    completion_pct: 100,
    quality_score: 88,
    public_number: 2,
    submitted_at: new Date().toISOString(),
  }).select('id').single()
  if (invErr) throw new Error(`invest dossier: ${invErr.message}`)
  console.log(`  + investissement dossier ${investDossier.id.slice(0, 8)}`)

  // ── Done ────────────────────────────────────────────────────────────
  console.log('\n━━━ Demo accounts ready ━━━')
  console.log('Password for all : ' + DEMO_PASSWORD)
  console.log('')
  for (const acc of DEMO_ACCOUNTS) {
    console.log(`  · ${acc.email}  → ${acc.active_role}`)
  }
  console.log('\nLogin at: https://feel-the-gap.duckdns.org/auth/login')
}

main().catch((err) => {
  console.error('[seed-demo] Fatal:', err)
  process.exit(1)
})
