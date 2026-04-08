import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

const VALID_TIERS = ['free', 'basic', 'standard', 'premium', 'enterprise']

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { userId, tier, isBilled, demoExpiresAt, isDelegateAdmin } = body

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId requis' }, { status: 400 })
  }
  if (tier && !VALID_TIERS.includes(tier)) {
    return NextResponse.json({ error: 'Tier invalide' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  // Build update object
  const update: Record<string, unknown> = {}
  if (tier !== undefined) update.tier = tier
  if (typeof isBilled === 'boolean') update.is_billed = isBilled
  if (demoExpiresAt !== undefined) update.demo_expires_at = demoExpiresAt || null
  if (typeof isDelegateAdmin === 'boolean') update.is_delegate_admin = isDelegateAdmin

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('profiles')
    .update(update)
    .eq('id', userId)
    .select('id, email, full_name, tier, is_billed, demo_expires_at, is_admin, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ user: data })
}
