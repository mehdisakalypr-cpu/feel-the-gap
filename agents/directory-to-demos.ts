/**
 * directory-to-demos — promeut entrepreneurs_directory en entrepreneur_demos.
 * Genere hero_message personnalise + business_plan skeleton + token public.
 * Permet au outreach-engine d'avoir un pool de prospects pret a contacter
 * (meme sans email, le WhatsApp / LinkedIn peuvent servir).
 *
 * Usage: npx tsx agents/directory-to-demos.ts --max=100 --apply
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'
import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createMistral } from '@ai-sdk/mistral'
import { createOpenAI } from '@ai-sdk/openai'
loadEnv()

const MAX = Number((process.argv.find(a => a.startsWith('--max='))?.split('=')[1]) ?? 100)
const APPLY = process.argv.includes('--apply')

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

type Prov = { name: string; model: any; bad: boolean }
function buildProviders(): Prov[] {
  const p: Prov[] = []
  const gKeys = [1,2,3,4,5,6].map(i => process.env[`GOOGLE_GENERATIVE_AI_API_KEY${i===1?'':'_'+i}`]).filter(Boolean) as string[]
  for (const k of gKeys) { process.env.GOOGLE_GENERATIVE_AI_API_KEY = k; p.push({ name:'Gemini', model: google('gemini-2.5-flash'), bad:false }) }
  const groqKeys = [1,2,3,4,5].map(i => process.env[`GROQ_API_KEY${i===1?'':'_'+i}`]).filter(Boolean) as string[]
  for (const k of groqKeys) { const g = createGroq({ apiKey: k }); p.push({ name:'Groq', model: g('llama-3.3-70b-versatile'), bad:false }) }
  if (process.env.MISTRAL_API_KEY) { const m = createMistral({ apiKey: process.env.MISTRAL_API_KEY }); p.push({ name:'Mistral', model: m('mistral-small-latest'), bad:false }) }
  for (const i of [2,3,4]) { const k = process.env[`OPENAI_API_KEY_${i}`]; if (k) { const o = createOpenAI({ apiKey: k }); p.push({ name:'OpenAI', model: o('gpt-4o-mini'), bad:false }) } }
  return p
}

async function gen(providers: Prov[], prompt: string, tokens = 2048): Promise<string> {
  for (const p of providers.filter(x => !x.bad)) {
    try {
      const { text } = await generateText({ model: p.model, prompt, maxTokens: tokens, temperature: 0.8 })
      return text
    } catch (e: any) {
      if (/429|quota|rate|RESOURCE_EXHAUSTED|401|403|invalid/i.test(e.message ?? '')) { p.bad = true; continue }
      continue
    }
  }
  throw new Error('all providers exhausted')
}

function token12(): string {
  const c = 'abcdefghijkmnpqrstuvwxyz23456789'
  let s = ''
  for (let i=0;i<12;i++) s += c[Math.floor(Math.random()*c.length)]
  return s
}

async function main() {
  const sb = db()
  const providers = buildProviders()
  console.log(`[dir-to-demos] providers=${providers.length} max=${MAX} apply=${APPLY}`)

  // Pick directory rows NOT yet in demos
  const { data: dir } = await sb.from('entrepreneurs_directory')
    .select('id, name, business_name, country_iso, sector, product_slugs, city, website_url, linkedin_url, notes')
    .order('created_at', { ascending: false })
    .limit(MAX * 3)

  if (!dir?.length) { console.log('no directory rows'); return }

  // Filter out those already promoted
  const names = dir.map(d => String(d.name))
  const { data: existing } = await sb.from('entrepreneur_demos').select('full_name').in('full_name', names)
  const existingSet = new Set((existing ?? []).map((e: any) => String(e.full_name)))
  const queue = dir.filter(d => !existingSet.has(String(d.name))).slice(0, MAX)

  console.log(`[dir-to-demos] ${dir.length} directory rows -> ${queue.length} promotion candidates`)

  let promoted = 0
  for (const r of queue) {
    const product = (r.product_slugs as string[] | null)?.[0] ?? null
    const prompt = `Ecris un hero_message personnalise (francais, max 140 caracteres, percutant, sans emoji) pour un email de prospection FTG envoye a un entrepreneur ${r.sector ?? 'trade'} base en ${r.country_iso ?? ''}${r.city ? ' ('+r.city+')' : ''}, specialise dans ${product ?? 'export'}. Message doit evoquer gain concret (ouverture marche export, matching acheteur international, acces data marche). Ecris juste le message, sans guillemets ni markup.`
    let hero: string
    try {
      hero = (await gen(providers, prompt, 200)).trim().replace(/^["']|["']$/g, '').slice(0, 200)
    } catch (e: any) {
      hero = `Nouveau marche export pour ${product ?? r.sector ?? 'votre activite'} — ouvrez 3 corridors en 30 jours avec Feel The Gap.`
    }

    const demo = {
      token: token12(),
      full_name: String(r.name),
      company_name: String(r.business_name ?? r.name),
      linkedin_url: r.linkedin_url ?? null,
      country_iso: r.country_iso ?? null,
      city: r.city ?? null,
      sector: r.sector ?? null,
      product_focus: r.product_slugs ?? [],
      hero_message: hero,
      business_plan: {
        executive_summary: `${r.name} en ${r.country_iso ?? 'region'} peut activer un corridor export ${product ?? 'produit'} vers EU/US avec financement facilite et matching acheteurs via Feel The Gap.`,
        market_size: `Marche ${r.sector ?? 'trade'} ${r.country_iso ?? ''}`,
        scenarios: [],
      },
      opportunities: [],
      investors: [],
      market_data: { source: 'directory_bridge' },
      status: 'generated',
      source: 'directory_bridge',
      source_detail: r.website_url ? `site:${r.website_url}` : (r.linkedin_url ? 'linkedin' : 'llm_scout'),
    }
    if (!APPLY) { promoted++; continue }
    const { error } = await sb.from('entrepreneur_demos').insert(demo)
    if (!error) promoted++
  }
  const { count: total } = await sb.from('entrepreneur_demos').select('*', { count:'exact', head:true })
  console.log(`[dir-to-demos] promoted=${promoted} total_demos=${total}`)
}

main().catch(e => { console.error(e); process.exit(1) })
