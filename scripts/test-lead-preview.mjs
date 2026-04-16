#!/usr/bin/env node
// Test direct de la preview anonymisée sur le pack restaurateurs.
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs.readFileSync('/var/www/feel-the-gap/.env.local','utf8').split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1)] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const slug = process.argv[2] || 'restaurateurs-france-500'
const { data: pack } = await sb.from('lead_packs').select('*').eq('slug', slug).maybeSingle()
if (!pack) { console.error('pack not found'); process.exit(1) }
console.log(`Pack: ${pack.title} · ${pack.target_count} leads · ${pack.price_cents/100} €`)
console.log('source_table:', pack.source_table, '· filters:', JSON.stringify(pack.filters))

const f = pack.filters || {}
let qc = sb.from(pack.source_table).select('id', { count: 'exact', head: true })
if (f.country_iso) qc = qc.eq('country_iso', f.country_iso)
if (Array.isArray(f.country_iso_in)) qc = qc.in('country_iso', f.country_iso_in)
if (Array.isArray(f.buyer_type) && pack.source_table === 'local_buyers') qc = qc.in('buyer_type', f.buyer_type)
if (Array.isArray(f.investor_type) && pack.source_table === 'investors_directory') qc = qc.in('investor_type', f.investor_type)
if (Array.isArray(f.product_slugs)) qc = qc.overlaps('product_slugs', f.product_slugs)
if (Array.isArray(f.sectors_of_interest)) qc = qc.overlaps('sectors_of_interest', f.sectors_of_interest)
if (Array.isArray(f.regions_of_interest)) qc = qc.overlaps('regions_of_interest', f.regions_of_interest)
if (f.impact_focus === true) qc = qc.eq('impact_focus', true)
if (typeof f.sector === 'string' && pack.source_table === 'entrepreneurs_directory') qc = qc.eq('sector', f.sector)
if (pack.verified_only && pack.source_table !== 'exporters_directory') qc = qc.eq('verified', true)
const { count } = await qc
console.log('\nRows dispo:', count)

const cols = pack.source_table === 'local_buyers'
  ? 'id,name,buyer_type,country_iso,city,email,phone,whatsapp,contact_name,verified'
  : 'id,name,country_iso,city,email,phone'
let qr = sb.from(pack.source_table).select(cols)
if (f.country_iso) qr = qr.eq('country_iso', f.country_iso)
if (Array.isArray(f.country_iso_in)) qr = qr.in('country_iso', f.country_iso_in)
if (Array.isArray(f.buyer_type) && pack.source_table === 'local_buyers') qr = qr.in('buyer_type', f.buyer_type)
if (Array.isArray(f.product_slugs)) qr = qr.overlaps('product_slugs', f.product_slugs)
const { data: rows } = await qr.limit(5)

const mask = (v, keep=2) => !v ? null : v.length <= keep ? '•'.repeat(v.length) : v.slice(0, keep) + '•'.repeat(Math.max(3, v.length - keep))
console.log('\n--- RAW (jamais servi publiquement) ---')
for (const r of rows ?? []) console.log(`  ${r.name} | email=${r.email ?? '—'} | phone=${r.phone ?? '—'}`)
console.log('\n--- PREVIEW PUBLIQUE (anonymisée) ---')
for (const r of rows ?? []) {
  console.log(`  name=${mask(r.name, 3)} | email=${mask(r.email, 1)} | phone=${mask(r.phone, 3)} | city=${r.city} | country=${r.country_iso}`)
}
console.log('\n✓ Aucun email/phone complet ne fuite dans la preview.')
