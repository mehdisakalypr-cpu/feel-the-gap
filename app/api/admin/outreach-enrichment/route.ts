import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/supabase-server'

/**
 * POST /api/admin/outreach-enrichment
 * Body: { demo_id, email?, phone?, whatsapp? }
 *
 * 1. Updates entrepreneur_demos.email (primary signal for outreach-engine)
 * 2. Upserts entrepreneurs_directory row so future demos for same person/country
 *    inherit contact via name+country_iso ilike lookup (see outreach-engine.ts).
 */

type Body = {
  demo_id?: string
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
}

function normEmail(v: string | null | undefined): string | null {
  if (!v) return null
  const t = v.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null
  return t
}

function normPhone(v: string | null | undefined): string | null {
  if (!v) return null
  const t = v.trim().replace(/[^\d+]/g, '')
  if (!/^\+?\d{7,15}$/.test(t)) return null
  return t
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as Body
  if (!body.demo_id) return NextResponse.json({ ok: false, error: 'demo_id required' }, { status: 400 })

  const email = normEmail(body.email)
  const phone = normPhone(body.phone)
  const whatsapp = normPhone(body.whatsapp)

  if (!email && !phone && !whatsapp) {
    return NextResponse.json({ ok: false, error: 'at least one valid contact required' }, { status: 400 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data: demo, error: demoErr } = await db
    .from('entrepreneur_demos')
    .select('id, full_name, company_name, country_iso, city, sector, linkedin_url')
    .eq('id', body.demo_id)
    .maybeSingle()
  if (demoErr || !demo) return NextResponse.json({ ok: false, error: demoErr?.message ?? 'demo_not_found' }, { status: 404 })

  const demoPatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (email) demoPatch.email = email
  const { error: updErr } = await db.from('entrepreneur_demos').update(demoPatch).eq('id', demo.id)
  if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 })

  // Best-effort directory upsert — failures here must NOT block outreach readiness.
  if (demo.full_name && demo.country_iso) {
    const dirPatch: Record<string, unknown> = {
      name: demo.full_name,
      business_name: demo.company_name ?? null,
      country_iso: demo.country_iso,
      city: demo.city ?? null,
      sector: demo.sector ?? null,
      linkedin_url: demo.linkedin_url ?? null,
      source: 'admin_enrichment',
      verified: true,
      updated_at: new Date().toISOString(),
    }
    if (email) dirPatch.email = email
    if (phone) dirPatch.phone = phone
    if (whatsapp) dirPatch.whatsapp = whatsapp

    await db.from('entrepreneurs_directory').upsert(dirPatch, { onConflict: 'name,country_iso' })
  }

  return NextResponse.json({ ok: true, demo_id: demo.id, email, phone, whatsapp })
}
