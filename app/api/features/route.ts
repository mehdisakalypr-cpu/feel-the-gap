import { NextResponse } from 'next/server'
import { getAllFlags } from '@/lib/feature-flags'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const flags = await getAllFlags()
  return NextResponse.json(
    { flags },
    { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' } },
  )
}
