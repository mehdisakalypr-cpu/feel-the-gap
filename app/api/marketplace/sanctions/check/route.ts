import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase-server'
import { checkEntity } from '../_lib/check'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/marketplace/sanctions/check
 * Body: { name: string, country?: string }
 * Auth requise.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: { name?: unknown; country?: unknown }
  try {
    body = (await req.json()) as { name?: unknown; country?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const name = typeof body.name === 'string' ? body.name : ''
  const country = typeof body.country === 'string' ? body.country : null
  if (!name || name.length < 2) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 })
  }
  const result = await checkEntity(name, country)
  return NextResponse.json(result)
}
