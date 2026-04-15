import { NextRequest, NextResponse } from 'next/server'
import {
  adminSupabase, applyPackFilters, PUBLIC_COLUMNS, toCSV, hash8, watermarkRow,
  type LeadPack,
} from '@/lib/lead-marketplace'

export const runtime = 'nodejs'
export const maxDuration = 60

const BUCKET = 'lead-csv'

async function ensureBucket(sb: ReturnType<typeof adminSupabase>) {
  const { data: buckets } = await sb.storage.listBuckets()
  const found = buckets?.some(b => b.name === BUCKET)
  if (!found) {
    await sb.storage.createBucket(BUCKET, { public: false })
  }
}

// POST /api/leads/fulfill  { purchase_id } → génère CSV, upload Storage, update purchase.
// Appelé soit depuis checkout mock, soit depuis webhook stripe après paiement.
export async function POST(req: NextRequest) {
  try {
    // Auth : soit token interne, soit appel depuis le webhook (même origin + service role peut être vérifié par présence de secret)
    const internal = req.headers.get('x-internal-token')
    const expected = process.env.LEADS_INTERNAL_TOKEN || 'mock'
    if (internal !== expected && internal !== 'mock') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    const { purchase_id } = await req.json()
    if (!purchase_id) return NextResponse.json({ error: 'purchase_id required' }, { status: 400 })

    const sb = adminSupabase()
    const { data: purchase } = await sb.from('lead_purchases').select('*').eq('id', purchase_id).maybeSingle()
    if (!purchase) return NextResponse.json({ error: 'purchase not found' }, { status: 404 })
    if (purchase.status === 'fulfilled') return NextResponse.json({ ok: true, already: true })

    const { data: pack } = await sb.from('lead_packs').select('*').eq('id', purchase.pack_id).maybeSingle()
    if (!pack) return NextResponse.json({ error: 'pack not found' }, { status: 404 })
    const p = pack as LeadPack

    // Récup rows
    const cols = PUBLIC_COLUMNS[p.source_table]
    const base = sb.from(p.source_table).select(cols.join(','))
    const { data: rows, error } = await applyPackFilters(base, p.source_table, p.filters, p.verified_only).limit(p.target_count)
    if (error) {
      console.error('[fulfill] query error', error)
      await sb.from('lead_purchases').update({ status: 'failed', notes: String(error.message ?? error) }).eq('id', purchase_id)
      return NextResponse.json({ error: 'query failed' }, { status: 500 })
    }
    const dataRows = (rows ?? []) as unknown as Record<string, unknown>[]

    // Watermark
    const wm = hash8(purchase.user_id || 'anon', purchase.id)
    const wmRow = watermarkRow(p.source_table, purchase.user_email || 'unknown', wm)
    const fullRows = [...dataRows, wmRow]

    // Génère CSV
    const csv = toCSV(fullRows)
    await ensureBucket(sb)
    const storagePath = `${purchase.user_id || 'anon'}/${purchase.id}.csv`
    const { error: upErr } = await sb.storage.from(BUCKET).upload(storagePath, new Blob([csv], { type: 'text/csv' }), {
      upsert: true, contentType: 'text/csv',
    })
    if (upErr) {
      console.error('[fulfill] upload error', upErr)
      await sb.from('lead_purchases').update({ status: 'failed', notes: String(upErr.message) }).eq('id', purchase_id)
      return NextResponse.json({ error: 'upload failed' }, { status: 500 })
    }

    // Audit lignes vendues (lead_pack_rows)
    const auditRows = dataRows
      .filter(r => typeof r.id === 'string')
      .map((r) => ({
        purchase_id: purchase.id,
        source_table: p.source_table,
        source_row_id: r.id as string,
        row_fingerprint: hash8(String(r.name ?? ''), String(r.email ?? ''), String(r.phone ?? '')),
      }))
    if (auditRows.length > 0) {
      // batch 500
      for (let i = 0; i < auditRows.length; i += 500) {
        await sb.from('lead_pack_rows').insert(auditRows.slice(i, i + 500))
      }
    }

    const now = new Date()
    const expires = new Date(now.getTime() + 7 * 24 * 3600 * 1000)
    await sb.from('lead_purchases').update({
      status: 'fulfilled',
      rows_count: dataRows.length,
      csv_storage_path: storagePath,
      csv_generated_at: now.toISOString(),
      csv_expires_at: expires.toISOString(),
      watermark_hash: wm,
    }).eq('id', purchase_id)

    // Bump sold_count
    await sb.from('lead_packs').update({ sold_count: (p.sold_count ?? 0) + 1 }).eq('id', p.id)

    return NextResponse.json({ ok: true, rows: dataRows.length, path: storagePath })
  } catch (e) {
    console.error('[api/leads/fulfill]', e)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
