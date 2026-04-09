import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Cron endpoint: generate market studies for countries with opportunities.
 * Processes one country per invocation to stay within function timeout.
 * Call repeatedly (e.g., every 5 minutes) to process all countries.
 *
 * Query params:
 *   ?iso=NGA         — generate for a specific country
 *   ?part=1          — generate only a specific part
 *   ?force=true      — regenerate even if exists
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET && !req.headers.get('authorization')?.includes(process.env.CRON_SECRET ?? '___')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isoParam = req.nextUrl.searchParams.get('iso')?.toUpperCase()
  const partParam = parseInt(req.nextUrl.searchParams.get('part') ?? '0') || 0
  const force = req.nextUrl.searchParams.get('force') === 'true'

  const admin = supabaseAdmin()
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

  // Find next country to process
  let targetIso: string
  if (isoParam) {
    targetIso = isoParam
  } else {
    // Get countries with opportunities that don't have all 3 study parts
    const { data: opps } = await admin.from('opportunities').select('country_iso')
    const countMap: Record<string, number> = {}
    for (const o of (opps ?? [])) countMap[o.country_iso] = (countMap[o.country_iso] ?? 0) + 1

    const { data: existing } = await admin.from('country_studies').select('country_iso, part')
    const studyMap: Record<string, Set<number>> = {}
    for (const s of (existing ?? [])) {
      if (!studyMap[s.country_iso]) studyMap[s.country_iso] = new Set()
      studyMap[s.country_iso].add(s.part)
    }

    // Find first country missing any part, prioritized by opp count
    const sorted = Object.entries(countMap).sort((a, b) => b[1] - a[1])
    const target = sorted.find(([iso]) => {
      const parts = studyMap[iso] ?? new Set()
      return parts.size < 3
    })

    if (!target) return NextResponse.json({ message: 'All studies generated', done: true })
    targetIso = target[0]
  }

  // Determine which part to generate
  const { data: existingParts } = await admin.from('country_studies').select('part').eq('country_iso', targetIso)
  const doneParts = new Set((existingParts ?? []).map((p: any) => p.part))

  let targetPart = partParam
  if (!targetPart) {
    for (const p of [1, 2, 3]) {
      if (!doneParts.has(p) || force) { targetPart = p; break }
    }
  }

  if (!targetPart || (doneParts.has(targetPart) && !force)) {
    return NextResponse.json({ message: `All parts done for ${targetIso}`, iso: targetIso, done: true })
  }

  // Fetch context
  const [{ data: country }, { data: opportunities }, { data: trades }] = await Promise.all([
    admin.from('countries').select('*').eq('id', targetIso).single(),
    admin.from('opportunities').select('*, products(name, category)').eq('country_iso', targetIso).order('opportunity_score', { ascending: false }).limit(20),
    admin.from('trade_flows').select('product_id, value_usd, flow, products(name, category)').eq('reporter_iso', targetIso).order('value_usd', { ascending: false }).limit(50),
  ])

  if (!country) return NextResponse.json({ error: 'Country not found' }, { status: 404 })

  // Build prompt (inline simplified version)
  const imports = (trades ?? []).filter((t: any) => t.flow === 'import').map((t: any) => ({ name: Array.isArray(t.products) ? t.products[0]?.name : t.products?.name ?? t.product_id, category: Array.isArray(t.products) ? t.products[0]?.category : t.products?.category ?? 'unknown', value_usd: t.value_usd }))
  const flatOpps = (opportunities ?? []).map((o: any) => ({ ...o, products: Array.isArray(o.products) ? o.products[0] : o.products }))

  // Use the study API endpoint logic
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3002'}/api/studies/${targetIso}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': '' },
    body: JSON.stringify({ part: targetPart, _cronSecret: process.env.CRON_SECRET }),
  })

  // If fetch to self doesn't work (no auth), generate directly
  if (!res.ok) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { maxOutputTokens: 8192 } })
      const prompt = buildStudyPromptDirect(targetPart, country, flatOpps, imports)
      const result = await model.generateContent(prompt)
      let html = result.response.text()
      const match = html.match(/```html\s*([\s\S]*?)```/)
      if (match) html = match[1]
      html = html.replace(/^```\w*\s*/, '').replace(/```$/, '').trim()

      const tierMap: Record<number, string> = { 1: 'free', 2: 'basic', 3: 'standard' }
      await admin.from('country_studies').upsert({
        country_iso: targetIso, part: targetPart, content_html: html,
        tier_required: tierMap[targetPart], updated_at: new Date().toISOString(),
      }, { onConflict: 'country_iso,part' })

      return NextResponse.json({ iso: targetIso, part: targetPart, chars: html.length, done: false })
    } catch (err: any) {
      return NextResponse.json({ error: err.message, iso: targetIso, part: targetPart }, { status: 500 })
    }
  }

  return NextResponse.json({ iso: targetIso, part: targetPart, done: false })
}

function buildStudyPromptDirect(part: number, country: any, opps: any[], imports: any[]): string {
  const ctx = `Pays: ${country.name_fr} (${country.id}). Pop: ${country.population ? (country.population / 1e6).toFixed(1) + 'M' : 'N/A'}. PIB: ${country.gdp_usd ? '$' + (country.gdp_usd / 1e9).toFixed(1) + 'B' : 'N/A'}. Imports: ${country.total_imports_usd ? '$' + (country.total_imports_usd / 1e9).toFixed(1) + 'B' : 'N/A'}.`
  const importsStr = imports.slice(0, 15).map((i: any) => `${i.name}: $${((i.value_usd ?? 0) / 1e6).toFixed(1)}M`).join(', ')
  const oppsStr = opps.slice(0, 10).map((o: any) => `${o.products?.name ?? '?'} (score ${o.opportunity_score})`).join(', ')

  const partTitles: Record<number, string> = {
    1: 'PARTIE 1: Ressources et marché local — analyse macro, ressources naturelles, imports/exports détaillés, infrastructure (3000+ mots)',
    2: 'PARTIE 2: Analyse business — produits en tension, 3 modes (import & sell, produce locally, train locals), réglementation (3500+ mots)',
    3: 'PARTIE 3: Acteurs locaux — importateurs, transformateurs, grossistes, distributeurs, acteurs publics classés par CA (4000+ mots)',
  }

  return `Expert en commerce international. Rédige une étude de marché exhaustive en HTML.
${ctx} Imports: ${importsStr}. Opportunités: ${oppsStr}.
${partTitles[part]}
Formate en HTML (<h2>, <h3>, <p>, <ul>, <table>, <strong>). Sois exhaustif et factuel.`
}
