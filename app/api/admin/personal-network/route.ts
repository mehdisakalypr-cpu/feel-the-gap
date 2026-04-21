/**
 * /api/admin/personal-network — CRUD contacts réseau perso LinkedIn (Shaka 2026-04-21)
 *
 * GET     → liste des contacts du user connecté
 * POST    → bulk upsert depuis CSV parsé côté client ({contacts: [...]})
 * PATCH   → update une ligne (exclusion, assignment, notes, status)
 * DELETE  → supprime une ligne
 */
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

type ContactIn = {
  linkedin_url?: string
  linkedin_public_id?: string
  full_name: string
  first_name?: string
  last_name?: string
  headline?: string
  company?: string
  position?: string
  location?: string
  connected_on?: string
  email?: string
  phone?: string
  raw_csv_row?: Record<string, unknown>
}

async function sb() {
  const store = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: () => {},
      },
    },
  )
}

async function requireUser() {
  const client = await sb()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return { client, user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { client, user, error: null }
}

export async function GET() {
  const { client, user, error } = await requireUser()
  if (error) return error
  const { data, error: err } = await client
    .from('personal_network_contacts')
    .select('*')
    .eq('owner_profile_id', user!.id)
    .order('full_name')
  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json({ contacts: data ?? [] })
}

export async function POST(req: Request) {
  const { client, user, error } = await requireUser()
  if (error) return error
  const body = await req.json().catch(() => null) as { contacts?: ContactIn[] } | null
  if (!body?.contacts || !Array.isArray(body.contacts)) {
    return NextResponse.json({ error: 'Body must contain { contacts: [...] }' }, { status: 400 })
  }
  if (body.contacts.length === 0) return NextResponse.json({ upserted: 0 })
  if (body.contacts.length > 10000) {
    return NextResponse.json({ error: 'Max 10000 contacts per batch' }, { status: 413 })
  }

  const rows = body.contacts
    .filter(c => c.full_name && c.full_name.trim().length > 0)
    .map(c => ({
      owner_profile_id: user!.id,
      linkedin_url: c.linkedin_url?.trim() || null,
      linkedin_public_id: c.linkedin_public_id?.trim() || null,
      full_name: c.full_name.trim(),
      first_name: c.first_name?.trim() || null,
      last_name: c.last_name?.trim() || null,
      headline: c.headline?.trim() || null,
      company: c.company?.trim() || null,
      position: c.position?.trim() || null,
      location: c.location?.trim() || null,
      connected_on: c.connected_on || null,
      email: c.email?.trim().toLowerCase() || null,
      phone: c.phone?.trim() || null,
      raw_csv_row: c.raw_csv_row ?? {},
    }))

  const { data, error: err } = await client
    .from('personal_network_contacts')
    .upsert(rows, { onConflict: 'owner_profile_id,linkedin_url', ignoreDuplicates: false })
    .select('id')
  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json({ upserted: data?.length ?? 0 })
}

export async function PATCH(req: Request) {
  const { client, user, error } = await requireUser()
  if (error) return error
  const body = await req.json().catch(() => null) as { id?: string; updates?: Record<string, unknown> } | null
  if (!body?.id || !body.updates) {
    return NextResponse.json({ error: 'Body must contain { id, updates }' }, { status: 400 })
  }

  const allowed = ['excluded', 'exclude_reason', 'exclude_notes', 'assigned_persona', 'tags', 'notes', 'outreach_status']
  const patch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body.updates)) {
    if (allowed.includes(k)) patch[k] = v
  }
  if (patch.excluded === true && !patch.excluded_at) {
    patch.excluded_at = new Date().toISOString()
    patch.excluded_by = user!.id
  }
  if (patch.excluded === false) {
    patch.excluded_at = null
    patch.exclude_reason = null
  }

  const { error: err } = await client
    .from('personal_network_contacts')
    .update(patch)
    .eq('id', body.id)
    .eq('owner_profile_id', user!.id)
  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const { client, user, error } = await requireUser()
  if (error) return error
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error: err } = await client
    .from('personal_network_contacts')
    .delete()
    .eq('id', id)
    .eq('owner_profile_id', user!.id)
  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
