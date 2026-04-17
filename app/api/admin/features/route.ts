import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase-server'
import { getAllFlagsDetailed } from '@/lib/feature-flags'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const gate = await requireAdmin()
  if (gate) return gate
  const flags = await getAllFlagsDetailed()
  return NextResponse.json({ flags })
}
