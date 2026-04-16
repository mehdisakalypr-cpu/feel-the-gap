// @ts-nocheck
/**
 * queue-scouts-expansion — reseed autoscale vers ~29k opportunités.
 * Étend queue-scouts.ts avec +500-600 combos (diversification + sectors
 * complémentaires + pays manquants). Idempotent via index unique pending/running.
 *
 * Run: npx tsx agents/queue-scouts-expansion.ts
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'

loadEnv()

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

type Job = { country_iso: string; sector: string; product_slug?: string; priority: number }

// AXIS A — Diversification produits sur 80 pays existants (top exportables supplémentaires)
const AXIS_A: Job[] = [
  // Afrique — produits complémentaires
  { country_iso: 'CIV', sector: 'agriculture', product_slug: 'hevea', priority: 2 },
  { country_iso: 'CIV', sector: 'agriculture', product_slug: 'cafe', priority: 3 },
  { country_iso: 'CIV', sector: 'agriculture', product_slug: 'banane', priority: 3 },
  { country_iso: 'SEN', sector: 'agriculture', product_slug: 'mangue', priority: 2 },
  { country_iso: 'SEN', sector: 'services', product_slug: 'logistique_portuaire', priority: 3 },
  { country_iso: 'CMR', sector: 'agriculture', product_slug: 'banane', priority: 2 },
  { country_iso: 'CMR', sector: 'energy', product_slug: 'gaz_naturel', priority: 3 },
  { country_iso: 'BFA', sector: 'materials', product_slug: 'or', priority: 3 },
  { country_iso: 'MLI', sector: 'materials', product_slug: 'or', priority: 2 },
  { country_iso: 'MLI', sector: 'agriculture', product_slug: 'karite', priority: 2 },
  { country_iso: 'GHA', sector: 'materials', product_slug: 'or', priority: 2 },
  { country_iso: 'GHA', sector: 'energy', product_slug: 'petrole', priority: 3 },
  { country_iso: 'NGA', sector: 'energy', product_slug: 'petrole', priority: 2 },
  { country_iso: 'NGA', sector: 'services', product_slug: 'fintech', priority: 2 },
  { country_iso: 'NGA', sector: 'manufactured', product_slug: 'textile', priority: 3 },
  { country_iso: 'KEN', sector: 'agriculture', product_slug: 'floriculture', priority: 2 },
  { country_iso: 'KEN', sector: 'services', product_slug: 'fintech', priority: 2 },
  { country_iso: 'ETH', sector: 'agriculture', product_slug: 'sesame', priority: 3 },
  { country_iso: 'ETH', sector: 'manufactured', product_slug: 'textile', priority: 3 },
  { country_iso: 'TZA', sector: 'materials', product_slug: 'or', priority: 3 },
  { country_iso: 'TZA', sector: 'agriculture', product_slug: 'cafe', priority: 3 },
  { country_iso: 'UGA', sector: 'agriculture', product_slug: 'the', priority: 3 },
  { country_iso: 'RWA', sector: 'agriculture', product_slug: 'the', priority: 4 },
  { country_iso: 'MDG', sector: 'agriculture', product_slug: 'clou_girofle', priority: 3 },
  { country_iso: 'MDG', sector: 'agriculture', product_slug: 'litchi', priority: 3 },
  { country_iso: 'MAR', sector: 'manufactured', product_slug: 'automobile', priority: 2 },
  { country_iso: 'MAR', sector: 'agriculture', product_slug: 'agrumes', priority: 2 },
  { country_iso: 'TUN', sector: 'manufactured', product_slug: 'textile', priority: 3 },
  { country_iso: 'TUN', sector: 'agriculture', product_slug: 'dattes', priority: 3 },
  { country_iso: 'DZA', sector: 'energy', product_slug: 'gaz_naturel', priority: 2 },
  { country_iso: 'EGY', sector: 'manufactured', product_slug: 'textile', priority: 2 },
  { country_iso: 'EGY', sector: 'services', product_slug: 'logistique_canal_suez', priority: 2 },
  { country_iso: 'ZAF', sector: 'materials', product_slug: 'platine', priority: 2 },
  { country_iso: 'ZAF', sector: 'agriculture', product_slug: 'fruits', priority: 3 },
  { country_iso: 'NAM', sector: 'materials', product_slug: 'uranium', priority: 4 },
  { country_iso: 'AGO', sector: 'materials', product_slug: 'diamants', priority: 4 },
  { country_iso: 'ZMB', sector: 'agriculture', product_slug: 'tabac', priority: 4 },
  // Asie — diversification
  { country_iso: 'CHN', sector: 'manufactured', product_slug: 'batteries', priority: 2 },
  { country_iso: 'CHN', sector: 'manufactured', product_slug: 'panneaux_solaires', priority: 2 },
  { country_iso: 'CHN', sector: 'services', product_slug: 'e_commerce_b2b', priority: 3 },
  { country_iso: 'IND', sector: 'manufactured', product_slug: 'pharma', priority: 2 },
  { country_iso: 'IND', sector: 'services', product_slug: 'it_services', priority: 2 },
  { country_iso: 'IND', sector: 'manufactured', product_slug: 'textile', priority: 3 },
  { country_iso: 'IDN', sector: 'materials', product_slug: 'nickel', priority: 2 },
  { country_iso: 'IDN', sector: 'agriculture', product_slug: 'cafe', priority: 3 },
  { country_iso: 'PHL', sector: 'services', product_slug: 'bpo', priority: 3 },
  { country_iso: 'VNM', sector: 'manufactured', product_slug: 'textile', priority: 2 },
  { country_iso: 'VNM', sector: 'agriculture', product_slug: 'anacarde', priority: 2 },
  { country_iso: 'VNM', sector: 'manufactured', product_slug: 'electronique', priority: 3 },
  { country_iso: 'THA', sector: 'manufactured', product_slug: 'automobile', priority: 3 },
  { country_iso: 'THA', sector: 'agriculture', product_slug: 'durian', priority: 3 },
  { country_iso: 'MYS', sector: 'manufactured', product_slug: 'semi_conducteurs', priority: 3 },
  { country_iso: 'BGD', sector: 'agriculture', product_slug: 'jute', priority: 3 },
  { country_iso: 'PAK', sector: 'manufactured', product_slug: 'textile', priority: 3 },
  { country_iso: 'LKA', sector: 'agriculture', product_slug: 'cannelle', priority: 3 },
  { country_iso: 'JPN', sector: 'manufactured', product_slug: 'automobile', priority: 3 },
  { country_iso: 'JPN', sector: 'services', product_slug: 'robotique', priority: 4 },
  { country_iso: 'KOR', sector: 'manufactured', product_slug: 'automobile', priority: 3 },
  { country_iso: 'KOR', sector: 'services', product_slug: 'cosmetique', priority: 3 },
  { country_iso: 'SGP', sector: 'services', product_slug: 'finance', priority: 3 },
  { country_iso: 'SGP', sector: 'services', product_slug: 'fintech', priority: 3 },
  { country_iso: 'TUR', sector: 'manufactured', product_slug: 'automobile', priority: 3 },
  { country_iso: 'TUR', sector: 'agriculture', product_slug: 'noisettes', priority: 2 },
  { country_iso: 'ARE', sector: 'services', product_slug: 'finance', priority: 3 },
  { country_iso: 'ARE', sector: 'services', product_slug: 'logistique_aerienne', priority: 3 },
  { country_iso: 'SAU', sector: 'materials', product_slug: 'aluminium', priority: 4 },
  { country_iso: 'IRN', sector: 'agriculture', product_slug: 'safran', priority: 3 },
  // Europe — diversification
  { country_iso: 'DEU', sector: 'manufactured', product_slug: 'automobile', priority: 2 },
  { country_iso: 'DEU', sector: 'manufactured', product_slug: 'chimie', priority: 3 },
  { country_iso: 'DEU', sector: 'manufactured', product_slug: 'pharma', priority: 3 },
  { country_iso: 'FRA', sector: 'manufactured', product_slug: 'aeronautique', priority: 2 },
  { country_iso: 'FRA', sector: 'manufactured', product_slug: 'luxe', priority: 2 },
  { country_iso: 'FRA', sector: 'manufactured', product_slug: 'pharma', priority: 3 },
  { country_iso: 'ITA', sector: 'agriculture', product_slug: 'huile_olive', priority: 2 },
  { country_iso: 'ITA', sector: 'manufactured', product_slug: 'machines', priority: 2 },
  { country_iso: 'ITA', sector: 'agriculture', product_slug: 'vin', priority: 3 },
  { country_iso: 'ESP', sector: 'agriculture', product_slug: 'fruits', priority: 2 },
  { country_iso: 'ESP', sector: 'agriculture', product_slug: 'vin', priority: 3 },
  { country_iso: 'GBR', sector: 'manufactured', product_slug: 'pharma', priority: 3 },
  { country_iso: 'GBR', sector: 'services', product_slug: 'fintech', priority: 3 },
  { country_iso: 'NLD', sector: 'services', product_slug: 'logistique_portuaire', priority: 3 },
  { country_iso: 'NLD', sector: 'agriculture', product_slug: 'fromage', priority: 4 },
  { country_iso: 'BEL', sector: 'manufactured', product_slug: 'pharma', priority: 4 },
  { country_iso: 'POL', sector: 'manufactured', product_slug: 'mobilier', priority: 3 },
  { country_iso: 'ROU', sector: 'manufactured', product_slug: 'automobile', priority: 4 },
  { country_iso: 'HUN', sector: 'manufactured', product_slug: 'composants', priority: 5 },
  { country_iso: 'CZE', sector: 'manufactured', product_slug: 'machines', priority: 5 },
  { country_iso: 'PRT', sector: 'manufactured', product_slug: 'textile', priority: 3 },
  { country_iso: 'PRT', sector: 'manufactured', product_slug: 'chaussures', priority: 3 },
  { country_iso: 'GRC', sector: 'services', product_slug: 'tourisme', priority: 3 },
  { country_iso: 'SWE', sector: 'manufactured', product_slug: 'automobile', priority: 5 },
  { country_iso: 'NOR', sector: 'energy', product_slug: 'petrole', priority: 4 },
  { country_iso: 'NOR', sector: 'energy', product_slug: 'hydroelectrique', priority: 5 },
  { country_iso: 'UKR', sector: 'agriculture', product_slug: 'mais', priority: 3 },
  { country_iso: 'UKR', sector: 'agriculture', product_slug: 'tournesol', priority: 3 },
  // Amériques — diversification
  { country_iso: 'USA', sector: 'manufactured', product_slug: 'pharma', priority: 3 },
  { country_iso: 'USA', sector: 'manufactured', product_slug: 'semi_conducteurs', priority: 3 },
  { country_iso: 'USA', sector: 'services', product_slug: 'fintech', priority: 3 },
  { country_iso: 'USA', sector: 'manufactured', product_slug: 'aeronautique', priority: 3 },
  { country_iso: 'CAN', sector: 'energy', product_slug: 'petrole', priority: 3 },
  { country_iso: 'CAN', sector: 'materials', product_slug: 'bois', priority: 3 },
  { country_iso: 'MEX', sector: 'manufactured', product_slug: 'automobile', priority: 2 },
  { country_iso: 'MEX', sector: 'agriculture', product_slug: 'tequila', priority: 3 },
  { country_iso: 'BRA', sector: 'agriculture', product_slug: 'soja', priority: 2 },
  { country_iso: 'BRA', sector: 'materials', product_slug: 'fer', priority: 3 },
  { country_iso: 'BRA', sector: 'agriculture', product_slug: 'viande_bovine', priority: 3 },
  { country_iso: 'ARG', sector: 'agriculture', product_slug: 'viande_bovine', priority: 3 },
  { country_iso: 'ARG', sector: 'agriculture', product_slug: 'vin', priority: 4 },
  { country_iso: 'CHL', sector: 'materials', product_slug: 'cuivre', priority: 2 },
  { country_iso: 'CHL', sector: 'materials', product_slug: 'lithium', priority: 2 },
  { country_iso: 'COL', sector: 'agriculture', product_slug: 'fruits', priority: 3 },
  { country_iso: 'COL', sector: 'energy', product_slug: 'petrole', priority: 4 },
  { country_iso: 'PER', sector: 'materials', product_slug: 'cuivre', priority: 3 },
  { country_iso: 'PER', sector: 'agriculture', product_slug: 'avocat', priority: 3 },
  { country_iso: 'ECU', sector: 'agriculture', product_slug: 'crevettes', priority: 3 },
  { country_iso: 'URY', sector: 'agriculture', product_slug: 'laine', priority: 4 },
]

// AXIS B — Sectors complémentaires haute valeur (fintech, renewable, pharma, lithium, IA)
const AXIS_B: Job[] = [
  // Fintech hubs
  { country_iso: 'SGP', sector: 'services', product_slug: 'fintech_b2b', priority: 2 },
  { country_iso: 'GBR', sector: 'services', product_slug: 'fintech_b2b', priority: 2 },
  { country_iso: 'EST', sector: 'services', product_slug: 'fintech', priority: 3 },
  { country_iso: 'ARE', sector: 'services', product_slug: 'fintech', priority: 2 },
  { country_iso: 'HKG', sector: 'services', product_slug: 'fintech', priority: 3 },
  { country_iso: 'LUX', sector: 'services', product_slug: 'finance', priority: 3 },
  { country_iso: 'CHE', sector: 'services', product_slug: 'finance', priority: 3 },
  { country_iso: 'IRL', sector: 'services', product_slug: 'fintech', priority: 3 },
  { country_iso: 'LTU', sector: 'services', product_slug: 'fintech', priority: 4 },
  // Renewable energy
  { country_iso: 'MAR', sector: 'energy', product_slug: 'solaire', priority: 2 },
  { country_iso: 'EGY', sector: 'energy', product_slug: 'solaire', priority: 3 },
  { country_iso: 'ZAF', sector: 'energy', product_slug: 'solaire', priority: 3 },
  { country_iso: 'KEN', sector: 'energy', product_slug: 'geothermie', priority: 3 },
  { country_iso: 'ETH', sector: 'energy', product_slug: 'hydroelectrique', priority: 3 },
  { country_iso: 'ISL', sector: 'energy', product_slug: 'geothermie', priority: 4 },
  { country_iso: 'ESP', sector: 'energy', product_slug: 'solaire', priority: 3 },
  { country_iso: 'PRT', sector: 'energy', product_slug: 'eolien', priority: 4 },
  { country_iso: 'DEU', sector: 'energy', product_slug: 'eolien', priority: 3 },
  { country_iso: 'DNK', sector: 'energy', product_slug: 'eolien', priority: 4 },
  { country_iso: 'AUS', sector: 'energy', product_slug: 'solaire', priority: 3 },
  { country_iso: 'AUS', sector: 'materials', product_slug: 'lithium', priority: 2 },
  { country_iso: 'IND', sector: 'energy', product_slug: 'solaire', priority: 3 },
  { country_iso: 'SAU', sector: 'energy', product_slug: 'solaire', priority: 3 },
  { country_iso: 'USA', sector: 'energy', product_slug: 'solaire', priority: 3 },
  // Lithium / terres rares / EV supply chain
  { country_iso: 'BOL', sector: 'materials', product_slug: 'lithium', priority: 2 },
  { country_iso: 'ARG', sector: 'materials', product_slug: 'lithium', priority: 2 },
  { country_iso: 'CHN', sector: 'materials', product_slug: 'terres_rares', priority: 3 },
  { country_iso: 'COD', sector: 'materials', product_slug: 'lithium', priority: 4 },
  { country_iso: 'ZWE', sector: 'materials', product_slug: 'lithium', priority: 4 },
  { country_iso: 'CAN', sector: 'materials', product_slug: 'nickel', priority: 4 },
  { country_iso: 'IDN', sector: 'materials', product_slug: 'cobalt', priority: 3 },
  { country_iso: 'PHL', sector: 'materials', product_slug: 'nickel', priority: 3 },
  // Pharma hubs
  { country_iso: 'CHE', sector: 'manufactured', product_slug: 'pharma', priority: 3 },
  { country_iso: 'IRL', sector: 'manufactured', product_slug: 'pharma', priority: 3 },
  { country_iso: 'IND', sector: 'manufactured', product_slug: 'vaccins', priority: 3 },
  { country_iso: 'SGP', sector: 'manufactured', product_slug: 'pharma', priority: 3 },
  // Tourisme / hospitality
  { country_iso: 'THA', sector: 'services', product_slug: 'tourisme', priority: 3 },
  { country_iso: 'ITA', sector: 'services', product_slug: 'tourisme', priority: 3 },
  { country_iso: 'ESP', sector: 'services', product_slug: 'tourisme', priority: 3 },
  { country_iso: 'FRA', sector: 'services', product_slug: 'tourisme', priority: 3 },
  { country_iso: 'MEX', sector: 'services', product_slug: 'tourisme', priority: 3 },
  { country_iso: 'TUR', sector: 'services', product_slug: 'tourisme', priority: 4 },
  { country_iso: 'PRT', sector: 'services', product_slug: 'tourisme', priority: 4 },
  { country_iso: 'MAR', sector: 'services', product_slug: 'tourisme', priority: 3 },
  { country_iso: 'KEN', sector: 'services', product_slug: 'safari_tourisme', priority: 4 },
  { country_iso: 'TZA', sector: 'services', product_slug: 'safari_tourisme', priority: 4 },
  // Logistique / ports
  { country_iso: 'NLD', sector: 'services', product_slug: 'logistique_rotterdam', priority: 3 },
  { country_iso: 'BEL', sector: 'services', product_slug: 'logistique_anvers', priority: 4 },
  { country_iso: 'CHN', sector: 'services', product_slug: 'logistique_shanghai', priority: 4 },
  { country_iso: 'KOR', sector: 'services', product_slug: 'logistique_busan', priority: 5 },
  { country_iso: 'DJI', sector: 'services', product_slug: 'logistique_portuaire', priority: 4 },
  // IA / data centers
  { country_iso: 'USA', sector: 'services', product_slug: 'data_centers', priority: 3 },
  { country_iso: 'IRL', sector: 'services', product_slug: 'data_centers', priority: 4 },
  { country_iso: 'SGP', sector: 'services', product_slug: 'data_centers', priority: 4 },
  { country_iso: 'SWE', sector: 'services', product_slug: 'data_centers', priority: 5 },
]

// AXIS C — Pays manquants (60 micro-états + pays rares, 1-2 combos chacun)
const MISSING_COUNTRIES: { iso: string; sector: string; product: string; priority?: number }[] = [
  { iso: 'AUS', sector: 'materials', product: 'fer', priority: 2 },
  { iso: 'AUS', sector: 'agriculture', product: 'viande_bovine', priority: 3 },
  { iso: 'NZL', sector: 'agriculture', product: 'produits_laitiers', priority: 3 },
  { iso: 'NZL', sector: 'agriculture', product: 'viande_ovine', priority: 4 },
  { iso: 'ISL', sector: 'agriculture', product: 'poisson', priority: 4 },
  { iso: 'IRL', sector: 'agriculture', product: 'produits_laitiers', priority: 3 },
  { iso: 'JAM', sector: 'services', product: 'tourisme', priority: 4 },
  { iso: 'JAM', sector: 'agriculture', product: 'cafe_blue_mountain', priority: 4 },
  { iso: 'MUS', sector: 'services', product: 'finance_offshore', priority: 4 },
  { iso: 'MUS', sector: 'agriculture', product: 'sucre', priority: 4 },
  { iso: 'FJI', sector: 'services', product: 'tourisme', priority: 5 },
  { iso: 'FJI', sector: 'agriculture', product: 'eau_minerale', priority: 5 },
  { iso: 'QAT', sector: 'energy', product: 'gaz_naturel', priority: 3 },
  { iso: 'QAT', sector: 'services', product: 'finance', priority: 4 },
  { iso: 'OMN', sector: 'energy', product: 'petrole', priority: 4 },
  { iso: 'OMN', sector: 'services', product: 'logistique', priority: 5 },
  { iso: 'JOR', sector: 'services', product: 'tourisme', priority: 4 },
  { iso: 'JOR', sector: 'manufactured', product: 'pharma', priority: 5 },
  { iso: 'LBN', sector: 'agriculture', product: 'vin', priority: 4 },
  { iso: 'LBN', sector: 'services', product: 'diaspora_finance', priority: 5 },
  { iso: 'AZE', sector: 'energy', product: 'petrole', priority: 4 },
  { iso: 'AZE', sector: 'agriculture', product: 'caviar', priority: 5 },
  { iso: 'GEO', sector: 'agriculture', product: 'vin', priority: 4 },
  { iso: 'GEO', sector: 'services', product: 'tourisme', priority: 5 },
  { iso: 'ARM', sector: 'agriculture', product: 'cognac', priority: 5 },
  { iso: 'MDA', sector: 'agriculture', product: 'vin', priority: 5 },
  { iso: 'MKD', sector: 'agriculture', product: 'tabac', priority: 5 },
  { iso: 'ALB', sector: 'agriculture', product: 'huile_olive', priority: 5 },
  { iso: 'LUX', sector: 'services', product: 'finance_privee', priority: 3 },
  { iso: 'EST', sector: 'services', product: 'digital_services', priority: 4 },
  { iso: 'LTU', sector: 'manufactured', product: 'composants', priority: 5 },
  { iso: 'LVA', sector: 'materials', product: 'bois', priority: 5 },
  { iso: 'SVK', sector: 'manufactured', product: 'automobile', priority: 4 },
  { iso: 'SVN', sector: 'manufactured', product: 'pharma', priority: 5 },
  { iso: 'HRV', sector: 'services', product: 'tourisme', priority: 4 },
  { iso: 'BGR', sector: 'agriculture', product: 'rose', priority: 5 },
  { iso: 'CYP', sector: 'services', product: 'finance_offshore', priority: 5 },
  { iso: 'MLT', sector: 'services', product: 'igaming', priority: 5 },
  { iso: 'GTM', sector: 'agriculture', product: 'cafe', priority: 3 },
  { iso: 'HND', sector: 'agriculture', product: 'banane', priority: 4 },
  { iso: 'NIC', sector: 'agriculture', product: 'cafe', priority: 4 },
  { iso: 'DOM', sector: 'services', product: 'tourisme', priority: 3 },
  { iso: 'CUB', sector: 'agriculture', product: 'tabac_havane', priority: 5 },
  { iso: 'VEN', sector: 'energy', product: 'petrole', priority: 5 },
  { iso: 'TTO', sector: 'energy', product: 'gaz_naturel', priority: 5 },
  { iso: 'PAN', sector: 'services', product: 'logistique_canal', priority: 3 },
  { iso: 'SLV', sector: 'agriculture', product: 'cafe', priority: 5 },
  { iso: 'BHS', sector: 'services', product: 'tourisme', priority: 5 },
  { iso: 'BRB', sector: 'services', product: 'tourisme', priority: 5 },
  { iso: 'GUY', sector: 'energy', product: 'petrole', priority: 4 },
  { iso: 'SUR', sector: 'materials', product: 'bauxite', priority: 5 },
  { iso: 'BLZ', sector: 'agriculture', product: 'sucre', priority: 5 },
  { iso: 'SOM', sector: 'agriculture', product: 'banane', priority: 5 },
  { iso: 'DJI', sector: 'services', product: 'transit_portuaire', priority: 4 },
  { iso: 'GMB', sector: 'agriculture', product: 'arachide', priority: 5 },
  { iso: 'CAF', sector: 'materials', product: 'diamants', priority: 5 },
  { iso: 'TCD', sector: 'energy', product: 'petrole', priority: 5 },
  { iso: 'NER', sector: 'materials', product: 'uranium', priority: 5 },
  { iso: 'GNQ', sector: 'energy', product: 'petrole', priority: 5 },
  { iso: 'STP', sector: 'agriculture', product: 'cacao', priority: 5 },
  { iso: 'CPV', sector: 'services', product: 'tourisme', priority: 5 },
  { iso: 'TJK', sector: 'agriculture', product: 'coton', priority: 5 },
  { iso: 'KGZ', sector: 'agriculture', product: 'legumineuses', priority: 5 },
  { iso: 'TKM', sector: 'energy', product: 'gaz_naturel', priority: 5 },
  { iso: 'MNG', sector: 'materials', product: 'charbon', priority: 5 },
  { iso: 'NPL', sector: 'services', product: 'tourisme', priority: 5 },
  { iso: 'LAO', sector: 'agriculture', product: 'cafe', priority: 5 },
  { iso: 'KHM', sector: 'agriculture', product: 'riz', priority: 4 },
  { iso: 'BRN', sector: 'energy', product: 'gaz_naturel', priority: 5 },
  { iso: 'PNG', sector: 'materials', product: 'or', priority: 5 },
  { iso: 'BOL', sector: 'materials', product: 'etain', priority: 5 },
  { iso: 'VUT', sector: 'agriculture', product: 'coco', priority: 5 },
  { iso: 'MDV', sector: 'services', product: 'tourisme_luxe', priority: 4 },
  { iso: 'SYC', sector: 'services', product: 'tourisme_luxe', priority: 5 },
  { iso: 'COM', sector: 'agriculture', product: 'vanille', priority: 5 },
  { iso: 'BHR', sector: 'services', product: 'finance_islamique', priority: 4 },
  { iso: 'KWT', sector: 'energy', product: 'petrole', priority: 4 },
]

const AXIS_C: Job[] = MISSING_COUNTRIES.map(c => ({
  country_iso: c.iso,
  sector: c.sector,
  product_slug: c.product,
  priority: c.priority ?? 4,
}))

const ALL_JOBS: Job[] = [...AXIS_A, ...AXIS_B, ...AXIS_C]

async function main() {
  const sb = db()
  let inserted = 0, skipped = 0, errors = 0
  for (const j of ALL_JOBS) {
    const { error } = await sb.from('scout_queue').insert({
      country_iso: j.country_iso,
      sector: j.sector,
      product_slug: j.product_slug ?? null,
      priority: j.priority,
      status: 'pending',
      source: 'autoscale',
    })
    if (error) {
      if ((error as any).code === '23505' || /duplicate|unique/i.test(error.message)) {
        skipped++
        continue
      }
      errors++
      console.error(`✗ ${j.country_iso}/${j.sector}/${j.product_slug}: ${error.message}`)
      continue
    }
    inserted++
  }
  console.log(`\n→ submitted ${ALL_JOBS.length} jobs: ${inserted} queued, ${skipped} skipped (already pending), ${errors} errors`)

  const { count } = await sb
    .from('scout_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
  console.log(`  scout_queue.pending total = ${count}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
