import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

/**
 * POST /api/admin/ad-factory/variants/fork
 * Body: { project_id, matrix: { langs:[], avatars:[], products:[], countries:[], seasons:[] } }
 * Génère le produit cartésien de variants (n_langs × n_avatars × n_products × n_countries × n_seasons)
 * → insert batch dans ftg_ad_variants.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const projectId = body.project_id
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const langs: string[] = Array.isArray(body.matrix?.langs) ? body.matrix.langs : ['fr']
  const avatars: Array<string[]> = Array.isArray(body.matrix?.avatars)
    ? body.matrix.avatars.map((a: unknown) => Array.isArray(a) ? a : [a])
    : [[]]
  const products: string[] = Array.isArray(body.matrix?.products) ? body.matrix.products : ['']
  const countries: string[] = Array.isArray(body.matrix?.countries) ? body.matrix.countries : ['']
  const seasons: string[] = Array.isArray(body.matrix?.seasons) ? body.matrix.seasons : ['']

  const rows: Record<string, unknown>[] = []
  for (const lang of langs) {
    for (const avList of avatars) {
      for (const product of products) {
        for (const country of countries) {
          for (const season of seasons) {
            rows.push({
              project_id: projectId,
              lang,
              avatar_ids: avList,
              product: product || null,
              country_iso: country || null,
              vo_script: { _season: season || null },
              hero_name: null,
            })
          }
        }
      }
    }
  }

  if (rows.length === 0) return NextResponse.json({ ok: true, created: 0 })
  if (rows.length > 500) return NextResponse.json({ error: 'max 500 variants per fork' }, { status: 400 })

  const { data, error } = await admin().from('ftg_ad_variants').insert(rows).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, created: data?.length ?? 0, variant_ids: (data ?? []).map(r => r.id) })
}
