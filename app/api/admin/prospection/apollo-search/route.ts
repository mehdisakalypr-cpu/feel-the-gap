/**
 * /api/admin/prospection/apollo-search
 * Wrap Apollo.io People Search pour l'UI Phase 1 (Waalaxy-like safe).
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { searchPeople, isConfigured } from '@/lib/leads/apollo'

async function requireUser() {
  const store = await cookies()
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await client.auth.getUser()
  return user
}

export async function POST(req: Request) {
  const gate = await requireAdmin(); if (gate) return gate
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isConfigured()) {
    return NextResponse.json({
      error: 'Apollo non configuré',
      hint: 'Set APOLLO_API_KEY in env. Free tier 25 email reveals/mo + unlimited search.',
      configured: false,
    }, { status: 503 })
  }

  const body = await req.json().catch(() => ({})) as {
    person_titles?: string[]
    person_seniorities?: string[]
    organization_locations?: string[]
    keywords?: string
    page?: number
    per_page?: number
  }

  const people = await searchPeople({
    person_titles: body.person_titles,
    person_seniorities: body.person_seniorities,
    organization_locations: body.organization_locations,
    keywords: body.keywords,
    page: Math.max(1, Number(body.page) || 1),
    per_page: Math.min(100, Math.max(1, Number(body.per_page) || 25)),
  })

  return NextResponse.json({ people, count: people.length })
}
