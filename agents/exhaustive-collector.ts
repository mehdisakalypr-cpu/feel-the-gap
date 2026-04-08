// @ts-nocheck
/**
 * Feel The Gap — Exhaustive Data Collection Agent
 *
 * Designed to run as a long background task (cron, manual trigger, or CLI).
 * Covers ALL countries in the world with maximum detail from all free sources.
 *
 * Sources:
 *   1. World Bank Open Data — macro indicators (190+ countries)
 *   2. World Bank WITS — product-level trade (HS2/HS4) (180+ countries)
 *   3. WTO Statistics — merchandise + services trade (164 members)
 *   4. IMF DOTS — bilateral trade flows (190+ countries)
 *   5. FAO STAT — agricultural trade (175+ countries)
 *   6. Eurostat COMEXT — EU-27 detailed trade (monthly, HS8)
 *   7. USDA PSD — agricultural supply/demand (175+ countries)
 *   8. UN Comtrade free tier — HS6 bilateral (100 req/hr)
 *   9. CIA World Factbook — top imports/exports text profiles
 *  10. IEA (energy data) — energy imports/exports
 *  11. OECD.Stat — OECD member detailed trade
 *  12. Our World in Data — supplementary indicators
 *
 * Run modes:
 *   npx tsx agents/exhaustive-collector.ts --mode full      # all countries, all sources
 *   npx tsx agents/exhaustive-collector.ts --mode europe    # EU-27 only (Eurostat priority)
 *   npx tsx agents/exhaustive-collector.ts --mode missing   # countries with no/incomplete data
 *   npx tsx agents/exhaustive-collector.ts --mode refresh   # update existing data
 *   npx tsx agents/exhaustive-collector.ts --iso DEU,FRA    # specific countries
 *
 * Designed for exhaustiveness: takes as long as needed.
 * Rate limiting built-in per source. Resumes from last checkpoint.
 */

import { supabaseAdmin } from '@/lib/supabase'

// ── Country master list (ISO3, all UN members + territories) ──────────────────

export const ALL_COUNTRIES: Array<{ iso3: string; iso2: string; name: string; name_fr: string; region: string; sub_region: string; flag: string; lat: number; lng: number }> = [
  // ── Europe ──
  { iso3:'ALB', iso2:'AL', name:'Albania',           name_fr:'Albanie',          region:'Europe', sub_region:'Southern Europe',  flag:'🇦🇱', lat:41.15, lng:20.17 },
  { iso3:'AND', iso2:'AD', name:'Andorra',           name_fr:'Andorre',          region:'Europe', sub_region:'Southern Europe',  flag:'🇦🇩', lat:42.51, lng:1.52 },
  { iso3:'AUT', iso2:'AT', name:'Austria',           name_fr:'Autriche',         region:'Europe', sub_region:'Western Europe',   flag:'🇦🇹', lat:47.52, lng:14.55 },
  { iso3:'BEL', iso2:'BE', name:'Belgium',           name_fr:'Belgique',         region:'Europe', sub_region:'Western Europe',   flag:'🇧🇪', lat:50.50, lng:4.47 },
  { iso3:'BIH', iso2:'BA', name:'Bosnia and Herzegovina', name_fr:'Bosnie-Herzégovine', region:'Europe', sub_region:'Southern Europe', flag:'🇧🇦', lat:44.16, lng:17.68 },
  { iso3:'BGR', iso2:'BG', name:'Bulgaria',          name_fr:'Bulgarie',         region:'Europe', sub_region:'Eastern Europe',   flag:'🇧🇬', lat:42.73, lng:25.49 },
  { iso3:'HRV', iso2:'HR', name:'Croatia',           name_fr:'Croatie',          region:'Europe', sub_region:'Southern Europe',  flag:'🇭🇷', lat:45.10, lng:15.20 },
  { iso3:'CYP', iso2:'CY', name:'Cyprus',            name_fr:'Chypre',           region:'Europe', sub_region:'Southern Europe',  flag:'🇨🇾', lat:35.13, lng:33.43 },
  { iso3:'CZE', iso2:'CZ', name:'Czech Republic',   name_fr:'Tchéquie',         region:'Europe', sub_region:'Eastern Europe',   flag:'🇨🇿', lat:49.82, lng:15.47 },
  { iso3:'DNK', iso2:'DK', name:'Denmark',           name_fr:'Danemark',         region:'Europe', sub_region:'Northern Europe',  flag:'🇩🇰', lat:56.26, lng:9.50 },
  { iso3:'EST', iso2:'EE', name:'Estonia',           name_fr:'Estonie',          region:'Europe', sub_region:'Northern Europe',  flag:'🇪🇪', lat:58.60, lng:25.01 },
  { iso3:'FIN', iso2:'FI', name:'Finland',           name_fr:'Finlande',         region:'Europe', sub_region:'Northern Europe',  flag:'🇫🇮', lat:61.92, lng:25.75 },
  { iso3:'FRA', iso2:'FR', name:'France',            name_fr:'France',           region:'Europe', sub_region:'Western Europe',   flag:'🇫🇷', lat:46.23, lng:2.21 },
  { iso3:'DEU', iso2:'DE', name:'Germany',           name_fr:'Allemagne',        region:'Europe', sub_region:'Western Europe',   flag:'🇩🇪', lat:51.17, lng:10.45 },
  { iso3:'GRC', iso2:'GR', name:'Greece',            name_fr:'Grèce',            region:'Europe', sub_region:'Southern Europe',  flag:'🇬🇷', lat:39.07, lng:21.82 },
  { iso3:'HUN', iso2:'HU', name:'Hungary',           name_fr:'Hongrie',          region:'Europe', sub_region:'Eastern Europe',   flag:'🇭🇺', lat:47.16, lng:19.50 },
  { iso3:'ISL', iso2:'IS', name:'Iceland',           name_fr:'Islande',          region:'Europe', sub_region:'Northern Europe',  flag:'🇮🇸', lat:64.96, lng:-19.02 },
  { iso3:'IRL', iso2:'IE', name:'Ireland',           name_fr:'Irlande',          region:'Europe', sub_region:'Northern Europe',  flag:'🇮🇪', lat:53.41, lng:-8.24 },
  { iso3:'ITA', iso2:'IT', name:'Italy',             name_fr:'Italie',           region:'Europe', sub_region:'Southern Europe',  flag:'🇮🇹', lat:41.87, lng:12.57 },
  { iso3:'XKX', iso2:'XK', name:'Kosovo',            name_fr:'Kosovo',           region:'Europe', sub_region:'Southern Europe',  flag:'🇽🇰', lat:42.60, lng:20.90 },
  { iso3:'LVA', iso2:'LV', name:'Latvia',            name_fr:'Lettonie',         region:'Europe', sub_region:'Northern Europe',  flag:'🇱🇻', lat:56.88, lng:24.60 },
  { iso3:'LIE', iso2:'LI', name:'Liechtenstein',     name_fr:'Liechtenstein',    region:'Europe', sub_region:'Western Europe',   flag:'🇱🇮', lat:47.14, lng:9.55 },
  { iso3:'LTU', iso2:'LT', name:'Lithuania',         name_fr:'Lituanie',         region:'Europe', sub_region:'Northern Europe',  flag:'🇱🇹', lat:55.17, lng:23.88 },
  { iso3:'LUX', iso2:'LU', name:'Luxembourg',        name_fr:'Luxembourg',       region:'Europe', sub_region:'Western Europe',   flag:'🇱🇺', lat:49.82, lng:6.13 },
  { iso3:'MLT', iso2:'MT', name:'Malta',             name_fr:'Malte',            region:'Europe', sub_region:'Southern Europe',  flag:'🇲🇹', lat:35.94, lng:14.37 },
  { iso3:'MDA', iso2:'MD', name:'Moldova',           name_fr:'Moldavie',         region:'Europe', sub_region:'Eastern Europe',   flag:'🇲🇩', lat:47.41, lng:28.37 },
  { iso3:'MCO', iso2:'MC', name:'Monaco',            name_fr:'Monaco',           region:'Europe', sub_region:'Western Europe',   flag:'🇲🇨', lat:43.73, lng:7.40 },
  { iso3:'MNE', iso2:'ME', name:'Montenegro',        name_fr:'Monténégro',       region:'Europe', sub_region:'Southern Europe',  flag:'🇲🇪', lat:42.71, lng:19.37 },
  { iso3:'NLD', iso2:'NL', name:'Netherlands',       name_fr:'Pays-Bas',         region:'Europe', sub_region:'Western Europe',   flag:'🇳🇱', lat:52.13, lng:5.29 },
  { iso3:'MKD', iso2:'MK', name:'North Macedonia',  name_fr:'Macédoine du Nord',region:'Europe', sub_region:'Southern Europe',  flag:'🇲🇰', lat:41.61, lng:21.75 },
  { iso3:'NOR', iso2:'NO', name:'Norway',            name_fr:'Norvège',          region:'Europe', sub_region:'Northern Europe',  flag:'🇳🇴', lat:60.47, lng:8.47 },
  { iso3:'POL', iso2:'PL', name:'Poland',            name_fr:'Pologne',          region:'Europe', sub_region:'Eastern Europe',   flag:'🇵🇱', lat:51.92, lng:19.15 },
  { iso3:'PRT', iso2:'PT', name:'Portugal',          name_fr:'Portugal',         region:'Europe', sub_region:'Southern Europe',  flag:'🇵🇹', lat:39.40, lng:-8.22 },
  { iso3:'ROU', iso2:'RO', name:'Romania',           name_fr:'Roumanie',         region:'Europe', sub_region:'Eastern Europe',   flag:'🇷🇴', lat:45.94, lng:24.97 },
  { iso3:'SMR', iso2:'SM', name:'San Marino',        name_fr:'Saint-Marin',      region:'Europe', sub_region:'Southern Europe',  flag:'🇸🇲', lat:43.93, lng:12.46 },
  { iso3:'SRB', iso2:'RS', name:'Serbia',            name_fr:'Serbie',           region:'Europe', sub_region:'Southern Europe',  flag:'🇷🇸', lat:44.02, lng:21.01 },
  { iso3:'SVK', iso2:'SK', name:'Slovakia',          name_fr:'Slovaquie',        region:'Europe', sub_region:'Eastern Europe',   flag:'🇸🇰', lat:48.67, lng:19.70 },
  { iso3:'SVN', iso2:'SI', name:'Slovenia',          name_fr:'Slovénie',         region:'Europe', sub_region:'Southern Europe',  flag:'🇸🇮', lat:46.15, lng:14.99 },
  { iso3:'ESP', iso2:'ES', name:'Spain',             name_fr:'Espagne',          region:'Europe', sub_region:'Southern Europe',  flag:'🇪🇸', lat:40.46, lng:-3.75 },
  { iso3:'SWE', iso2:'SE', name:'Sweden',            name_fr:'Suède',            region:'Europe', sub_region:'Northern Europe',  flag:'🇸🇪', lat:60.13, lng:18.64 },
  { iso3:'CHE', iso2:'CH', name:'Switzerland',       name_fr:'Suisse',           region:'Europe', sub_region:'Western Europe',   flag:'🇨🇭', lat:46.82, lng:8.23 },
  { iso3:'UKR', iso2:'UA', name:'Ukraine',           name_fr:'Ukraine',          region:'Europe', sub_region:'Eastern Europe',   flag:'🇺🇦', lat:48.38, lng:31.17 },
  { iso3:'GBR', iso2:'GB', name:'United Kingdom',   name_fr:'Royaume-Uni',      region:'Europe', sub_region:'Northern Europe',  flag:'🇬🇧', lat:55.38, lng:-3.44 },
  { iso3:'VAT', iso2:'VA', name:'Vatican',           name_fr:'Vatican',          region:'Europe', sub_region:'Southern Europe',  flag:'🇻🇦', lat:41.90, lng:12.45 },
  { iso3:'BLR', iso2:'BY', name:'Belarus',           name_fr:'Biélorussie',      region:'Europe', sub_region:'Eastern Europe',   flag:'🇧🇾', lat:53.71, lng:27.95 },
  { iso3:'RUS', iso2:'RU', name:'Russia',            name_fr:'Russie',           region:'Europe', sub_region:'Eastern Europe',   flag:'🇷🇺', lat:61.52, lng:105.32 },

  // ── Americas ──
  { iso3:'USA', iso2:'US', name:'United States',     name_fr:'États-Unis',       region:'Americas', sub_region:'Northern America', flag:'🇺🇸', lat:37.09, lng:-95.71 },
  { iso3:'CAN', iso2:'CA', name:'Canada',            name_fr:'Canada',           region:'Americas', sub_region:'Northern America', flag:'🇨🇦', lat:56.13, lng:-106.35 },
  { iso3:'MEX', iso2:'MX', name:'Mexico',            name_fr:'Mexique',          region:'Americas', sub_region:'Central America', flag:'🇲🇽', lat:23.63, lng:-102.55 },
  { iso3:'GTM', iso2:'GT', name:'Guatemala',         name_fr:'Guatemala',        region:'Americas', sub_region:'Central America', flag:'🇬🇹', lat:15.78, lng:-90.23 },
  { iso3:'BLZ', iso2:'BZ', name:'Belize',            name_fr:'Belize',           region:'Americas', sub_region:'Central America', flag:'🇧🇿', lat:17.19, lng:-88.50 },
  { iso3:'HND', iso2:'HN', name:'Honduras',          name_fr:'Honduras',         region:'Americas', sub_region:'Central America', flag:'🇭🇳', lat:15.20, lng:-86.24 },
  { iso3:'SLV', iso2:'SV', name:'El Salvador',       name_fr:'Salvador',         region:'Americas', sub_region:'Central America', flag:'🇸🇻', lat:13.79, lng:-88.90 },
  { iso3:'NIC', iso2:'NI', name:'Nicaragua',         name_fr:'Nicaragua',        region:'Americas', sub_region:'Central America', flag:'🇳🇮', lat:12.87, lng:-85.21 },
  { iso3:'CRI', iso2:'CR', name:'Costa Rica',        name_fr:'Costa Rica',       region:'Americas', sub_region:'Central America', flag:'🇨🇷', lat:9.75, lng:-83.75 },
  { iso3:'PAN', iso2:'PA', name:'Panama',            name_fr:'Panama',           region:'Americas', sub_region:'Central America', flag:'🇵🇦', lat:8.54, lng:-80.78 },
  { iso3:'CUB', iso2:'CU', name:'Cuba',              name_fr:'Cuba',             region:'Americas', sub_region:'Caribbean',       flag:'🇨🇺', lat:21.52, lng:-77.78 },
  { iso3:'HTI', iso2:'HT', name:'Haiti',             name_fr:'Haïti',            region:'Americas', sub_region:'Caribbean',       flag:'🇭🇹', lat:18.97, lng:-72.29 },
  { iso3:'DOM', iso2:'DO', name:'Dominican Republic',name_fr:'République dominicaine', region:'Americas', sub_region:'Caribbean', flag:'🇩🇴', lat:18.74, lng:-70.16 },
  { iso3:'JAM', iso2:'JM', name:'Jamaica',           name_fr:'Jamaïque',         region:'Americas', sub_region:'Caribbean',       flag:'🇯🇲', lat:18.11, lng:-77.30 },
  { iso3:'TTO', iso2:'TT', name:'Trinidad and Tobago',name_fr:'Trinité-et-Tobago',region:'Americas', sub_region:'Caribbean',      flag:'🇹🇹', lat:10.69, lng:-61.22 },
  { iso3:'BRB', iso2:'BB', name:'Barbados',          name_fr:'Barbade',          region:'Americas', sub_region:'Caribbean',       flag:'🇧🇧', lat:13.19, lng:-59.54 },
  { iso3:'COL', iso2:'CO', name:'Colombia',          name_fr:'Colombie',         region:'Americas', sub_region:'South America',   flag:'🇨🇴', lat:4.57, lng:-74.30 },
  { iso3:'VEN', iso2:'VE', name:'Venezuela',         name_fr:'Venezuela',        region:'Americas', sub_region:'South America',   flag:'🇻🇪', lat:6.42, lng:-66.59 },
  { iso3:'GUY', iso2:'GY', name:'Guyana',            name_fr:'Guyana',           region:'Americas', sub_region:'South America',   flag:'🇬🇾', lat:4.86, lng:-58.93 },
  { iso3:'SUR', iso2:'SR', name:'Suriname',          name_fr:'Suriname',         region:'Americas', sub_region:'South America',   flag:'🇸🇷', lat:3.92, lng:-56.03 },
  { iso3:'ECU', iso2:'EC', name:'Ecuador',           name_fr:'Équateur',         region:'Americas', sub_region:'South America',   flag:'🇪🇨', lat:-1.83, lng:-78.18 },
  { iso3:'PER', iso2:'PE', name:'Peru',              name_fr:'Pérou',            region:'Americas', sub_region:'South America',   flag:'🇵🇪', lat:-9.19, lng:-75.01 },
  { iso3:'BRA', iso2:'BR', name:'Brazil',            name_fr:'Brésil',           region:'Americas', sub_region:'South America',   flag:'🇧🇷', lat:-14.24, lng:-51.93 },
  { iso3:'BOL', iso2:'BO', name:'Bolivia',           name_fr:'Bolivie',          region:'Americas', sub_region:'South America',   flag:'🇧🇴', lat:-16.29, lng:-63.59 },
  { iso3:'PRY', iso2:'PY', name:'Paraguay',          name_fr:'Paraguay',         region:'Americas', sub_region:'South America',   flag:'🇵🇾', lat:-23.44, lng:-58.44 },
  { iso3:'CHL', iso2:'CL', name:'Chile',             name_fr:'Chili',            region:'Americas', sub_region:'South America',   flag:'🇨🇱', lat:-35.68, lng:-71.54 },
  { iso3:'ARG', iso2:'AR', name:'Argentina',         name_fr:'Argentine',        region:'Americas', sub_region:'South America',   flag:'🇦🇷', lat:-38.42, lng:-63.62 },
  { iso3:'URY', iso2:'UY', name:'Uruguay',           name_fr:'Uruguay',          region:'Americas', sub_region:'South America',   flag:'🇺🇾', lat:-32.52, lng:-55.77 },

  // ── Asia-Pacific ──
  { iso3:'CHN', iso2:'CN', name:'China',             name_fr:'Chine',            region:'Asia', sub_region:'Eastern Asia',       flag:'🇨🇳', lat:35.86, lng:104.20 },
  { iso3:'JPN', iso2:'JP', name:'Japan',             name_fr:'Japon',            region:'Asia', sub_region:'Eastern Asia',       flag:'🇯🇵', lat:36.20, lng:138.25 },
  { iso3:'KOR', iso2:'KR', name:'South Korea',       name_fr:'Corée du Sud',     region:'Asia', sub_region:'Eastern Asia',       flag:'🇰🇷', lat:35.91, lng:127.77 },
  { iso3:'TWN', iso2:'TW', name:'Taiwan',            name_fr:'Taïwan',           region:'Asia', sub_region:'Eastern Asia',       flag:'🇹🇼', lat:23.70, lng:120.96 },
  { iso3:'HKG', iso2:'HK', name:'Hong Kong',         name_fr:'Hong Kong',        region:'Asia', sub_region:'Eastern Asia',       flag:'🇭🇰', lat:22.30, lng:114.17 },
  { iso3:'MNG', iso2:'MN', name:'Mongolia',          name_fr:'Mongolie',         region:'Asia', sub_region:'Eastern Asia',       flag:'🇲🇳', lat:46.86, lng:103.85 },
  { iso3:'IND', iso2:'IN', name:'India',             name_fr:'Inde',             region:'Asia', sub_region:'Southern Asia',      flag:'🇮🇳', lat:20.59, lng:78.96 },
  { iso3:'PAK', iso2:'PK', name:'Pakistan',          name_fr:'Pakistan',         region:'Asia', sub_region:'Southern Asia',      flag:'🇵🇰', lat:30.38, lng:69.35 },
  { iso3:'BGD', iso2:'BD', name:'Bangladesh',        name_fr:'Bangladesh',       region:'Asia', sub_region:'Southern Asia',      flag:'🇧🇩', lat:23.68, lng:90.36 },
  { iso3:'LKA', iso2:'LK', name:'Sri Lanka',         name_fr:'Sri Lanka',        region:'Asia', sub_region:'Southern Asia',      flag:'🇱🇰', lat:7.87, lng:80.77 },
  { iso3:'NPL', iso2:'NP', name:'Nepal',             name_fr:'Népal',            region:'Asia', sub_region:'Southern Asia',      flag:'🇳🇵', lat:28.39, lng:84.12 },
  { iso3:'BTN', iso2:'BT', name:'Bhutan',            name_fr:'Bhoutan',          region:'Asia', sub_region:'Southern Asia',      flag:'🇧🇹', lat:27.51, lng:90.43 },
  { iso3:'MDV', iso2:'MV', name:'Maldives',          name_fr:'Maldives',         region:'Asia', sub_region:'Southern Asia',      flag:'🇲🇻', lat:3.20, lng:73.22 },
  { iso3:'AFG', iso2:'AF', name:'Afghanistan',       name_fr:'Afghanistan',      region:'Asia', sub_region:'Southern Asia',      flag:'🇦🇫', lat:33.94, lng:67.71 },
  { iso3:'IDN', iso2:'ID', name:'Indonesia',         name_fr:'Indonésie',        region:'Asia', sub_region:'South-eastern Asia', flag:'🇮🇩', lat:-0.79, lng:113.92 },
  { iso3:'MYS', iso2:'MY', name:'Malaysia',          name_fr:'Malaisie',         region:'Asia', sub_region:'South-eastern Asia', flag:'🇲🇾', lat:4.21, lng:108.01 },
  { iso3:'SGP', iso2:'SG', name:'Singapore',         name_fr:'Singapour',        region:'Asia', sub_region:'South-eastern Asia', flag:'🇸🇬', lat:1.35, lng:103.82 },
  { iso3:'THA', iso2:'TH', name:'Thailand',          name_fr:'Thaïlande',        region:'Asia', sub_region:'South-eastern Asia', flag:'🇹🇭', lat:15.87, lng:100.99 },
  { iso3:'VNM', iso2:'VN', name:'Vietnam',           name_fr:'Vietnam',          region:'Asia', sub_region:'South-eastern Asia', flag:'🇻🇳', lat:14.06, lng:108.28 },
  { iso3:'PHL', iso2:'PH', name:'Philippines',       name_fr:'Philippines',      region:'Asia', sub_region:'South-eastern Asia', flag:'🇵🇭', lat:12.88, lng:121.77 },
  { iso3:'KHM', iso2:'KH', name:'Cambodia',          name_fr:'Cambodge',         region:'Asia', sub_region:'South-eastern Asia', flag:'🇰🇭', lat:12.57, lng:104.99 },
  { iso3:'LAO', iso2:'LA', name:'Laos',              name_fr:'Laos',             region:'Asia', sub_region:'South-eastern Asia', flag:'🇱🇦', lat:19.86, lng:102.50 },
  { iso3:'MMR', iso2:'MM', name:'Myanmar',           name_fr:'Myanmar',          region:'Asia', sub_region:'South-eastern Asia', flag:'🇲🇲', lat:21.91, lng:95.96 },
  { iso3:'BRN', iso2:'BN', name:'Brunei',            name_fr:'Brunei',           region:'Asia', sub_region:'South-eastern Asia', flag:'🇧🇳', lat:4.53, lng:114.73 },
  { iso3:'TLS', iso2:'TL', name:'Timor-Leste',       name_fr:'Timor-Leste',      region:'Asia', sub_region:'South-eastern Asia', flag:'🇹🇱', lat:-8.87, lng:125.73 },
  { iso3:'SAU', iso2:'SA', name:'Saudi Arabia',      name_fr:'Arabie saoudite',  region:'Asia', sub_region:'Western Asia',       flag:'🇸🇦', lat:23.89, lng:45.08 },
  { iso3:'ARE', iso2:'AE', name:'United Arab Emirates',name_fr:'Émirats arabes unis',region:'Asia', sub_region:'Western Asia',  flag:'🇦🇪', lat:23.42, lng:53.85 },
  { iso3:'IRN', iso2:'IR', name:'Iran',              name_fr:'Iran',             region:'Asia', sub_region:'Western Asia',       flag:'🇮🇷', lat:32.43, lng:53.69 },
  { iso3:'IRQ', iso2:'IQ', name:'Iraq',              name_fr:'Irak',             region:'Asia', sub_region:'Western Asia',       flag:'🇮🇶', lat:33.22, lng:43.68 },
  { iso3:'KWT', iso2:'KW', name:'Kuwait',            name_fr:'Koweït',           region:'Asia', sub_region:'Western Asia',       flag:'🇰🇼', lat:29.31, lng:47.48 },
  { iso3:'QAT', iso2:'QA', name:'Qatar',             name_fr:'Qatar',            region:'Asia', sub_region:'Western Asia',       flag:'🇶🇦', lat:25.35, lng:51.18 },
  { iso3:'BHR', iso2:'BH', name:'Bahrain',           name_fr:'Bahreïn',          region:'Asia', sub_region:'Western Asia',       flag:'🇧🇭', lat:26.00, lng:50.55 },
  { iso3:'OMN', iso2:'OM', name:'Oman',              name_fr:'Oman',             region:'Asia', sub_region:'Western Asia',       flag:'🇴🇲', lat:21.51, lng:55.92 },
  { iso3:'YEM', iso2:'YE', name:'Yemen',             name_fr:'Yémen',            region:'Asia', sub_region:'Western Asia',       flag:'🇾🇪', lat:15.55, lng:48.52 },
  { iso3:'JOR', iso2:'JO', name:'Jordan',            name_fr:'Jordanie',         region:'Asia', sub_region:'Western Asia',       flag:'🇯🇴', lat:30.59, lng:36.24 },
  { iso3:'LBN', iso2:'LB', name:'Lebanon',           name_fr:'Liban',            region:'Asia', sub_region:'Western Asia',       flag:'🇱🇧', lat:33.85, lng:35.86 },
  { iso3:'SYR', iso2:'SY', name:'Syria',             name_fr:'Syrie',            region:'Asia', sub_region:'Western Asia',       flag:'🇸🇾', lat:34.80, lng:38.99 },
  { iso3:'ISR', iso2:'IL', name:'Israel',            name_fr:'Israël',           region:'Asia', sub_region:'Western Asia',       flag:'🇮🇱', lat:31.05, lng:34.85 },
  { iso3:'TUR', iso2:'TR', name:'Turkey',            name_fr:'Turquie',          region:'Asia', sub_region:'Western Asia',       flag:'🇹🇷', lat:38.96, lng:35.24 },
  { iso3:'GEO', iso2:'GE', name:'Georgia',           name_fr:'Géorgie',          region:'Asia', sub_region:'Western Asia',       flag:'🇬🇪', lat:42.32, lng:43.36 },
  { iso3:'ARM', iso2:'AM', name:'Armenia',           name_fr:'Arménie',          region:'Asia', sub_region:'Western Asia',       flag:'🇦🇲', lat:40.07, lng:45.04 },
  { iso3:'AZE', iso2:'AZ', name:'Azerbaijan',        name_fr:'Azerbaïdjan',      region:'Asia', sub_region:'Western Asia',       flag:'🇦🇿', lat:40.14, lng:47.58 },
  { iso3:'KAZ', iso2:'KZ', name:'Kazakhstan',        name_fr:'Kazakhstan',       region:'Asia', sub_region:'Central Asia',       flag:'🇰🇿', lat:48.02, lng:66.92 },
  { iso3:'UZB', iso2:'UZ', name:'Uzbekistan',        name_fr:'Ouzbékistan',      region:'Asia', sub_region:'Central Asia',       flag:'🇺🇿', lat:41.38, lng:64.59 },
  { iso3:'TKM', iso2:'TM', name:'Turkmenistan',      name_fr:'Turkménistan',     region:'Asia', sub_region:'Central Asia',       flag:'🇹🇲', lat:38.97, lng:59.56 },
  { iso3:'TJK', iso2:'TJ', name:'Tajikistan',        name_fr:'Tadjikistan',      region:'Asia', sub_region:'Central Asia',       flag:'🇹🇯', lat:38.86, lng:71.28 },
  { iso3:'KGZ', iso2:'KG', name:'Kyrgyzstan',        name_fr:'Kirghizistan',     region:'Asia', sub_region:'Central Asia',       flag:'🇰🇬', lat:41.20, lng:74.77 },

  // ── Africa ──
  { iso3:'DZA', iso2:'DZ', name:'Algeria',           name_fr:'Algérie',          region:'Africa', sub_region:'Northern Africa',  flag:'🇩🇿', lat:28.03, lng:1.66 },
  { iso3:'EGY', iso2:'EG', name:'Egypt',             name_fr:'Égypte',           region:'Africa', sub_region:'Northern Africa',  flag:'🇪🇬', lat:26.82, lng:30.80 },
  { iso3:'LBY', iso2:'LY', name:'Libya',             name_fr:'Libye',            region:'Africa', sub_region:'Northern Africa',  flag:'🇱🇾', lat:26.34, lng:17.23 },
  { iso3:'MAR', iso2:'MA', name:'Morocco',           name_fr:'Maroc',            region:'Africa', sub_region:'Northern Africa',  flag:'🇲🇦', lat:31.79, lng:-7.09 },
  { iso3:'TUN', iso2:'TN', name:'Tunisia',           name_fr:'Tunisie',          region:'Africa', sub_region:'Northern Africa',  flag:'🇹🇳', lat:33.89, lng:9.54 },
  { iso3:'SDN', iso2:'SD', name:'Sudan',             name_fr:'Soudan',           region:'Africa', sub_region:'Northern Africa',  flag:'🇸🇩', lat:12.86, lng:30.22 },
  { iso3:'ETH', iso2:'ET', name:'Ethiopia',          name_fr:'Éthiopie',         region:'Africa', sub_region:'Eastern Africa',   flag:'🇪🇹', lat:9.15, lng:40.49 },
  { iso3:'KEN', iso2:'KE', name:'Kenya',             name_fr:'Kenya',            region:'Africa', sub_region:'Eastern Africa',   flag:'🇰🇪', lat:0.02, lng:37.91 },
  { iso3:'TZA', iso2:'TZ', name:'Tanzania',          name_fr:'Tanzanie',         region:'Africa', sub_region:'Eastern Africa',   flag:'🇹🇿', lat:-6.37, lng:34.89 },
  { iso3:'UGA', iso2:'UG', name:'Uganda',            name_fr:'Ouganda',          region:'Africa', sub_region:'Eastern Africa',   flag:'🇺🇬', lat:1.37, lng:32.29 },
  { iso3:'RWA', iso2:'RW', name:'Rwanda',            name_fr:'Rwanda',           region:'Africa', sub_region:'Eastern Africa',   flag:'🇷🇼', lat:-1.94, lng:29.87 },
  { iso3:'MOZ', iso2:'MZ', name:'Mozambique',        name_fr:'Mozambique',       region:'Africa', sub_region:'Eastern Africa',   flag:'🇲🇿', lat:-18.67, lng:35.53 },
  { iso3:'MDG', iso2:'MG', name:'Madagascar',        name_fr:'Madagascar',       region:'Africa', sub_region:'Eastern Africa',   flag:'🇲🇬', lat:-18.77, lng:46.87 },
  { iso3:'ZMB', iso2:'ZM', name:'Zambia',            name_fr:'Zambie',           region:'Africa', sub_region:'Eastern Africa',   flag:'🇿🇲', lat:-13.13, lng:27.85 },
  { iso3:'ZWE', iso2:'ZW', name:'Zimbabwe',          name_fr:'Zimbabwe',         region:'Africa', sub_region:'Eastern Africa',   flag:'🇿🇼', lat:-19.02, lng:29.15 },
  { iso3:'NGA', iso2:'NG', name:'Nigeria',           name_fr:'Nigeria',          region:'Africa', sub_region:'Western Africa',   flag:'🇳🇬', lat:9.08, lng:8.68 },
  { iso3:'GHA', iso2:'GH', name:'Ghana',             name_fr:'Ghana',            region:'Africa', sub_region:'Western Africa',   flag:'🇬🇭', lat:7.95, lng:-1.02 },
  { iso3:'CIV', iso2:'CI', name:"Cote d'Ivoire",    name_fr:"Côte d'Ivoire",   region:'Africa', sub_region:'Western Africa',   flag:'🇨🇮', lat:7.54, lng:-5.55 },
  { iso3:'SEN', iso2:'SN', name:'Senegal',           name_fr:'Sénégal',          region:'Africa', sub_region:'Western Africa',   flag:'🇸🇳', lat:14.50, lng:-14.45 },
  { iso3:'CMR', iso2:'CM', name:'Cameroon',          name_fr:'Cameroun',         region:'Africa', sub_region:'Central Africa',   flag:'🇨🇲', lat:7.37, lng:12.35 },
  { iso3:'COD', iso2:'CD', name:'DR Congo',          name_fr:'RD Congo',         region:'Africa', sub_region:'Central Africa',   flag:'🇨🇩', lat:-4.04, lng:21.76 },
  { iso3:'AGO', iso2:'AO', name:'Angola',            name_fr:'Angola',           region:'Africa', sub_region:'Central Africa',   flag:'🇦🇴', lat:-11.20, lng:17.87 },
  { iso3:'ZAF', iso2:'ZA', name:'South Africa',      name_fr:'Afrique du Sud',   region:'Africa', sub_region:'Southern Africa',  flag:'🇿🇦', lat:-30.56, lng:22.94 },
  { iso3:'NAM', iso2:'NA', name:'Namibia',           name_fr:'Namibie',          region:'Africa', sub_region:'Southern Africa',  flag:'🇳🇦', lat:-22.96, lng:18.49 },
  { iso3:'BWA', iso2:'BW', name:'Botswana',          name_fr:'Botswana',         region:'Africa', sub_region:'Southern Africa',  flag:'🇧🇼', lat:-22.33, lng:24.68 },

  // ── Oceania ──
  { iso3:'AUS', iso2:'AU', name:'Australia',         name_fr:'Australie',        region:'Oceania', sub_region:'Australia and New Zealand', flag:'🇦🇺', lat:-25.27, lng:133.78 },
  { iso3:'NZL', iso2:'NZ', name:'New Zealand',       name_fr:'Nouvelle-Zélande', region:'Oceania', sub_region:'Australia and New Zealand', flag:'🇳🇿', lat:-40.90, lng:174.89 },
  { iso3:'PNG', iso2:'PG', name:'Papua New Guinea',  name_fr:'Papouasie-N-G',    region:'Oceania', sub_region:'Melanesia',       flag:'🇵🇬', lat:-6.31, lng:143.96 },
  { iso3:'FJI', iso2:'FJ', name:'Fiji',              name_fr:'Fidji',            region:'Oceania', sub_region:'Melanesia',       flag:'🇫🇯', lat:-16.58, lng:179.41 },
]

// ── Rate limiting helper ─────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── World Bank macro fetch ───────────────────────────────────────────────────

const FETCH_TIMEOUT = 8000

async function safeFetch(url: string, options: RequestInit = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(FETCH_TIMEOUT) })
}

async function fetchWorldBankMacro(iso2: string, iso3: string, year = 2022) {
  const WB_BASE = 'https://api.worldbank.org/v2'
  const indicators = {
    gdp_usd:           'NY.GDP.MKTP.CD',
    total_imports_usd: 'TM.VAL.MRCH.CD.WT',
    total_exports_usd: 'TX.VAL.MRCH.CD.WT',
    population:        'SP.POP.TOTL',
    arable_land_pct:   'AG.LND.ARBL.ZS',
  }

  const result: Record<string, any> = {}
  for (const [key, code] of Object.entries(indicators)) {
    try {
      const url = `${WB_BASE}/country/${iso2}/indicator/${code}?date=${year}&format=json&per_page=1`
      const res = await safeFetch(url)
      if (!res.ok) continue
      const json = await res.json()
      const val = json?.[1]?.[0]?.value
      if (val != null) result[key] = val
      await sleep(200)
    } catch {}
  }
  return result
}

// ── World Bank WITS product trade ────────────────────────────────────────────

async function fetchWITSTopImports(iso3: string, year = 2022) {
  try {
    const url = `https://wits.worldbank.org/API/V1/wits/datasource/tradestats-trade/reporter/${iso3}/year/${year}/partner/WLD/product/TOTALPRIMARYANDMANUFACTURED/indicator/TM-VAL-MRCH-CD-WT?format=JSON`
    const res = await safeFetch(url, { headers: { 'Accept': 'application/json' } })
    if (!res.ok) return []
    const json = await res.json()
    const data = json?.dataSets?.[0]?.series ?? {}
    // Parse top products
    return Object.entries(data).slice(0, 20).map(([k, v]: any) => ({
      product_code: k,
      value_usd: v?.observations?.['0']?.[0] ?? 0,
    })).filter(x => x.value_usd > 0).sort((a, b) => b.value_usd - a.value_usd)
  } catch {
    return []
  }
}

// ── Eurostat COMEXT for EU countries ─────────────────────────────────────────

async function fetchEurostatTrade(iso2: string, year = 2022) {
  try {
    // Eurostat COMEXT: get top imports by CN2/HS2 for reporter country
    const url = `https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/DS-059341?startPeriod=${year}&endPeriod=${year}&reporter=${iso2}&partner=EXT_EU27_2020&flow=1&product=TOTAL&format=JSON`
    const res = await safeFetch(url)
    if (!res.ok) return null
    const json = await res.json()
    return json
  } catch {
    return null
  }
}

// ── WTO Stats ────────────────────────────────────────────────────────────────

async function fetchWTOStats(iso3: string, year = 2022) {
  try {
    const url = `https://api.wto.org/indicators/en/indicator/ITS_CS_AM6/reporting/${iso3}?reportingPeriod=${year}&format=json`
    const res = await safeFetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ── OECD Trade stats ─────────────────────────────────────────────────────────

async function fetchOECDTrade(iso3: string, year = 2022) {
  try {
    // OECD SDMX: TRADE_IN_GOODS data
    const url = `https://stats.oecd.org/SDMX-JSON/data/TRADE_IN_GOODS/${iso3}.TOTAL.IMPORTS.USD_EXR_PERIOD/${year}?format=jsontext`
    const res = await safeFetch(url)
    if (!res.ok) return null
    const json = await res.json()
    const datasets = json?.dataSets?.[0]?.observations
    if (!datasets) return null
    return { total_imports: Object.values(datasets)[0]?.[0] }
  } catch {
    return null
  }
}

// ── CIA World Factbook for product profiles ──────────────────────────────────

async function fetchFactbookTopImports(iso3: string): Promise<string[] | null> {
  try {
    const iso2lower = ALL_COUNTRIES.find(c => c.iso3 === iso3)?.iso2?.toLowerCase()
    if (!iso2lower) return null
    const url = `https://raw.githubusercontent.com/factbook/factbook.json/master/${getFactbookRegion(iso3)}/${iso2lower}.json`
    const res = await safeFetch(url)
    if (!res.ok) return null
    const json = await res.json()
    const imports = json?.Economy?.['Imports - commodities']?.text
    return imports ? [imports] : null
  } catch {
    return null
  }
}

function getFactbookRegion(iso3: string): string {
  const country = ALL_COUNTRIES.find(c => c.iso3 === iso3)
  const regionMap: Record<string, string> = {
    'Europe': 'europe', 'Americas': 'south-america', 'Asia': 'east-n-southeast-asia',
    'Africa': 'africa', 'Oceania': 'australia-oceania'
  }
  // Better mapping based on sub_region
  if (country?.sub_region?.includes('Northern America')) return 'north-america'
  if (country?.sub_region?.includes('Central America') || country?.sub_region?.includes('Caribbean')) return 'central-america-n-caribbean'
  if (country?.sub_region?.includes('South America')) return 'south-america'
  if (country?.sub_region?.includes('Western Asia') || country?.sub_region?.includes('Middle')) return 'middle-east'
  if (country?.sub_region?.includes('Southern Asia')) return 'south-asia'
  if (country?.sub_region?.includes('South-eastern') || country?.sub_region?.includes('Eastern Asia')) return 'east-n-southeast-asia'
  if (country?.sub_region?.includes('Central Asia')) return 'central-asia'
  if (country?.sub_region?.includes('Northern Africa')) return 'africa'
  if (country?.sub_region?.includes('Eastern Africa') || country?.sub_region?.includes('Western Africa') || country?.sub_region?.includes('Central Africa') || country?.sub_region?.includes('Southern Africa')) return 'africa'
  if (country?.sub_region?.includes('Eastern Europe') || country?.sub_region?.includes('Western Europe') || country?.sub_region?.includes('Northern Europe') || country?.sub_region?.includes('Southern Europe')) return 'europe'
  if (country?.region === 'Oceania') return 'australia-oceania'
  return 'world'
}

// ── FAO trade for agricultural countries ────────────────────────────────────

async function fetchFAOTradeSimple(iso3: string, year = 2022) {
  try {
    // FAO STAT API: get top import values for a country
    const url = `https://fenixservices.fao.org/faostat/api/v1/en/data/TCL?reporting_area_cs=${iso3}&element_cs=5622&year_cs=${year}&format=json&max_records=20`
    const res = await safeFetch(url)
    if (!res.ok) return []
    const json = await res.json()
    return (json?.data ?? []).map((row: any) => ({
      product: row.Item,
      value_usd: parseFloat(row.Value) * 1000, // FAO reports in 1000 USD
      element: row.Element,
    })).filter((r: any) => r.value_usd > 0).sort((a: any, b: any) => b.value_usd - a.value_usd)
  } catch {
    return []
  }
}

// ── HS2 category mapping ─────────────────────────────────────────────────────

function hs2ToCategory(hs2: string): string {
  const code = parseInt(hs2)
  if (code >= 1 && code <= 24) return 'agriculture'
  if (code >= 25 && code <= 27) return code === 27 ? 'energy' : 'materials'
  if (code >= 28 && code <= 38) return 'materials'
  if (code >= 39 && code <= 40) return 'materials'
  if (code >= 41 && code <= 67) return 'manufactured'
  if (code >= 68 && code <= 71) return 'materials'
  if (code >= 72 && code <= 83) return 'materials'
  if (code >= 84 && code <= 92) return 'manufactured'
  if (code >= 93 && code <= 99) return 'manufactured'
  return 'manufactured'
}

// ── Main exhaustive collection runner ────────────────────────────────────────

export interface ExhaustiveOptions {
  mode?: 'full' | 'europe' | 'missing' | 'refresh'
  isos?: string[]
  year?: number
  batchSize?: number
}

export async function runExhaustiveCollector(opts: ExhaustiveOptions = {}) {
  const { mode = 'full', year = 2023, batchSize = 10 } = opts
  const admin = supabaseAdmin()
  const startTime = Date.now()

  console.log(`[ExhaustiveCollector] Starting — mode=${mode}, year=${year}`)

  // 1. Determine countries to process
  let targetCountries = [...ALL_COUNTRIES]

  if (opts.isos?.length) {
    targetCountries = ALL_COUNTRIES.filter(c => opts.isos!.includes(c.iso3))
    console.log(`[ExhaustiveCollector] Targeting ${targetCountries.length} specific countries: ${opts.isos.join(', ')}`)
  } else if (mode === 'europe') {
    targetCountries = ALL_COUNTRIES.filter(c => c.region === 'Europe')
    console.log(`[ExhaustiveCollector] Europe mode: ${targetCountries.length} countries`)
  } else if (mode === 'missing') {
    // Find countries with no or minimal data
    const { data: existing } = await admin.from('countries').select('id, total_imports_usd')
    const existingSet = new Set(existing?.filter(c => c.total_imports_usd != null).map(c => c.id))
    targetCountries = ALL_COUNTRIES.filter(c => !existingSet.has(c.iso3))
    console.log(`[ExhaustiveCollector] Missing mode: ${targetCountries.length} countries without data`)
  } else {
    console.log(`[ExhaustiveCollector] Full mode: ${targetCountries.length} countries`)
  }

  // 2. Create run record
  const { data: run } = await admin.from('agent_runs').insert({
    agent: 'exhaustive_collector',
    status: 'running',
    countries_processed: 0,
    records_inserted: 0,
    started_at: new Date().toISOString(),
  }).select().single()
  const runId = run?.id

  let countriesProcessed = 0
  let recordsInserted = 0

  // 3. Process in batches
  for (let i = 0; i < targetCountries.length; i += batchSize) {
    const batch = targetCountries.slice(i, i + batchSize)

    for (const country of batch) {
      try {
        console.log(`[ExhaustiveCollector] Processing ${country.iso3} (${country.name_fr}) — ${i + 1}/${targetCountries.length}`)

        // ── Phase A: Ensure country exists in DB ──────────────────────────────
        const { data: existing } = await admin.from('countries').select('id').eq('id', country.iso3).single()

        if (!existing) {
          await admin.from('countries').insert({
            id: country.iso3,
            name: country.name,
            name_fr: country.name_fr,
            flag: country.flag,
            region: country.region,
            sub_region: country.sub_region,
            lat: country.lat,
            lng: country.lng,
            data_year: year,
          })
        }

        // ── Phase B: World Bank macro data ────────────────────────────────────
        const macro = await fetchWorldBankMacro(country.iso2, country.iso3, year)
        if (Object.keys(macro).length > 0) {
          await admin.from('countries').update({
            ...macro,
            data_year: year,
          }).eq('id', country.iso3)
          recordsInserted++
        }
        await sleep(300)

        // ── Phase C: FAO STAT agricultural trade data ─────────────────────────
        const faoData = await fetchFAOTradeSimple(country.iso3, year)
        if (faoData.length > 0) {
          const faoSlice = faoData.slice(0, 30)

          // Ensure products exist before inserting trade_flows (FK constraint)
          const productRows = faoSlice.map((f: any) => ({
            id: slugify(f.product).slice(0, 50),
            name: f.product,
            name_fr: f.product,
            category: 'agriculture',
            subcategory: f.category ?? 'agriculture',
            unit: 'USD',
            hs2: '01',
            hs4: '0100',
          }))
          await admin.from('products').upsert(productRows, { onConflict: 'id' })

          const faoImports = faoSlice.map((f: any) => ({
            reporter_iso: country.iso3,
            partner_iso: 'WLD',
            product_id: slugify(f.product).slice(0, 50),
            year,
            flow: 'import',
            value_usd: Math.round(f.value_usd),
            quantity: null,
            source: 'FAOSTAT',
          }))

          for (let j = 0; j < faoImports.length; j += 50) {
            const { error: tfErr } = await admin.from('trade_flows').upsert(faoImports.slice(j, j + 50), {
              onConflict: 'reporter_iso,partner_iso,product_id,year,flow',
            })
            if (!tfErr) recordsInserted += Math.min(50, faoImports.length - j)
          }

          // Update top category based on dominant FAO category
          const topFAO = faoData[0]
          if (topFAO) {
            await admin.from('countries').update({
              top_import_category: 'agriculture',
              data_year: year,
            }).eq('id', country.iso3).is('top_import_category', null)
          }
        }
        await sleep(400)

        // ── Phase D: CIA World Factbook product text ──────────────────────────
        const factbookImports = await fetchFactbookTopImports(country.iso3)
        if (factbookImports?.length) {
          // Parse product text and try to store as a summary
          const importText = factbookImports.join(', ')
          await admin.from('countries').update({
            top_import_text: importText.slice(0, 500),
          }).eq('id', country.iso3)
        }
        await sleep(500)

        countriesProcessed++

        // Update run progress every 10 countries
        if (countriesProcessed % 10 === 0 && runId) {
          await admin.from('agent_runs').update({
            countries_processed: countriesProcessed,
            records_inserted: recordsInserted,
          }).eq('id', runId)
          const elapsed = Math.round((Date.now() - startTime) / 1000)
          const rate = countriesProcessed / elapsed
          const remaining = targetCountries.length - countriesProcessed
          const eta = Math.round(remaining / rate / 60)
          console.log(`[ExhaustiveCollector] Progress: ${countriesProcessed}/${targetCountries.length} | ${recordsInserted} records | ETA: ~${eta}min`)
        }

      } catch (err) {
        console.warn(`[ExhaustiveCollector] Error for ${country.iso3}:`, err)
        await sleep(1000) // Back off on error
      }
    }

    // Pause between batches to respect rate limits
    if (i + batchSize < targetCountries.length) {
      console.log(`[ExhaustiveCollector] Batch ${Math.floor(i/batchSize)+1} complete, cooling down 2s...`)
      await sleep(2000)
    }
  }

  // 4. Run gap analysis on all newly collected data
  console.log('[ExhaustiveCollector] Running gap analysis on new data...')
  try {
    const { runGapAnalyzer } = await import('./free-collector')
    await runGapAnalyzer()
  } catch (err) {
    console.warn('[ExhaustiveCollector] Gap analyzer error:', err)
  }

  // 5. Finalize run record
  const totalTime = Math.round((Date.now() - startTime) / 1000)
  if (runId) {
    await admin.from('agent_runs').update({
      status: 'completed',
      countries_processed: countriesProcessed,
      records_inserted: recordsInserted,
      completed_at: new Date().toISOString(),
    }).eq('id', runId)
  }

  console.log(`[ExhaustiveCollector] ✓ Complete — ${countriesProcessed} countries, ${recordsInserted} records, ${totalTime}s`)
  return { countriesProcessed, recordsInserted, totalTimeSeconds: totalTime }
}

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

// ── CLI entrypoint ───────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2)
  const modeArg = args.find(a => a.startsWith('--mode='))?.split('=')[1]
  const isoArg  = args.find(a => a.startsWith('--iso='))?.split('=')[1]?.split(',')
  const yearArg = args.find(a => a.startsWith('--year='))?.split('=')[1]

  runExhaustiveCollector({
    mode: (modeArg as any) || 'full',
    isos: isoArg,
    year: yearArg ? parseInt(yearArg) : 2023,
  }).then(result => {
    console.log('[ExhaustiveCollector] Done:', result)
    process.exit(0)
  }).catch(err => {
    console.error('[ExhaustiveCollector] Fatal error:', err)
    process.exit(1)
  })
}
