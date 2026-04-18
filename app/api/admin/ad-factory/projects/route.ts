import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

/** Brief de base 4 segments scénario "L'Oignon" — pré-rempli pour guider. */
const BRIEF_TEMPLATE = {
  aspect_ratio: '9:16',
  total_duration_s: 45,
  segments: [
    {
      index: 1, kind: 'heygen-dialogue', duration_s: 12,
      prompt: 'Marché Cocody Abidjan, 2 femmes discutent devant étalage oignons',
      dialogue: [
        { speaker: 'Fatou', line: 'Tu as vu le prix des oignons ? C\'est devenu du luxe.', timing: '0-3s' },
        { speaker: 'Aïssata', line: 'C\'est parce que la Côte d\'Ivoire les importe. Pourtant, moi, je sais les cultiver.', timing: '3-6s' },
        { speaker: 'Fatou', line: 'Mais lance-toi alors ! Tu seras moins chère, tu auras plein de clients !', timing: '6-9s' },
        { speaker: 'Aïssata', line: 'J\'en ai envie… mais il faudrait que je sache par où commencer.', timing: '9-12s' },
      ],
    },
    {
      index: 2, kind: 'seedance-i2v', duration_s: 15,
      prompt: 'Tablette FTG UI (dark, accent or #C9A84C), 5 étapes Smart Cuts : carte mondiale CIV highlightée GAP $47M oignons, méthodes production, business plan 3 scénarios, timeline 12 mois + financement, clients locaux + site e-commerce',
      reference_urls: [],
    },
    {
      index: 3, kind: 'seedance-t2v', duration_s: 11,
      prompt: 'Aïssata dans champ d\'oignons CIV, récolte + camions livraison Abidjan, port export cargo, Smart Cuts, cinematic 35mm golden hour',
    },
    {
      index: 4, kind: 'ffmpeg-text', duration_s: 7,
      prompt: 'Wordplay FEEL THE GAP → FILL THE GAP avec sous-titre Sentez→Saisissez, morphing liquid letters, fond noir #07090F, typographie or #C9A84C',
    },
  ],
}

export async function GET() {
  const sb = admin()
  const { data, error } = await sb
    .from('ftg_ad_projects')
    .select('id, name, description, status, image_refs, drive_folder_url, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Comptes variants + jobs par projet
  const ids = (data ?? []).map(p => p.id)
  let stats: Record<string, { variants: number; jobs: number }> = {}
  if (ids.length > 0) {
    const { data: vs } = await sb.from('ftg_ad_variants').select('project_id').in('project_id', ids)
    for (const v of vs ?? []) {
      stats[v.project_id] = stats[v.project_id] ?? { variants: 0, jobs: 0 }
      stats[v.project_id].variants++
    }
  }

  return NextResponse.json({ ok: true, projects: data ?? [], stats })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? '').trim().slice(0, 120)
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const brief = body.brief && typeof body.brief === 'object' ? body.brief : BRIEF_TEMPLATE

  const { data, error } = await admin().from('ftg_ad_projects').insert({
    name,
    description: body.description ?? null,
    drive_folder_url: body.drive_folder_url ?? null,
    brief,
    image_refs: body.image_refs ?? [],
  }).select('id, name, brief, status').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, project: data })
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await admin().from('ftg_ad_projects').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
