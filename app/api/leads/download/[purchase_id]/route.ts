import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/lead-marketplace'

export const runtime = 'nodejs'
const BUCKET = 'lead-csv'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ purchase_id: string }> },
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 })
    const { purchase_id } = await ctx.params
    const sb = adminSupabase()
    const { data: purchase } = await sb.from('lead_purchases').select('*').eq('id', purchase_id).maybeSingle()
    if (!purchase) return NextResponse.json({ error: 'not found' }, { status: 404 })
    if (purchase.user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    if (purchase.status !== 'fulfilled') return NextResponse.json({ error: 'not ready', status: purchase.status }, { status: 409 })
    if (purchase.csv_expires_at && new Date(purchase.csv_expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'expired' }, { status: 410 })
    }
    if ((purchase.download_count ?? 0) >= (purchase.max_downloads ?? 3)) {
      return NextResponse.json({ error: 'download limit reached' }, { status: 429 })
    }

    const { data: signed, error } = await sb.storage.from(BUCKET)
      .createSignedUrl(purchase.csv_storage_path!, 60 * 10)  // 10 min
    if (error || !signed) {
      console.error('[leads/download] sign error', error)
      return NextResponse.json({ error: 'sign failed' }, { status: 500 })
    }

    await sb.from('lead_purchases').update({
      download_count: (purchase.download_count ?? 0) + 1,
      last_download_at: new Date().toISOString(),
    }).eq('id', purchase_id)

    return NextResponse.redirect(signed.signedUrl, { status: 302 })
  } catch (e) {
    console.error('[api/leads/download]', e)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
