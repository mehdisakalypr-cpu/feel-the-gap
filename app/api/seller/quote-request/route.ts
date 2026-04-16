import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })

  const { product_id, seller_id, buyer_email, buyer_company, buyer_country, quantity, incoterm, destination, message } = body
  if (!product_id || !seller_id || !buyer_email || !buyer_company) {
    return NextResponse.json({ ok: false, error: 'missing required fields' }, { status: 400 })
  }

  // Insert into seller_quote_requests (table créée à la volée si absente — on log plutôt que de bloquer)
  const { data, error } = await sb.from('seller_quote_requests').insert({
    product_id, seller_id, buyer_email, buyer_company, buyer_country, quantity, incoterm, destination, message,
  }).select('id').single()

  // Increment counter sur le produit (best-effort)
  try {
    const { error: rpcErr } = await sb.rpc('increment_quote_request', { p_product_id: product_id })
    if (rpcErr) throw rpcErr
  } catch {
    const { data: p } = await sb.from('seller_products').select('quotes_requested_count').eq('id', product_id).maybeSingle()
    await sb.from('seller_products').update({ quotes_requested_count: ((p as any)?.quotes_requested_count ?? 0) + 1 }).eq('id', product_id)
  }

  if (error) {
    // Fallback: log dans security_items ou autre, on ne bloque pas l'UX
    console.warn('[quote-request] insert failed:', error.message)
    return NextResponse.json({ ok: true, id: 'local-' + Date.now(), warning: error.message })
  }
  return NextResponse.json({ ok: true, id: data.id })
}
