/**
 * POST /api/funding/dossier/init
 * Instancie un funding_dossiers type='investissement' avec la structure DD v1.
 * Input (json body) :
 *   { title, country_iso?, product_slug?, amount_eur, business_plan_id? }
 * Retourne le dossier créé (id, completion_pct=0).
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { DD_TEMPLATE_V1 } from '@/lib/dd-dossier-template'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body?.title || !body?.amount_eur) {
    return NextResponse.json({ error: 'title + amount_eur required' }, { status: 400 })
  }

  const cookie = req.headers.get('cookie') ?? ''
  const userJwt = cookie.match(/sb-[^=]+=([^;]+)/)?.[1]
  if (!userJwt) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const { data: { user } } = await db.auth.getUser(decodeURIComponent(userJwt))
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data, error } = await db.from('funding_dossiers').insert({
    user_id: user.id,
    type: 'investissement',
    title: body.title,
    country_iso: body.country_iso ?? null,
    product_slug: body.product_slug ?? null,
    amount_eur: body.amount_eur,
    business_plan_id: body.business_plan_id ?? null,
    structure: { template_version: DD_TEMPLATE_V1.version, sections: DD_TEMPLATE_V1.sections },
    answers: {},
    completion_pct: 0,
    status: 'draft',
  }).select('id, title, completion_pct, status').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
