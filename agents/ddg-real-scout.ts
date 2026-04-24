/**
 * ddg-real-scout — scout REEL via DuckDuckGo HTML search (pas d'API key requise).
 * Extrait company names + websites reels depuis pages d'annuaires / chambres
 * de commerce / associations professionnelles pour un pays x produit donne.
 * Complemente le LLM mass-generator (synthetique) avec des entites verifiees.
 *
 * Usage: npx tsx agents/ddg-real-scout.ts --country=CIV --sector=agriculture --product=cacao --max=30 --apply
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'
loadEnv()

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k,v]=a.replace(/^--/,'').split('='); return [k, v ?? 'true'] }))
const COUNTRY = String(args.country ?? '').toUpperCase()
const SECTOR  = String(args.sector  ?? '').toLowerCase()
const PRODUCT = String(args.product ?? '').toLowerCase()
const MAX     = Number(args.max ?? 30)
const APPLY   = args.apply === 'true'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function ddgSearch(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!r.ok) return []
    const html = await r.text()
    const results: { title: string; url: string; snippet: string }[] = []
    const resultRe = /<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([^<]*)<\/a>/g
    let m: RegExpExecArray | null
    while ((m = resultRe.exec(html)) && results.length < 15) {
      let u = m[1]
      // DDG sometimes wraps urls in /l/?uddg=... — extract real url
      if (u.startsWith('/l/?') || u.includes('uddg=')) {
        const qs = u.split('?')[1]
        const p = new URLSearchParams(qs)
        const real = p.get('uddg')
        if (real) u = decodeURIComponent(real)
      }
      const title = m[2].replace(/<[^>]+>/g,'').trim()
      const snippet = m[3].replace(/<[^>]+>/g,'').trim()
      results.push({ title, url: u, snippet })
    }
    return results
  } catch (e: any) {
    console.error('[ddg] err', e.message)
    return []
  }
}

async function main() {
  if (!COUNTRY || !SECTOR) { console.error('usage --country=CIV --sector=agriculture [--product=cacao]'); process.exit(1) }
  const sb = db()

  const queries = [
    `"${PRODUCT || SECTOR}" exporters ${COUNTRY} directory`,
    `${PRODUCT || SECTOR} producers ${COUNTRY} association`,
    `chamber commerce ${COUNTRY} ${PRODUCT || SECTOR} members`,
    `${COUNTRY} ${PRODUCT || SECTOR} cooperative listing`,
    `"${PRODUCT || SECTOR}" SME ${COUNTRY} company`,
  ]

  const collected: { name: string; url: string; snippet: string }[] = []
  const seen = new Set<string>()
  for (const q of queries) {
    const rs = await ddgSearch(q)
    for (const r of rs) {
      let host = ''
      try { host = new URL(r.url).hostname.replace(/^www\./,'') } catch {}
      if (!host || /^(wikipedia|youtube|facebook|twitter|linkedin|pinterest|reddit|quora|medium)\./.test(host)) continue
      if (/\.(pdf|doc|xls)/.test(r.url)) continue
      const name = r.title.split(/[|·–—-]/)[0].trim().slice(0, 120)
      if (!name || name.length < 3) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      collected.push({ name, url: r.url, snippet: r.snippet })
      if (collected.length >= MAX) break
    }
    if (collected.length >= MAX) break
    await new Promise(r => setTimeout(r, 800))
  }

  console.log(`[ddg-real-scout] ${COUNTRY}/${SECTOR}/${PRODUCT || '-'} collected=${collected.length}`)

  let inserted = 0
  if (APPLY) {
    for (const c of collected) {
      const row = {
        name: c.name,
        business_name: c.name,
        country_iso: COUNTRY,
        sector: SECTOR,
        product_slugs: PRODUCT ? [PRODUCT] : [],
        website_url: c.url,
        notes: c.snippet.slice(0, 240),
        confidence_score: 0.45,
        source: 'ddg:real',
      }
      const { data: existing } = await sb.from('entrepreneurs_directory').select('id').eq('country_iso', COUNTRY).ilike('name', c.name).maybeSingle()
      if (existing) {
        const { error } = await sb.from('entrepreneurs_directory').update({ website_url: row.website_url, notes: row.notes, confidence_score: row.confidence_score, source: row.source }).eq('id', existing.id)
        if (!error) inserted++
      } else {
        const { error } = await sb.from('entrepreneurs_directory').insert(row)
        if (!error) inserted++
      }
    }
  }
  console.log(`[ddg-real-scout] inserted/updated=${inserted}`)
  // Sample first 5 for visibility
  for (const c of collected.slice(0, 5)) console.log(`  · ${c.name.slice(0,60)}  ${c.url.slice(0,60)}`)
}

main().catch(e => { console.error(e); process.exit(1) })
