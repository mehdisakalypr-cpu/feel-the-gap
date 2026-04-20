/**
 * FTG Ad Factory — seed scenario "Aïssata — L'Oignon" (45s, 4 segments).
 *
 * Exécute :
 *   npx tsx scripts/seed-ad-oignon.ts            # seeds project + FR variant
 *   npx tsx scripts/seed-ad-oignon.ts --langs fr,en,de,es,ar,pt,zh,sw
 *
 * Ne lance pas le rendu (utiliser /admin/ad-factory/studio/[id] → Render).
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SRK) { console.error('Missing Supabase env'); process.exit(1) }

const sb = createClient(SUPABASE_URL, SUPABASE_SRK, { auth: { persistSession: false } })

const BRIEF = {
  total_duration_s: 45,
  aspect_ratio: '16:9' as const,
  segments: [
    {
      index: 1,
      kind: 'heygen-dialogue' as const,
      duration_s: 12,
      prompt: 'Market scene Cocody Abidjan, soft sunlight, background brouhaha. Two women discussing onion prices at a vendor stall. Warm intimate documentary style.',
      dialogue: [
        { speaker: 'FATOU', line: 'Tu as vu le prix des oignons ? C\'est devenu du luxe.', timing: '00:00-00:03' },
        { speaker: 'AISSATA', line: 'C\'est parce que la Côte d\'Ivoire les importe. Pourtant, moi, je sais les cultiver.', timing: '00:03-00:06' },
        { speaker: 'FATOU', line: 'Mais lance-toi alors ! Tu seras moins chère, tu auras plein de clients !', timing: '00:06-00:09' },
        { speaker: 'AISSATA', line: 'J\'en ai envie… mais il faudrait que je sache par où commencer.', timing: '00:09-00:12' },
      ],
    },
    {
      index: 2,
      kind: 'seedance-i2v' as const,
      duration_s: 15,
      prompt: 'Aissata alone at night, sitting at a wooden table, tablet screen is hero shot. 5 UI reveals in fast smart cuts: (1) world map with Côte d\'Ivoire highlighted in gold, headline "OIGNON · GAP IMPORT $47M/AN · DEMANDE LOCALE FORTE", speed ramp on the number; (2) 3 method cards Artisanal/Mécanisé/IA, she taps "Mécanisé"; (3) business plan screen "€68K revenus Y1 · marge 38% · payback 12 mois" with live curves; (4) 12-month action timeline + popup "Microfinance CIV · €15K pré-approuvé"; (5) 47 local buyers matched + website "Ferme Aissata" builds itself in 3s. Warm night-light tones, close-up tablet POV.',
      reference_urls: ['@image1'],
    },
    {
      index: 3,
      kind: 'seedance-t2v' as const,
      duration_s: 11,
      prompt: 'Slow crane up over onion fields in golden hour (4s): Aissata stands proud, raises a bunch of red onions, workers laughing around her. Fast smart cuts (4s): truck branded "FERME AISSATA" pulls away, bags delivered to Abidjan grocery shelf, market stall customer pays, high-end restaurant kitchen receiving. Port sequence (3s): boxes stamped "FERME AISSATA · EXPORT" (no country mentioned) loaded onto cargo ship. Cinematic, warm African light, naturalistic, hopeful tone.',
    },
    {
      index: 4,
      kind: 'ffmpeg-text' as const,
      duration_s: 7,
      prompt: 'Black background #07090F. Gold typography #C9A84C. Frame 38-40s: "FEEL THE GAP / Sentez l\'opportunité". Frame 40-42s: liquid-letter morph FEEL → FILL, subtitle morph Sentez → Saisissez. Frame 42-45s: "FILL THE GAP / Saisissez l\'opportunité" + logo + feel-the-gap.com',
    },
  ],
}

const VO_FR = {
  seg1: '', // HeyGen dialogue déjà scripté
  seg2: 'Feel The Gap lui a tout montré. Le marché qui manquait. Comment produire. Combien investir, combien gagner, et quand. Son financement, ses clients, son site. Tout.',
  seg3: 'Six mois plus tard. Le marché local absorbe sa production. C\'est rentable. Et les premiers clients internationaux commandent déjà.',
  seg4: 'Feel The Gap. Fill The Gap.',
}

const VO_EN = {
  seg1: '',
  seg2: 'Feel The Gap showed her everything. The missing market. How to produce. How much to invest, how much to earn, and when. Her funding, her buyers, her website. Everything.',
  seg3: 'Six months later. The local market absorbs her production. It\'s profitable. And the first international buyers are already placing orders.',
  seg4: 'Feel The Gap. Fill The Gap.',
}

const VO_ES = {
  seg1: '',
  seg2: 'Feel The Gap se lo mostró todo. El mercado que faltaba. Cómo producir. Cuánto invertir, cuánto ganar, y cuándo. Su financiación, sus clientes, su sitio web. Todo.',
  seg3: 'Seis meses después. El mercado local absorbe su producción. Es rentable. Y los primeros clientes internacionales ya están haciendo pedidos.',
  seg4: 'Feel The Gap. Fill The Gap.',
}

const VO_AR = {
  seg1: '',
  seg2: 'أرَت‌ها "فيل ذا غاب" كل شيء. السوق المفقود. كيفية الإنتاج. كم تستثمر، كم تربح، ومتى. تمويلها، زبائنها، موقعها الإلكتروني. كل شيء.',
  seg3: 'بعد ستة أشهر. السوق المحلي يستوعب إنتاجها. إنه مربح. وأول الزبائن الدوليين يطلبون بالفعل.',
  seg4: 'فيل ذا غاب. فيل ذا غاب.',
}

const VO_PT = {
  seg1: '',
  seg2: 'Feel The Gap mostrou-lhe tudo. O mercado que faltava. Como produzir. Quanto investir, quanto ganhar, e quando. O seu financiamento, os seus clientes, o seu site. Tudo.',
  seg3: 'Seis meses depois. O mercado local absorve a sua produção. É rentável. E os primeiros clientes internacionais já estão a fazer encomendas.',
  seg4: 'Feel The Gap. Fill The Gap.',
}

const VO_DE = {
  seg1: '',
  seg2: 'Feel The Gap zeigte ihr alles. Den fehlenden Markt. Wie man produziert. Wie viel investieren, wie viel verdienen, und wann. Ihre Finanzierung, ihre Kunden, ihre Website. Alles.',
  seg3: 'Sechs Monate später. Der lokale Markt absorbiert ihre Produktion. Es ist rentabel. Und die ersten internationalen Kunden bestellen bereits.',
  seg4: 'Feel The Gap. Fill The Gap.',
}

const VO_MAP: Record<string, Record<string, string>> = {
  fr: VO_FR, en: VO_EN, de: VO_DE, es: VO_ES, ar: VO_AR, pt: VO_PT,
}

async function main() {
  const argvLangs = (process.argv.find(a => a.startsWith('--langs='))?.split('=')[1]
    ?? (process.argv[process.argv.indexOf('--langs') + 1] ?? ''))
    .split(',')
    .filter(Boolean)
  const langs = argvLangs.length ? argvLangs : ['fr']

  // Upsert project by name
  const projectName = 'Ad Oignon CIV — Aïssata (v2)'
  const { data: existing } = await sb
    .from('ftg_ad_projects')
    .select('id, name')
    .eq('name', projectName)
    .maybeSingle()

  let projectId: string
  if (existing) {
    projectId = existing.id
    await sb.from('ftg_ad_projects').update({
      brief: BRIEF, status: 'ready', updated_at: new Date().toISOString(),
    }).eq('id', projectId)
    console.log(`[seed] project exists, brief updated — id=${projectId}`)
  } else {
    const { data, error } = await sb
      .from('ftg_ad_projects')
      .insert({
        name: projectName,
        description: 'Ad FTG 45s. Scénario substitution import oignons Côte d\'Ivoire. Arc employée → entrepreneure. Wordplay Feel → Fill.',
        brief: BRIEF,
        status: 'ready',
      })
      .select('id')
      .single()
    if (error) { console.error('[seed] project insert failed', error.message); process.exit(1) }
    projectId = data.id
    console.log(`[seed] project created — id=${projectId}`)
  }

  // Upsert variants
  for (const lang of langs) {
    const vo = VO_MAP[lang] ?? VO_EN // fallback EN
    const { data: existingVar } = await sb
      .from('ftg_ad_variants')
      .select('id')
      .eq('project_id', projectId)
      .eq('lang', lang)
      .maybeSingle()
    if (existingVar) {
      await sb.from('ftg_ad_variants').update({
        vo_script: vo,
        hero_name: 'Aïssata',
        product: 'Oignon',
        country_iso: 'CIV',
      }).eq('id', existingVar.id)
      console.log(`[seed] variant ${lang} updated — id=${existingVar.id}`)
    } else {
      const { data, error } = await sb
        .from('ftg_ad_variants')
        .insert({
          project_id: projectId,
          lang,
          vo_script: vo,
          hero_name: 'Aïssata',
          product: 'Oignon',
          country_iso: 'CIV',
        })
        .select('id')
        .single()
      if (error) { console.error(`[seed] variant ${lang} insert failed`, error.message); continue }
      console.log(`[seed] variant ${lang} created — id=${data.id}`)
    }
  }

  console.log(`\n[seed] done.\n→ Studio: /admin/ad-factory/studio/${projectId}`)
  console.log(`→ Variants créés pour langues: ${langs.join(', ')}`)
  console.log('→ Lancer le rendu via UI (bouton "Run") ou POST /api/admin/ad-factory/render')
}

main().catch(err => { console.error(err); process.exit(1) })
