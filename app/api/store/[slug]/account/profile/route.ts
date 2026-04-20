// © 2025-2026 Feel The Gap — buyer profile (display name, email change, notif prefs)
import { NextRequest, NextResponse } from 'next/server'
import { authBuyerForStore, supabaseAdmin } from '../_lib/store-api'

export const runtime = 'nodejs'

interface Params { params: Promise<{ slug: string }> }

interface ProfilePatchInput {
  display_name?: string | null
  email?: string
  notification_prefs?: Record<string, boolean>
}

const ALLOWED_PREF_KEYS = [
  'newsletter',
  'product_updates',
  'promotions',
  'cart_recovery',
  'review_requests',
] as const

function sanitizePrefs(input: Record<string, unknown> | undefined): Record<string, boolean> {
  if (!input || typeof input !== 'object') return {}
  const out: Record<string, boolean> = {}
  for (const k of ALLOWED_PREF_KEYS) {
    if (k in input) out[k] = !!input[k]
  }
  return out
}

export async function GET(_req: NextRequest, ctx: Params) {
  const { slug } = await ctx.params
  const auth = await authBuyerForStore(slug)
  if (!auth.ok) return auth.response
  const { user, store } = auth

  const admin = supabaseAdmin()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, username, display_name, full_name, notification_prefs')
    .eq('id', user.id)
    .maybeSingle()

  return NextResponse.json({
    id: user.id,
    email: user.email,
    display_name: (profile?.display_name as string | undefined) ?? (profile?.full_name as string | undefined) ?? (profile?.username as string | undefined) ?? null,
    notification_prefs: profile?.notification_prefs ?? {},
    store: { slug: store.slug, name: store.name },
  })
}

export async function PATCH(req: NextRequest, ctx: Params) {
  const { slug } = await ctx.params
  const auth = await authBuyerForStore(slug)
  if (!auth.ok) return auth.response
  const { sb, user } = auth

  let body: ProfilePatchInput
  try { body = (await req.json()) as ProfilePatchInput } catch { return NextResponse.json({ error: 'invalid_body' }, { status: 400 }) }

  const admin = supabaseAdmin()
  const updates: Record<string, unknown> = {}
  if (body.display_name !== undefined) {
    updates.display_name = body.display_name?.trim() || null
  }
  if (body.notification_prefs) {
    updates.notification_prefs = sanitizePrefs(body.notification_prefs as Record<string, unknown>)
  }
  if (Object.keys(updates).length > 0) {
    // Best-effort: profiles table may not contain all columns in every env.
    const { error: profErr } = await admin.from('profiles').update(updates).eq('id', user.id)
    if (profErr) {
      // Try a minimal update if a column is missing.
      const fallback: Record<string, unknown> = {}
      if (updates.display_name !== undefined) fallback.display_name = updates.display_name
      const { error: fbErr } = await admin.from('profiles').update(fallback).eq('id', user.id)
      if (fbErr) {
        return NextResponse.json({ error: profErr.message }, { status: 500 })
      }
    }
  }

  let emailChangePending = false
  if (typeof body.email === 'string' && body.email.trim() && body.email.trim().toLowerCase() !== (user.email ?? '').toLowerCase()) {
    const { error: emailErr } = await sb.auth.updateUser({ email: body.email.trim().toLowerCase() })
    if (emailErr) return NextResponse.json({ error: emailErr.message }, { status: 400 })
    emailChangePending = true
  }

  return NextResponse.json({ ok: true, email_change_pending: emailChangePending })
}

// Sign-out helper used by the side-nav button (POST with ?action=signout).
export async function POST(req: NextRequest, ctx: Params) {
  const { slug } = await ctx.params
  const url = new URL(req.url)
  if (url.searchParams.get('action') !== 'signout') {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
  }
  const auth = await authBuyerForStore(slug)
  if (!auth.ok) return auth.response
  const { sb } = auth
  await sb.auth.signOut()
  return NextResponse.redirect(new URL(`/store/${encodeURIComponent(slug)}/account/login`, url), { status: 303 })
}
