// Helpers partagés pour le Lead Marketplace B2B.
import crypto from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type LeadPackSourceTable =
  | 'local_buyers'
  | 'exporters_directory'
  | 'investors_directory'
  | 'entrepreneurs_directory'

export interface LeadPack {
  id: string
  slug: string
  title: string
  subtitle?: string | null
  description?: string | null
  source_table: LeadPackSourceTable
  filters: Record<string, unknown>
  target_count: number
  price_cents: number
  currency: string
  tier: 'S' | 'M' | 'L' | 'XL'
  country_iso?: string | null
  sector?: string | null
  tags: string[]
  hero_emoji?: string | null
  verified_only: boolean
  is_active: boolean
  is_featured: boolean
  sold_count: number
}

// Colonnes publiques par table (on évite d'exposer notes/raw_scrape/source/confidence)
export const PUBLIC_COLUMNS: Record<LeadPackSourceTable, string[]> = {
  local_buyers: [
    'id','name','buyer_type','country_iso','city','website_url','email','phone','whatsapp',
    'contact_name','contact_role','product_slugs','annual_volume_mt_min','annual_volume_mt_max',
    'certifications_required','payment_terms','verified',
  ],
  exporters_directory: [
    'id','name','country_iso','city','website_url','email','phone','contact_name',
    'product_slugs','destinations','annual_volume_mt','hs_codes','certifications',
  ],
  investors_directory: [
    'id','name','investor_type','firm_name','website_url','linkedin_url','email','phone',
    'country_iso','city','sectors_of_interest','regions_of_interest',
    'ticket_size_min_eur','ticket_size_max_eur','stages','impact_focus','verified',
  ],
  entrepreneurs_directory: [
    'id','name','business_name','country_iso','city','email','phone','whatsapp',
    'linkedin_url','website_url','sector','product_slugs','annual_revenue_eur_estimate',
    'employees_count','years_active','has_business_plan','seeks_financing','seeks_clients','verified',
  ],
}

// Applique les filtres JSON du pack sur une query Supabase.
// On utilise `any` volontairement car les builders PostgREST sont typés strictement
// et l'applicateur doit supporter count/select/etc.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyPackFilters<Q = any>(
  query: Q,
  sourceTable: LeadPackSourceTable,
  filters: Record<string, unknown>,
  verifiedOnly: boolean,
): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = query
  // country
  if (typeof filters.country_iso === 'string') {
    q = q.eq('country_iso', filters.country_iso)
  }
  if (Array.isArray(filters.country_iso_in)) {
    q = q.in('country_iso', filters.country_iso_in as string[])
  }
  // buyer_type (local_buyers) / investor_type
  if (Array.isArray(filters.buyer_type) && sourceTable === 'local_buyers') {
    q = q.in('buyer_type', filters.buyer_type as string[])
  }
  if (Array.isArray(filters.investor_type) && sourceTable === 'investors_directory') {
    q = q.in('investor_type', filters.investor_type as string[])
  }
  // product_slugs (array overlaps)
  if (Array.isArray(filters.product_slugs)) {
    q = q.overlaps('product_slugs', filters.product_slugs as string[])
  }
  // sector (entrepreneurs)
  if (typeof filters.sector === 'string' && sourceTable === 'entrepreneurs_directory') {
    q = q.eq('sector', filters.sector)
  }
  // sectors_of_interest (investors)
  if (Array.isArray(filters.sectors_of_interest) && sourceTable === 'investors_directory') {
    q = q.overlaps('sectors_of_interest', filters.sectors_of_interest as string[])
  }
  if (Array.isArray(filters.regions_of_interest) && sourceTable === 'investors_directory') {
    q = q.overlaps('regions_of_interest', filters.regions_of_interest as string[])
  }
  if (filters.impact_focus === true && sourceTable === 'investors_directory') {
    q = q.eq('impact_focus', true)
  }
  if (verifiedOnly && (sourceTable === 'local_buyers' || sourceTable === 'investors_directory' || sourceTable === 'entrepreneurs_directory')) {
    q = q.eq('verified', true)
  }
  return q
}

// Anonymise une ligne pour la preview publique (5 rows).
export function anonymizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row }
  const mask = (v: unknown, keep = 2) => {
    if (typeof v !== 'string' || !v) return null
    const s = v.trim()
    if (s.length <= keep) return '•'.repeat(s.length)
    return s.slice(0, keep) + '•'.repeat(Math.max(3, s.length - keep))
  }
  if ('email' in out)       out.email       = mask(out.email, 1)
  if ('phone' in out)       out.phone       = mask(out.phone, 3)
  if ('whatsapp' in out)    out.whatsapp    = mask(out.whatsapp, 3)
  if ('contact_name' in out)out.contact_name= mask(out.contact_name, 1)
  if ('linkedin_url' in out)out.linkedin_url= out.linkedin_url ? '🔒 masqué' : null
  if ('website_url' in out) out.website_url = out.website_url ? '🔒 masqué' : null
  if ('name' in out)        out.name        = mask(out.name, 3)
  if ('firm_name' in out)   out.firm_name   = mask(out.firm_name, 2)
  if ('business_name' in out) out.business_name = mask(out.business_name, 2)
  return out
}

// Genere hash8 pour watermark.
export function hash8(...parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 8)
}

// Formate une ligne en CSV.
export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const headers = Array.from(new Set(rows.flatMap(r => Object.keys(r))))
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = Array.isArray(v) ? v.join('|') : typeof v === 'object' ? JSON.stringify(v) : String(v)
    if (/[",\n;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }
  const body = rows.map(r => headers.map(h => esc(r[h])).join(',')).join('\n')
  return headers.join(',') + '\n' + body
}

export function adminSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// Génère une ligne de watermark inséré dans chaque CSV vendu.
export function watermarkRow(sourceTable: LeadPackSourceTable, userEmail: string, hash: string): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: '00000000-0000-0000-0000-000000000000',
    name: `WM_${hash}`,
    email: `wm+${hash}@feel-the-gap.local`,
    phone: null,
    country_iso: 'WM',
    city: '__watermark__',
    notes: `Watermark for ${userEmail} — do not remove, used for resale tracking`,
  }
  if (sourceTable === 'local_buyers') base.buyer_type = 'industriel'
  if (sourceTable === 'investors_directory') base.investor_type = 'business_angel'
  if (sourceTable === 'entrepreneurs_directory') base.sector = '__wm__'
  return base
}
