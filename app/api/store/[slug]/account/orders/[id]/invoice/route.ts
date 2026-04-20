// © 2025-2026 Feel The Gap — invoice PDF generator (server-side jspdf)
import { NextRequest, NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import { authBuyerForStore, supabaseAdmin } from '../../../_lib/store-api'

export const runtime = 'nodejs'

interface Params { params: Promise<{ slug: string; id: string }> }

interface OrderRow {
  id: string
  created_at: string
  paid_at: string | null
  status: string
  subtotal_cents: number
  discount_cents: number
  vat_cents: number
  shipping_cents: number
  total_cents: number
  currency: string
  buyer_email: string
  buyer_name: string | null
  buyer_address: Record<string, unknown> | null
  segment: string
}

interface ItemRow {
  product_snapshot: { name?: string; sku?: string } | null
  qty: number
  unit_price_cents: number
  vat_rate_pct: number | null
  line_total_cents: number
}

function fmtMoney(cents: number, currency = 'EUR'): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency
}

function nextInvoiceNumber(storeId: string, count: number): string {
  const yr = new Date().getFullYear()
  const prefix = storeId.slice(0, 4).toUpperCase()
  return `INV-${prefix}-${yr}-${String(count + 1).padStart(5, '0')}`
}

export async function GET(req: NextRequest, ctx: Params) {
  const { slug, id } = await ctx.params
  const auth = await authBuyerForStore(slug)
  if (!auth.ok) return auth.response
  const { sb, store, user } = auth

  const url = new URL(req.url)
  const explicitInvoiceId = url.searchParams.get('invoice_id')

  // Load order (RLS will scope it to buyer).
  const { data: orderData, error: orderErr } = await sb
    .from('store_orders')
    .select('id, created_at, paid_at, status, subtotal_cents, discount_cents, vat_cents, shipping_cents, total_cents, currency, buyer_email, buyer_name, buyer_address, segment')
    .eq('id', id)
    .eq('store_id', store.id)
    .eq('buyer_user_id', user.id)
    .maybeSingle()
  if (orderErr || !orderData) return NextResponse.json({ error: 'order_not_found' }, { status: 404 })
  const order = orderData as OrderRow

  const { data: itemsData } = await sb
    .from('store_order_items')
    .select('product_snapshot, qty, unit_price_cents, vat_rate_pct, line_total_cents')
    .eq('order_id', order.id)
  const items: ItemRow[] = (itemsData ?? []) as ItemRow[]

  // Issue / fetch invoice via service role (so we can insert if missing).
  const admin = supabaseAdmin()
  let invoiceNumber = ''
  let invoiceVersion = 1
  let issuedAt = new Date().toISOString()

  if (explicitInvoiceId) {
    const { data: inv } = await admin
      .from('store_invoices')
      .select('id, invoice_number, version, issued_at, store_id, order_id')
      .eq('id', explicitInvoiceId)
      .maybeSingle()
    if (inv && inv.store_id === store.id && inv.order_id === order.id) {
      invoiceNumber = String(inv.invoice_number)
      invoiceVersion = Number(inv.version)
      issuedAt = String(inv.issued_at)
    }
  }

  if (!invoiceNumber) {
    // Lookup or create the latest invoice for this order.
    const { data: existing } = await admin
      .from('store_invoices')
      .select('id, invoice_number, version, issued_at')
      .eq('order_id', order.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existing) {
      invoiceNumber = String(existing.invoice_number)
      invoiceVersion = Number(existing.version)
      issuedAt = String(existing.issued_at)
    } else {
      // Create a fresh invoice row.
      const { count } = await admin
        .from('store_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', store.id)
      invoiceNumber = nextInvoiceNumber(store.id, count ?? 0)
      const issuerSnapshot = store.billing_entity ?? { legal_name: store.name }
      const dataSnapshot = { order, items }
      const { error: insErr } = await admin.from('store_invoices').insert({
        order_id: order.id,
        store_id: store.id,
        invoice_number: invoiceNumber,
        version: 1,
        issuer_snapshot: issuerSnapshot,
        data: dataSnapshot,
      })
      if (insErr) {
        return NextResponse.json({ error: 'invoice_create_failed', detail: insErr.message }, { status: 500 })
      }
    }
  }

  // Build PDF
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const issuer = (store.billing_entity ?? {}) as { legal_name?: string; vat_number?: string; siren?: string; address?: string; email?: string; phone?: string }

  // Header
  doc.setFontSize(20)
  doc.setTextColor(201, 168, 76)
  doc.text(issuer.legal_name || store.name, 15, 22)
  doc.setFontSize(9)
  doc.setTextColor(110, 110, 110)
  let y = 28
  if (issuer.address) { doc.text(String(issuer.address), 15, y); y += 4 }
  if (issuer.email) { doc.text('Email : ' + String(issuer.email), 15, y); y += 4 }
  if (issuer.phone) { doc.text('Tél : ' + String(issuer.phone), 15, y); y += 4 }
  if (issuer.siren) { doc.text('SIREN : ' + String(issuer.siren), 15, y); y += 4 }
  if (issuer.vat_number) { doc.text('TVA : ' + String(issuer.vat_number), 15, y); y += 4 }

  doc.setFontSize(16)
  doc.setTextColor(20, 20, 20)
  doc.text('FACTURE', 195, 22, { align: 'right' })
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text('N° ' + invoiceNumber + (invoiceVersion > 1 ? ` v${invoiceVersion}` : ''), 195, 28, { align: 'right' })
  doc.text('Émise le ' + new Date(issuedAt).toLocaleDateString('fr-FR'), 195, 33, { align: 'right' })
  doc.text('Commande #' + order.id.slice(0, 8), 195, 38, { align: 'right' })

  // Buyer block
  y = Math.max(y + 6, 50)
  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  doc.text('Facturé à :', 15, y); y += 5
  doc.setTextColor(20, 20, 20)
  if (order.buyer_name) { doc.text(order.buyer_name, 15, y); y += 5 }
  doc.text(order.buyer_email, 15, y); y += 5
  if (order.buyer_address) {
    const a = order.buyer_address as { line1?: string; line2?: string; postal?: string; city?: string; country?: string }
    if (a.line1) { doc.text(String(a.line1), 15, y); y += 5 }
    if (a.line2) { doc.text(String(a.line2), 15, y); y += 5 }
    const cityLine = [a.postal, a.city].filter(Boolean).join(' ')
    if (cityLine) { doc.text(cityLine, 15, y); y += 5 }
    if (a.country) { doc.text(String(a.country), 15, y); y += 5 }
  }

  // Table header
  y += 6
  doc.setDrawColor(220, 220, 220)
  doc.line(15, y, 195, y)
  y += 5
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text('Désignation', 16, y)
  doc.text('Qté', 130, y, { align: 'right' })
  doc.text('PU', 155, y, { align: 'right' })
  doc.text('Total', 195, y, { align: 'right' })
  y += 3
  doc.line(15, y, 195, y)
  y += 5

  doc.setTextColor(20, 20, 20)
  for (const it of items) {
    if (y > 260) { doc.addPage(); y = 20 }
    const name = (it.product_snapshot?.name ?? '—').slice(0, 65)
    doc.text(name, 16, y)
    doc.text(String(it.qty), 130, y, { align: 'right' })
    doc.text(fmtMoney(it.unit_price_cents, order.currency), 155, y, { align: 'right' })
    doc.text(fmtMoney(it.line_total_cents, order.currency), 195, y, { align: 'right' })
    y += 6
  }

  // Totals
  y += 4
  doc.line(120, y, 195, y); y += 5
  doc.setFontSize(9)
  doc.text('Sous-total', 130, y, { align: 'right' })
  doc.text(fmtMoney(order.subtotal_cents, order.currency), 195, y, { align: 'right' })
  y += 5
  if (order.discount_cents > 0) {
    doc.text('Remise', 130, y, { align: 'right' })
    doc.text('- ' + fmtMoney(order.discount_cents, order.currency), 195, y, { align: 'right' })
    y += 5
  }
  doc.text('Livraison', 130, y, { align: 'right' })
  doc.text(fmtMoney(order.shipping_cents, order.currency), 195, y, { align: 'right' })
  y += 5
  doc.text('TVA', 130, y, { align: 'right' })
  doc.text(fmtMoney(order.vat_cents, order.currency), 195, y, { align: 'right' })
  y += 6
  doc.line(120, y, 195, y); y += 5
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Total TTC', 130, y, { align: 'right' })
  doc.text(fmtMoney(order.total_cents, order.currency), 195, y, { align: 'right' })

  // Footer
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(140, 140, 140)
  doc.text('Document généré automatiquement — fait foi sans signature.', 105, 285, { align: 'center' })
  doc.text(store.name + ' · facture émise via Feel The Gap', 105, 289, { align: 'center' })

  const arrayBuffer = doc.output('arraybuffer')
  return new Response(arrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoiceNumber}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
