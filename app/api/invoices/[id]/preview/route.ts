/**
 * GET /api/invoices/[id]/preview?seed=1
 * HTML-rendered invoice for FTG (OFA Holdings LLC d/b/a Feel The Gap).
 * Mirrors the OFA invoice template, adapted for Data / Strategy / Premium plans.
 */
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Line = { sku: string; description: string; qty: number; unit_eur: number; vat_rate?: number }
type Invoice = {
  number: string
  issue_date: string
  due_date: string
  service_period?: string
  currency: 'EUR' | 'USD'
  seller: { legal_name: string; dba: string; address: string; ein: string; wy_file_no: string; email: string; website: string }
  buyer: { business_name: string; contact_name?: string; address: string; vat_id?: string; email: string; country_iso2: string }
  reverse_charge: boolean
  lines: Line[]
  notes?: string
}

function demo(): Invoice {
  return {
    number: 'FTG-2026-00012',
    issue_date: '2026-04-14',
    due_date: '2026-05-14',
    service_period: 'April 2026',
    currency: 'EUR',
    seller: {
      legal_name: 'OFA Holdings LLC',
      dba: 'Feel The Gap',
      address: '30 N Gould St, Ste R, Sheridan, WY 82801, USA',
      ein: 'XX-XXXXXXX',
      wy_file_no: '[WY File No.]',
      email: 'billing@feelthegap.world',
      website: 'https://feelthegap.world',
    },
    buyer: {
      business_name: 'Acme Trading GmbH',
      contact_name: 'Hans Müller',
      address: 'Friedrichstraße 12, 10117 Berlin, Germany',
      vat_id: 'DE812345678',
      email: 'h.mueller@acme-trading.de',
      country_iso2: 'DE',
    },
    reverse_charge: true,
    lines: [
      { sku: 'FTG-PREMIUM',   description: 'Premium plan subscription (Apr 2026) — full dataset, AI Advisor unlimited (fair-use), API access, prospection credits', qty: 1, unit_eur: 149.00, vat_rate: 0 },
      { sku: 'FTG-BOOST-200', description: 'Booster pack — 200 extra AI Advisor queries', qty: 2, unit_eur: 19.99, vat_rate: 0 },
    ],
    notes: 'Payment due 30 days after issue. Late payment penalties: ECB rate + 10 points plus a 40€ flat recovery fee (French Commercial Code Art. L441-10).',
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function renderInvoice(inv: Invoice): string {
  const cur = inv.currency === 'EUR' ? '€' : '$'
  const fmt = (n: number) => `${n.toFixed(2)} ${cur}`
  const subtotal = inv.lines.reduce((s, l) => s + l.qty * l.unit_eur, 0)
  const vat = inv.reverse_charge ? 0 : inv.lines.reduce((s, l) => s + l.qty * l.unit_eur * (l.vat_rate ?? 0) / 100, 0)
  const total = subtotal + vat

  const rows = inv.lines.map(l => `<tr><td class="mono">${escapeHtml(l.sku)}</td><td>${escapeHtml(l.description)}</td><td class="right">${l.qty}</td><td class="right">${fmt(l.unit_eur)}</td><td class="right">${fmt(l.qty * l.unit_eur)}</td></tr>`).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Invoice ${escapeHtml(inv.number)}</title>
<style>
  * { box-sizing: border-box; }
  body { font: 13px/1.5 -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; margin: 0; padding: 40px; background: #fff; }
  .wrap { max-width: 800px; margin: 0 auto; }
  .head { display: flex; justify-content: space-between; margin-bottom: 32px; }
  .brand { font: 700 20px/1.1 -apple-system; color: #0284c7; letter-spacing: .05em; }
  .brand-sub { font-size: 11px; color: #64748b; letter-spacing: .08em; text-transform: uppercase; margin-top: 4px; }
  .inv-num { text-align: right; font-size: 11px; color: #64748b; letter-spacing: .1em; text-transform: uppercase; }
  .inv-num strong { display: block; font-size: 22px; color: #0f172a; letter-spacing: 0; text-transform: none; font-weight: 700; margin-top: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin: 24px 0 32px; }
  .card { padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; }
  .label { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
  .val { font-weight: 600; }
  .muted { color: #64748b; font-weight: 400; }
  table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 12px; }
  th { text-align: left; padding: 10px; border-bottom: 2px solid #0f172a; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
  td { padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  .right { text-align: right; }
  .mono { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11px; }
  .totals { margin-left: auto; width: 320px; font-size: 13px; }
  .totals .row { display: flex; justify-content: space-between; padding: 6px 0; }
  .totals .total { border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 12px; font-size: 16px; font-weight: 700; }
  .rc { margin: 16px 0; padding: 12px; border-left: 3px solid #0284c7; background: #f0f9ff; font-size: 11px; color: #0c4a6e; }
  .foot { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; }
  .foot a { color: #0284c7; text-decoration: none; }
  @media print { body { padding: 20mm; } }
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <div><div class="brand">FEEL THE GAP</div><div class="brand-sub">a product of ${escapeHtml(inv.seller.legal_name)}</div></div>
    <div class="inv-num">Invoice<strong>${escapeHtml(inv.number)}</strong></div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="label">Seller</div>
      <div class="val">${escapeHtml(inv.seller.legal_name)} <span class="muted">d/b/a ${escapeHtml(inv.seller.dba)}</span></div>
      <div class="muted">${escapeHtml(inv.seller.address)}</div>
      <div class="muted">EIN: ${escapeHtml(inv.seller.ein)} · WY File: ${escapeHtml(inv.seller.wy_file_no)}</div>
      <div class="muted">${escapeHtml(inv.seller.email)} · ${escapeHtml(inv.seller.website)}</div>
    </div>
    <div class="card">
      <div class="label">Bill to</div>
      <div class="val">${escapeHtml(inv.buyer.business_name)}</div>
      ${inv.buyer.contact_name ? `<div class="muted">Attn: ${escapeHtml(inv.buyer.contact_name)}</div>` : ''}
      <div class="muted">${escapeHtml(inv.buyer.address)}</div>
      ${inv.buyer.vat_id ? `<div class="muted">VAT ID: ${escapeHtml(inv.buyer.vat_id)}</div>` : ''}
      <div class="muted">${escapeHtml(inv.buyer.email)}</div>
    </div>
  </div>

  <div class="grid" style="grid-template-columns: 1fr 1fr 1fr;">
    <div class="card"><div class="label">Issue date</div><div class="val">${escapeHtml(inv.issue_date)}</div></div>
    <div class="card"><div class="label">Due date</div><div class="val">${escapeHtml(inv.due_date)}</div></div>
    <div class="card"><div class="label">Service period</div><div class="val">${escapeHtml(inv.service_period ?? '—')}</div></div>
  </div>

  <table>
    <thead><tr><th style="width: 120px;">SKU</th><th>Description</th><th class="right" style="width: 60px;">Qty</th><th class="right" style="width: 100px;">Unit</th><th class="right" style="width: 110px;">Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span class="muted">Subtotal (excl. VAT)</span><span>${fmt(subtotal)}</span></div>
    <div class="row"><span class="muted">VAT / Sales tax</span><span>${fmt(vat)}</span></div>
    <div class="row total"><span>Total due</span><span>${fmt(total)}</span></div>
  </div>

  ${inv.reverse_charge ? `<div class="rc"><strong>Reverse charge:</strong> VAT exempt under Article 196 of Council Directive 2006/112/EC — the Customer is liable for VAT self-assessment in their Member State based on the VAT ID provided above.</div>` : ''}

  ${inv.notes ? `<div class="foot" style="margin-top: 24px; color: #0f172a;"><strong>Payment terms:</strong> ${escapeHtml(inv.notes)}</div>` : ''}

  <div class="foot">
    <strong>${escapeHtml(inv.seller.legal_name)}</strong> is a Wyoming LLC. Governing law: State of Wyoming, USA.
    For EU consumers, statutory rights reserved. Disputes: AAA arbitration for US customers / statutory courts for EU consumers / ec.europa.eu/consumers/odr.
    Terms: <a href="${escapeHtml(inv.seller.website)}/legal/cgv">cgv</a> ·
    <a href="${escapeHtml(inv.seller.website)}/legal/cgu">cgu</a> ·
    <a href="${escapeHtml(inv.seller.website)}/legal/privacy">privacy</a> ·
    <a href="${escapeHtml(inv.seller.website)}/legal/refund">refund policy</a>.
    Billing: ${escapeHtml(inv.seller.email)}.
  </div>
</div>
</body>
</html>`
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const url = new URL(req.url)
  const useSeed = url.searchParams.get('seed') === '1'
  if (!useSeed && id !== 'demo') {
    return NextResponse.json({ ok: false, error: 'invoice_lookup_not_yet_implemented', hint: 'Use ?seed=1 or id=demo during bootstrap' }, { status: 501 })
  }
  return new NextResponse(renderInvoice(demo()), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
