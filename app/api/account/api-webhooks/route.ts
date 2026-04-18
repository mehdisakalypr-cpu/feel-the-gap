import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { generateWebhookSecret, type WebhookEvent } from '@/lib/api-platform/webhooks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_EVENTS: WebhookEvent[] = ['opportunity.created', 'opportunity.updated', 'country.stats_refreshed']

async function getUser() {
  const cookieStore = await cookies()
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() { /* readonly */ },
      },
    },
  )
  const { data } = await sb.auth.getUser()
  return data.user
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sb = admin()
  const { data, error } = await sb
    .from('api_webhooks')
    .select('id, name, url, events, active, created_at, last_success_at, last_failure_at, failure_count')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, webhooks: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? '').trim().slice(0, 80) || 'My Webhook'
  const url = String(body.url ?? '').trim()
  if (!/^https?:\/\/.+/i.test(url)) {
    return NextResponse.json({ error: 'url must be http(s)' }, { status: 400 })
  }
  const events = Array.isArray(body.events) && body.events.length > 0
    ? body.events.filter((e: unknown): e is WebhookEvent => VALID_EVENTS.includes(e as WebhookEvent))
    : ['opportunity.created']
  if (events.length === 0) {
    return NextResponse.json({ error: 'at least one valid event required' }, { status: 400 })
  }

  const secret = generateWebhookSecret()
  const sb = admin()
  const { data, error } = await sb.from('api_webhooks').insert({
    owner_id: user.id,
    name,
    url,
    events,
    secret,
  }).select('id, name, url, events, active, created_at').maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'insert failed' }, { status: 500 })
  }
  // Secret renvoyé UNE SEULE FOIS
  return NextResponse.json({ ok: true, secret, webhook: data })
}
