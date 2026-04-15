#!/usr/bin/env node
// Seed 10 lead packs variés sur le marketplace B2B FTG.
// Lit SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL depuis .env.local
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const envPath = path.join(process.cwd(), '.env.local')
const env = Object.fromEntries(
  fs.readFileSync(envPath,'utf8').split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1)] })
)
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
const sb = createClient(url, key, { auth: { persistSession: false } })

const PACKS = [
  {
    slug: 'restaurateurs-france-500',
    title: 'Restaurateurs France — 500 leads',
    subtitle: 'Horeca France, contacts vérifiés',
    description: 'Restaurateurs indépendants et chaînes en France : email, téléphone, WhatsApp quand disponible, adresse et produits achetés.',
    source_table: 'local_buyers',
    filters: { country_iso: 'FR', buyer_type: ['horeca'] },
    target_count: 500, price_cents: 19900, tier: 'M',
    country_iso: 'FR', sector: 'horeca', tags: ['france','horeca','restauration'], hero_emoji: '🍽️'
  },
  {
    slug: 'exporters-cacao-afrique-200',
    title: 'Exporters cacao Afrique — 200 leads',
    subtitle: 'Acteurs export cacao CIV, GHA, NGA, CMR',
    description: 'Exportateurs de fèves et dérivés cacao en Afrique de l\'Ouest, avec volumes annuels et certifications.',
    source_table: 'exporters_directory',
    filters: { product_slugs: ['cocoa','cacao'], country_iso_in: ['CI','GH','NG','CM'] },
    target_count: 200, price_cents: 9900, tier: 'S',
    sector: 'agri_export', tags: ['afrique','cacao','export'], hero_emoji: '🍫'
  },
  {
    slug: 'investors-tech-europe-100',
    title: 'Investors Tech Europe — 100 fonds/BA',
    subtitle: 'VC, Business Angels & Family Offices tech',
    description: 'Investisseurs européens actifs sur deals tech seed & Series A : ticket, thèse, contacts partners.',
    source_table: 'investors_directory',
    filters: { sectors_of_interest: ['tech','fintech','saas'], regions_of_interest: ['FR','DE','GB','NL','ES'] },
    target_count: 100, price_cents: 24900, tier: 'M', verified_only: true,
    sector: 'tech', tags: ['europe','vc','tech','seed'], hero_emoji: '💼'
  },
  {
    slug: 'investors-impact-afrique-100',
    title: 'Investors Impact Afrique — 100 fonds',
    subtitle: 'DFI, impact funds & grant agencies',
    description: 'Fonds impact & agences pour projets agri / énergie / santé Afrique subsaharienne.',
    source_table: 'investors_directory',
    filters: { impact_focus: true, regions_of_interest_any_africa: true },
    target_count: 100, price_cents: 29900, tier: 'M', verified_only: true,
    sector: 'impact', tags: ['afrique','impact','dfi'], hero_emoji: '🌍'
  },
  {
    slug: 'entrepreneurs-agri-afrique-500',
    title: 'Entrepreneurs agri Afrique — 500',
    subtitle: 'PME agricoles & food processing actives',
    description: 'Entrepreneurs opérationnels en agri/food Afrique : revenue estimé, employés, ancienneté, besoins (financing/clients).',
    source_table: 'entrepreneurs_directory',
    filters: { sector: 'agriculture' },
    target_count: 500, price_cents: 19900, tier: 'M',
    sector: 'agri', tags: ['afrique','agri','entrepreneurs'], hero_emoji: '🌾'
  },
  {
    slug: 'grossistes-ue-fruits-300',
    title: 'Grossistes UE fruits/légumes — 300',
    subtitle: 'Centrales d\'achats & grossistes frais',
    description: 'Grossistes et centrales UE : volumes fruits/légumes, certifs exigées, interlocuteurs achats.',
    source_table: 'local_buyers',
    filters: { buyer_type: ['grossiste','centrale_achats'], product_slugs: ['fruits','vegetables','mango','pineapple'] },
    target_count: 300, price_cents: 14900, tier: 'M',
    sector: 'wholesale', tags: ['ue','fresh','grossiste'], hero_emoji: '🥭'
  },
  {
    slug: 'industriels-transformation-france-50',
    title: 'Industriels transformation France — 50',
    subtitle: 'Tri-sélect : transformateurs matières premières',
    description: 'Mini-pack test pour calibrer campagnes : 50 industriels France transformation agroalimentaire, premium qualifiés.',
    source_table: 'local_buyers',
    filters: { country_iso: 'FR', buyer_type: ['industriel','transformateur'] },
    target_count: 50, price_cents: 4900, tier: 'S', verified_only: true,
    country_iso: 'FR', sector: 'food_industrial', tags: ['france','industrie','premium'], hero_emoji: '🏭'
  },
  {
    slug: 'exporters-tropical-worldwide-5000',
    title: 'Exporters tropicaux worldwide — 5000',
    subtitle: 'Mega-pack data export fruits tropicaux mondial',
    description: 'Dataset complet : 5000 exportateurs fruits tropicaux (mangue, ananas, avocat, cacao, café) multi-continents.',
    source_table: 'exporters_directory',
    filters: { product_slugs: ['mango','pineapple','avocado','cocoa','coffee'] },
    target_count: 5000, price_cents: 79900, tier: 'XL',
    sector: 'agri_export', tags: ['worldwide','tropical','mega'], hero_emoji: '🌴'
  },
  {
    slug: 'business-angels-france-50',
    title: 'Business Angels France — 50',
    subtitle: 'BA actifs deals < 200k€',
    description: 'Business Angels France avec ticket < 200k€, contacts directs & deals récents.',
    source_table: 'investors_directory',
    filters: { investor_type: ['business_angel'], country_iso: 'FR' },
    target_count: 50, price_cents: 14900, tier: 'S', verified_only: true,
    country_iso: 'FR', sector: 'ba', tags: ['france','ba','early-stage'], hero_emoji: '👤'
  },
  {
    slug: 'distributeurs-afrique-ouest-200',
    title: 'Distributeurs Afrique Ouest — 200',
    subtitle: 'Distributeurs horeca / retail CIV, SEN, GHA, NGA',
    description: 'Réseau distribution B2B Afrique de l\'Ouest : distributeurs & horeca avec volumes annuels.',
    source_table: 'local_buyers',
    filters: { buyer_type: ['distributeur','horeca'], country_iso_in: ['CI','SN','GH','NG'] },
    target_count: 200, price_cents: 12900, tier: 'M',
    sector: 'distribution', tags: ['afrique-ouest','distribution','horeca'], hero_emoji: '🚚'
  },
]

const { error } = await sb.from('lead_packs').upsert(PACKS, { onConflict: 'slug' })
if (error) { console.error('seed error', error); process.exit(1) }
const { count } = await sb.from('lead_packs').select('*', { count: 'exact', head: true })
console.log('Seeded. Total lead_packs:', count)
