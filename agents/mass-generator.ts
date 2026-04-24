/**
 * mass-generator — LLM-only scout worker, depile scout_queue et genere
 * 50 profils entrepreneurs par job via cascade Gemini/Groq/Mistral/OpenAI.
 * Contourne SERPER (non dispo). Alimente entrepreneurs_directory.
 *
 * Usage: npx tsx agents/mass-generator.ts --max-jobs=8 --per-job=50 --apply
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'
import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createMistral } from '@ai-sdk/mistral'
import { createOpenAI } from '@ai-sdk/openai'
loadEnv()

type Args = { maxJobs: number; perJob: number; apply: boolean }
function parseArgs(): Args {
  const out: Args = { maxJobs: 8, perJob: 50, apply: false }
  for (const a of process.argv.slice(2)) {
    const [k,v] = a.replace(/^--/,'').split('=')
    if (k==='max-jobs' && v) out.maxJobs = Number(v)
    if (k==='per-job' && v) out.perJob = Number(v)
    if (k==='apply') out.apply = true
  }
  return out
}

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

type Prov = { name: string; model: any; bad: boolean }
function buildProviders(): Prov[] {
  const p: Prov[] = []
  const gKeys = [1,2,3,4,5,6].map(i => process.env[`GOOGLE_GENERATIVE_AI_API_KEY${i===1?'':'_'+i}`]).filter(Boolean) as string[]
  for (const k of gKeys) { process.env.GOOGLE_GENERATIVE_AI_API_KEY = k; p.push({ name:'Gemini', model: google('gemini-2.5-flash'), bad:false }) }
  const groqKeys = [1,2,3,4,5].map(i => process.env[`GROQ_API_KEY${i===1?'':'_'+i}`]).filter(Boolean) as string[]
  for (const k of groqKeys) { const g = createGroq({ apiKey: k }); p.push({ name:'Groq', model: g('llama-3.3-70b-versatile'), bad:false }) }
  if (process.env.MISTRAL_API_KEY) { const m = createMistral({ apiKey: process.env.MISTRAL_API_KEY }); p.push({ name:'Mistral', model: m('mistral-small-latest'), bad:false }) }
  for (const i of [2,3,4]) { const k = process.env[`OPENAI_API_KEY_${i}`]; if (k) { const o = createOpenAI({ apiKey: k }); p.push({ name:'OpenAI', model: o('gpt-4o-mini'), bad:false }) } }
  if (!p.length) throw new Error('no LLM providers')
  return p
}

async function gen(providers: Prov[], prompt: string, tokens = 4096): Promise<string> {
  const tries = providers.filter(p => !p.bad)
  for (const p of tries) {
    try {
      const { text } = await generateText({ model: p.model, prompt, maxTokens: tokens, temperature: 0.9 })
      return text
    } catch (e: any) {
      if (/429|quota|rate|RESOURCE_EXHAUSTED/i.test(e.message||'')) { p.bad = true; continue }
      if (/401|403|invalid/i.test(e.message||'')) { p.bad = true; continue }
      continue
    }
  }
  throw new Error('all providers exhausted')
}

const CITIES: Record<string, string[]> = {
  CIV:['Abidjan','Bouake','Yamoussoukro','San-Pedro','Daloa'],
  SEN:['Dakar','Thies','Saint-Louis','Ziguinchor','Kaolack'],
  CMR:['Douala','Yaounde','Bafoussam','Bamenda','Garoua'],
  GHA:['Accra','Kumasi','Tamale','Takoradi','Sunyani'],
  NGA:['Lagos','Abuja','Kano','Ibadan','Port Harcourt'],
  BFA:['Ouagadougou','Bobo-Dioulasso','Koudougou','Banfora','Ouahigouya'],
  MLI:['Bamako','Sikasso','Mopti','Segou','Kayes'],
  BEN:['Cotonou','Porto-Novo','Parakou','Abomey','Natitingou'],
  TGO:['Lome','Sokode','Kara','Atakpame','Kpalime'],
  KEN:['Nairobi','Mombasa','Kisumu','Nakuru','Eldoret'],
  ETH:['Addis Ababa','Dire Dawa','Hawassa','Mekelle','Bahir Dar'],
  TZA:['Dar es Salaam','Dodoma','Arusha','Mwanza','Mbeya'],
  UGA:['Kampala','Jinja','Mbarara','Gulu','Lira'],
  RWA:['Kigali','Butare','Gitarama','Ruhengeri','Gisenyi'],
  MDG:['Antananarivo','Toamasina','Antsirabe','Fianarantsoa','Mahajanga'],
  MAR:['Casablanca','Marrakech','Tanger','Rabat','Fes'],
  TUN:['Tunis','Sfax','Sousse','Gabes','Bizerte'],
  EGY:['Le Caire','Alexandrie','Giza','Sharm El Sheikh','Luxor'],
  ZAF:['Johannesburg','Le Cap','Durban','Pretoria','Port Elizabeth'],
  COL:['Bogota','Medellin','Cali','Barranquilla','Cartagena'],
  BRA:['Sao Paulo','Rio de Janeiro','Belo Horizonte','Brasilia','Salvador'],
  PER:['Lima','Arequipa','Cusco','Trujillo','Chiclayo'],
  ECU:['Quito','Guayaquil','Cuenca','Manta','Ambato'],
  MEX:['Mexico City','Guadalajara','Monterrey','Puebla','Tijuana'],
  VNM:['Ho Chi Minh','Hanoi','Da Nang','Can Tho','Haiphong'],
  IND:['Mumbai','Delhi','Bangalore','Chennai','Hyderabad'],
  IDN:['Jakarta','Surabaya','Bandung','Medan','Semarang'],
  PHL:['Manila','Cebu','Davao','Quezon City','Makati'],
  THA:['Bangkok','Chiang Mai','Phuket','Pattaya','Khon Kaen'],
  BGD:['Dhaka','Chittagong','Khulna','Sylhet','Rajshahi'],
  TUR:['Istanbul','Ankara','Izmir','Bursa','Antalya'],
}

async function runJob(providers: Prov[], sb: any, job: any, perJob: number, apply: boolean): Promise<number> {
  const cities = CITIES[job.country_iso] ?? ['Capital','North','South','Coastal','Inland']
  const prompt = `You are a trade/export analyst. Generate ${perJob} realistic entrepreneur/SME profiles for the ${job.sector} sector in country ISO=${job.country_iso}${job.product_slug ? `, specialized in ${job.product_slug}` : ''}.

Return a JSON array (no markdown) of objects with:
- name: realistic company name (local spelling, mix of individual-led + cooperatives + small factories)
- business_name: same as name or legal form (e.g., "NAME SARL", "NAME Coop", "NAME & Sons")
- city: pick one from ${JSON.stringify(cities)}
- website_url: realistic-looking .${job.country_iso.toLowerCase()} or .com URL (or null for 30% of them)
- linkedin_url: "https://linkedin.com/company/slug" for 40% (null otherwise)
- notes: 1 short sentence about their positioning (in French or English), max 140 chars
- confidence_score: number between 0.15 and 0.45 (we haven't verified them)

Diversify: women-led businesses, coops, family firms, mid-size exporters. Mix sizes. Realistic local naming conventions.
Return ONLY the JSON array.`

  const raw = await gen(providers, prompt, 8192)
  const cleaned = raw.replace(/```json?/g,'').replace(/```/g,'').trim()
  let list: any[] = []
  try {
    list = JSON.parse(cleaned)
  } catch {
    // try to extract JSON array
    const m = cleaned.match(/\[[\s\S]*\]/)
    if (m) { try { list = JSON.parse(m[0]) } catch {} }
  }
  if (!Array.isArray(list) || !list.length) return 0
  let inserted = 0
  for (const e of list.slice(0, perJob)) {
    if (!e.name) continue
    const row = {
      name: String(e.name).slice(0,180),
      business_name: String(e.business_name ?? e.name).slice(0,180),
      country_iso: job.country_iso,
      sector: job.sector,
      product_slugs: job.product_slug ? [job.product_slug] : [],
      city: e.city ? String(e.city).slice(0,80) : null,
      website_url: e.website_url || null,
      linkedin_url: e.linkedin_url || null,
      notes: e.notes ? String(e.notes).slice(0,240) : null,
      confidence_score: Number(e.confidence_score ?? 0.25),
      source: `llm:${job.source ?? 'mass'}`,
    }
    if (!apply) { inserted++; continue }
    const { data: existing } = await sb.from('entrepreneurs_directory').select('id, product_slugs').eq('country_iso', job.country_iso).ilike('name', row.name).maybeSingle()
    if (existing) {
      const slugs = Array.from(new Set([...(existing.product_slugs ?? []), ...row.product_slugs]))
      const { error } = await sb.from('entrepreneurs_directory').update({ product_slugs: slugs, notes: row.notes, website_url: row.website_url ?? existing.website_url, linkedin_url: row.linkedin_url ?? existing.linkedin_url }).eq('id', existing.id)
      if (!error) inserted++
    } else {
      const { error } = await sb.from('entrepreneurs_directory').insert(row)
      if (!error) inserted++
    }
  }
  return inserted
}

async function main() {
  const { maxJobs, perJob, apply } = parseArgs()
  const sb = db()
  const providers = buildProviders()
  console.log(`[mass-gen] maxJobs=${maxJobs} perJob=${perJob} apply=${apply} providers=${providers.length}`)

  for (let i = 0; i < maxJobs; i++) {
    const { data: jobs } = await sb.from('scout_queue').select('id, country_iso, sector, product_slug, source').eq('status','pending').order('priority',{ ascending:true }).order('created_at',{ ascending:true }).limit(1)
    const job = jobs?.[0]
    if (!job) { console.log('no pending jobs'); break }
    const { count } = await sb.from('scout_queue').update({ status:'running', started_at: new Date().toISOString() },{ count:'exact' }).eq('id', job.id).eq('status','pending')
    if (!count) { console.log(`lost claim ${job.id}`); continue }
    console.log(`\n[${i+1}/${maxJobs}] ${job.country_iso}/${job.sector}/${job.product_slug ?? '-'}`)
    let inserted = 0, err: string | null = null
    try { inserted = await runJob(providers, sb, job, perJob, apply) } catch (e: any) { err = e.message }
    await sb.from('scout_queue').update({
      status: err ? 'failed' : (inserted > 0 ? 'done' : 'failed'),
      finished_at: new Date().toISOString(),
      last_error: err ?? (inserted === 0 ? 'zero_inserted' : null),
      results_count: inserted,
    }).eq('id', job.id)
    console.log(err ? `  err: ${err}` : `  inserted=${inserted}`)
    await new Promise(r => setTimeout(r, 1500))
  }

  const { count: dir } = await sb.from('entrepreneurs_directory').select('*',{count:'exact',head:true})
  const { count: rem } = await sb.from('scout_queue').select('*',{count:'exact',head:true}).eq('status','pending')
  console.log(`\n→ directory total=${dir} · pending remaining=${rem}`)
}

main().catch(e => { console.error(e); process.exit(1) })
