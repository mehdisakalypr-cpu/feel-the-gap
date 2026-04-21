/**
 * /api/admin/prospection/import-to-warm
 * Importe des contacts Apollo (ou manuels) dans personal_network_contacts
 * avec tag "apollo-search" ou "manual-search".
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function requireUser() {
  const store = await cookies()
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await client.auth.getUser()
  return { client, user }
}

export async function POST(req: Request) {
  const gate = await requireAdmin(); if (gate) return gate
  const { client, user } = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    contacts?: Array<{
      first_name?: string; last_name?: string; full_name?: string
      linkedin_url?: string; email?: string
      company?: string; headline?: string; position?: string
      location?: string; country?: string
    }>
    source_tag?: string  // ex: "apollo-search" | "manual-search"
  } | null

  if (!body?.contacts || !Array.isArray(body.contacts)) {
    return NextResponse.json({ error: 'Body must contain { contacts: [...] }' }, { status: 400 })
  }
  if (body.contacts.length > 500) {
    return NextResponse.json({ error: 'Max 500 contacts per import' }, { status: 413 })
  }

  const tag = body.source_tag ?? 'prospection-import'
  const rows = body.contacts
    .filter(c => (c.full_name || (c.first_name && c.last_name)))
    .map(c => ({
      owner_profile_id: user.id,
      linkedin_url: c.linkedin_url?.trim() || null,
      full_name: c.full_name?.trim() || `${c.first_name} ${c.last_name}`.trim(),
      first_name: c.first_name?.trim() || null,
      last_name: c.last_name?.trim() || null,
      email: c.email?.trim().toLowerCase() || null,
      company: c.company?.trim() || null,
      headline: c.headline?.trim() || c.position?.trim() || null,
      position: c.position?.trim() || null,
      location: c.location?.trim() || c.country?.trim() || null,
      tags: [tag],
      outreach_status: 'pending',
    }))

  if (rows.length === 0) return NextResponse.json({ upserted: 0 })

  const { data, error } = await client
    .from('personal_network_contacts')
    .upsert(rows, { onConflict: 'owner_profile_id,linkedin_url' })
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ upserted: data?.length ?? 0, tag })
}
