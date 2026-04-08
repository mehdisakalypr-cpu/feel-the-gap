import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SEED_TRADE_DATA } from '@/data/seed-trade-data'
import { isAdmin } from '@/lib/supabase-server'

const COUNTRY_META: Record<string, { iso2:string; name:string; name_fr:string; flag:string; lat:number; lng:number; region:string; sub_region:string; population:number; gdp_usd:number }> = {
  DEU:{iso2:'DE',name:'Germany',name_fr:'Allemagne',flag:'🇩🇪',lat:51.17,lng:10.45,region:'Europe',sub_region:'Western Europe',population:83783942,gdp_usd:4072000000000},
  FRA:{iso2:'FR',name:'France',name_fr:'France',flag:'🇫🇷',lat:46.23,lng:2.21,region:'Europe',sub_region:'Western Europe',population:65273511,gdp_usd:2782000000000},
  GBR:{iso2:'GB',name:'United Kingdom',name_fr:'Royaume-Uni',flag:'🇬🇧',lat:55.38,lng:-3.44,region:'Europe',sub_region:'Northern Europe',population:67886011,gdp_usd:3070000000000},
  ITA:{iso2:'IT',name:'Italy',name_fr:'Italie',flag:'🇮🇹',lat:41.87,lng:12.57,region:'Europe',sub_region:'Southern Europe',population:60461826,gdp_usd:2010000000000},
  ESP:{iso2:'ES',name:'Spain',name_fr:'Espagne',flag:'🇪🇸',lat:40.46,lng:-3.75,region:'Europe',sub_region:'Southern Europe',population:46754778,gdp_usd:1418000000000},
  NLD:{iso2:'NL',name:'Netherlands',name_fr:'Pays-Bas',flag:'🇳🇱',lat:52.13,lng:5.29,region:'Europe',sub_region:'Western Europe',population:17134872,gdp_usd:1011000000000},
  BEL:{iso2:'BE',name:'Belgium',name_fr:'Belgique',flag:'🇧🇪',lat:50.50,lng:4.47,region:'Europe',sub_region:'Western Europe',population:11589623,gdp_usd:579000000000},
  CHE:{iso2:'CH',name:'Switzerland',name_fr:'Suisse',flag:'🇨🇭',lat:46.82,lng:8.23,region:'Europe',sub_region:'Western Europe',population:8654622,gdp_usd:807000000000},
  SWE:{iso2:'SE',name:'Sweden',name_fr:'Suède',flag:'🇸🇪',lat:60.13,lng:18.64,region:'Europe',sub_region:'Northern Europe',population:10099265,gdp_usd:585000000000},
  NOR:{iso2:'NO',name:'Norway',name_fr:'Norvège',flag:'🇳🇴',lat:60.47,lng:8.47,region:'Europe',sub_region:'Northern Europe',population:5421241,gdp_usd:482000000000},
  DNK:{iso2:'DK',name:'Denmark',name_fr:'Danemark',flag:'🇩🇰',lat:56.26,lng:9.50,region:'Europe',sub_region:'Northern Europe',population:5792202,gdp_usd:395000000000},
  AUT:{iso2:'AT',name:'Austria',name_fr:'Autriche',flag:'🇦🇹',lat:47.52,lng:14.55,region:'Europe',sub_region:'Western Europe',population:9006398,gdp_usd:477000000000},
  FIN:{iso2:'FI',name:'Finland',name_fr:'Finlande',flag:'🇫🇮',lat:61.92,lng:25.75,region:'Europe',sub_region:'Northern Europe',population:5540720,gdp_usd:281000000000},
  IRL:{iso2:'IE',name:'Ireland',name_fr:'Irlande',flag:'🇮🇪',lat:53.41,lng:-8.24,region:'Europe',sub_region:'Northern Europe',population:4937786,gdp_usd:529000000000},
  PRT:{iso2:'PT',name:'Portugal',name_fr:'Portugal',flag:'🇵🇹',lat:39.40,lng:-8.22,region:'Europe',sub_region:'Southern Europe',population:10196709,gdp_usd:240000000000},
  GRC:{iso2:'GR',name:'Greece',name_fr:'Grèce',flag:'🇬🇷',lat:39.07,lng:21.82,region:'Europe',sub_region:'Southern Europe',population:10423054,gdp_usd:218000000000},
  CHN:{iso2:'CN',name:'China',name_fr:'Chine',flag:'🇨🇳',lat:35.86,lng:104.20,region:'Asia',sub_region:'Eastern Asia',population:1439323776,gdp_usd:17963000000000},
  USA:{iso2:'US',name:'United States',name_fr:'États-Unis',flag:'🇺🇸',lat:37.09,lng:-95.71,region:'Americas',sub_region:'Northern America',population:331002651,gdp_usd:25463000000000},
  JPN:{iso2:'JP',name:'Japan',name_fr:'Japon',flag:'🇯🇵',lat:36.20,lng:138.25,region:'Asia',sub_region:'Eastern Asia',population:126476461,gdp_usd:4232000000000},
  KOR:{iso2:'KR',name:'South Korea',name_fr:'Corée du Sud',flag:'🇰🇷',lat:35.91,lng:127.77,region:'Asia',sub_region:'Eastern Asia',population:51269185,gdp_usd:1665000000000},
  CAN:{iso2:'CA',name:'Canada',name_fr:'Canada',flag:'🇨🇦',lat:56.13,lng:-106.35,region:'Americas',sub_region:'Northern America',population:37742154,gdp_usd:2140000000000},
  AUS:{iso2:'AU',name:'Australia',name_fr:'Australie',flag:'🇦🇺',lat:-25.27,lng:133.78,region:'Oceania',sub_region:'Australia and New Zealand',population:25499884,gdp_usd:1703000000000},
  RUS:{iso2:'RU',name:'Russia',name_fr:'Russie',flag:'🇷🇺',lat:61.52,lng:105.32,region:'Europe',sub_region:'Eastern Europe',population:145934462,gdp_usd:2241000000000},
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = supabaseAdmin()
  const { data: existing } = await admin.from('countries').select('id')
  const existingIds = new Set((existing ?? []).map((c: any) => c.id))

  // Build new country rows
  const newCountries = SEED_TRADE_DATA
    .filter(c => COUNTRY_META[c.iso3] && !existingIds.has(c.iso3))
    .map(c => {
      const m = COUNTRY_META[c.iso3]
      return {
        id: c.iso3, iso2: m.iso2, name: m.name, name_fr: m.name_fr,
        flag: m.flag, lat: m.lat, lng: m.lng, region: m.region, sub_region: m.sub_region,
        population: m.population, gdp_usd: m.gdp_usd,
        total_imports_usd: c.total_imports_usd,
        total_exports_usd: c.total_exports_usd,
        trade_balance_usd: c.total_exports_usd - c.total_imports_usd,
        top_import_category: c.top_categories[0] ?? null,
        data_year: c.data_year,
        arable_land_pct: c.arable_land_pct,
      }
    })

  if (newCountries.length === 0) {
    return NextResponse.json({ ok: true, message: 'No new countries to insert', existing: existingIds.size })
  }

  const { error: cErr } = await admin.from('countries').upsert(newCountries, { onConflict: 'id' })
  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 })

  // Products
  const productMap = new Map<string, any>()
  for (const c of SEED_TRADE_DATA.filter(c => COUNTRY_META[c.iso3])) {
    for (const imp of c.top_imports ?? []) {
      const id = imp.hs2.padStart(4,'0') + '_' + imp.product.toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,40)
      if (!productMap.has(id)) {
        productMap.set(id, { id, hs2: imp.hs2.slice(0,2), hs4: imp.hs2.padStart(4,'0'), name: imp.product, name_fr: imp.product, category: imp.category, subcategory: imp.category, unit: 'USD' })
      }
    }
  }
  await admin.from('products').upsert(Array.from(productMap.values()), { onConflict: 'id' })

  // Opportunities for new countries
  const { data: products } = await admin.from('products').select('id, name')
  const productList = products ?? []
  const oppRows = []
  for (const c of SEED_TRADE_DATA.filter(c => COUNTRY_META[c.iso3] && !existingIds.has(c.iso3))) {
    for (const gap of c.key_gaps ?? []) {
      const matched = productList.find((p: any) => p.name.toLowerCase().includes(gap.product.split(' ')[0].toLowerCase()))
      if (!matched) continue
      oppRows.push({
        country_iso: c.iso3, product_id: matched.id, type: gap.opportunity_type,
        gap_value_usd: gap.gap_value_usd, opportunity_score: Math.min(100, gap.score),
        summary: gap.summary, land_availability: c.arable_land_pct > 30 ? 'high' : c.arable_land_pct > 15 ? 'medium' : 'low',
        labor_cost_index: c.labor_cost_index, infrastructure_score: c.infrastructure_score,
      })
    }
  }
  if (oppRows.length > 0) {
    await admin.from('opportunities').upsert(oppRows, { onConflict: 'country_iso,product_id,type' })
  }

  return NextResponse.json({
    ok: true,
    inserted_countries: newCountries.length,
    inserted_opportunities: oppRows.length,
    countries: newCountries.map(c => c.id),
  })
}
