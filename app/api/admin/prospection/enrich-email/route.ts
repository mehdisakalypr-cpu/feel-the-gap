/**
 * /api/admin/prospection/enrich-email
 * Cascade email finder (Hunter → Snov → Permutator + Hunter verifier).
 * Body: { leads: [{ first_name, last_name, domain, company? }] }
 * Returns: { enriched: [{ ...lead, email, confidence, source }] }
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cascadeFindEmail, listConfiguredProviders } from '@/lib/email-finder/cascade'

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

export async function GET() {
  const gate = await requireAdmin(); if (gate) return gate
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ providers: listConfiguredProviders() })
}

export async function POST(req: Request) {
  const gate = await requireAdmin(); if (gate) return gate
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    leads?: Array<{ id?: string; first_name: string; last_name: string; domain: string; company?: string }>
  } | null
  if (!body?.leads || !Array.isArray(body.leads)) {
    return NextResponse.json({ error: 'Body must contain { leads: [{first_name, last_name, domain}] }' }, { status: 400 })
  }
  if (body.leads.length > 30) {
    return NextResponse.json({ error: 'Max 30 leads per batch (free tier protection)' }, { status: 413 })
  }

  const providers = listConfiguredProviders()
  if (providers.length === 0) {
    return NextResponse.json({
      error: 'Aucun email provider configuré',
      hint: 'Set HUNTER_API_KEY et/ou SNOV_CLIENT_ID + SNOV_CLIENT_SECRET.',
      enriched: [],
    }, { status: 503 })
  }

  const enriched = await Promise.all(
    body.leads.map(async (l) => {
      if (!l.first_name || !l.last_name || !l.domain) return { ...l, found: null }
      const found = await cascadeFindEmail({
        first_name: l.first_name,
        last_name: l.last_name,
        domain: l.domain,
        company: l.company,
      })
      return { ...l, found }
    }),
  )

  return NextResponse.json({ enriched, providers })
}
