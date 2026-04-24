/**
 * email-finder — devine puis valide l'email pro d'un entrepreneur.
 * Pipeline:
 * 1. Extraire domaine depuis website_url (si dispo) ou slugify(company_name)
 * 2. Generer patterns: firstname.lastname@, f.lastname@, firstname@, contact@, info@, hello@
 * 3. MX-lookup via DNS (confirme que le domaine existe et peut recevoir emails)
 * 4. Update entrepreneurs_directory.email avec le best guess
 *
 * Usage: npx tsx agents/email-finder.ts --max=200 --apply
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'
import dns from 'node:dns/promises'
loadEnv()

const MAX = Number((process.argv.find(a => a.startsWith('--max='))?.split('=')[1]) ?? 200)
const APPLY = process.argv.includes('--apply')

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/&/g,'and').replace(/[^a-z0-9]+/g,'').slice(0, 40)
}

function extractDomain(website: string | null): string | null {
  if (!website) return null
  try {
    const u = new URL(website.startsWith('http') ? website : 'https://' + website)
    return u.hostname.replace(/^www\./, '').toLowerCase()
  } catch { return null }
}

function parseFirstLast(fullName: string): { first: string; last: string } | null {
  const parts = fullName.trim().split(/\s+/).filter(p => p.length > 1).map(p => slugify(p))
  if (parts.length < 2) return null
  return { first: parts[0], last: parts[parts.length - 1] }
}

const mxCache = new Map<string, boolean>()
async function hasMx(domain: string): Promise<boolean> {
  if (mxCache.has(domain)) return mxCache.get(domain)!
  try {
    const mx = await dns.resolveMx(domain)
    const ok = mx.length > 0
    mxCache.set(domain, ok)
    return ok
  } catch { mxCache.set(domain, false); return false }
}

function cctldForIso(iso: string): string[] {
  const m: Record<string, string[]> = {
    CIV: ['ci','com'], SEN: ['sn','com'], CMR: ['cm','com'], GHA: ['com.gh','com'],
    NGA: ['com.ng','ng','com'], BFA: ['bf','com'], MLI: ['ml','com'], BEN: ['bj','com'],
    TGO: ['tg','com'], KEN: ['co.ke','com'], ETH: ['et','com'], TZA: ['co.tz','com'],
    UGA: ['co.ug','com'], RWA: ['rw','com'], MDG: ['mg','com'], MAR: ['ma','com'],
    TUN: ['tn','com'], EGY: ['com.eg','com'], ZAF: ['co.za','com'],
    COL: ['com.co','co','com'], BRA: ['com.br','com'], PER: ['com.pe','com'],
    ECU: ['com.ec','ec','com'], MEX: ['com.mx','mx','com'],
    VNM: ['com.vn','vn','com'], IND: ['in','co.in','com'], IDN: ['co.id','id','com'],
    PHL: ['com.ph','ph','com'], THA: ['co.th','com'], BGD: ['com.bd','com'],
    TUR: ['com.tr','com'], PAK: ['com.pk','com'], LKA: ['lk','com'],
  }
  return m[iso] ?? ['com']
}

async function findEmail(row: any): Promise<string | null> {
  const company = String(row.business_name ?? row.name ?? '')
  const iso = String(row.country_iso ?? '')
  const websiteDomain = extractDomain(row.website_url)
  const personName = parseFirstLast(String(row.name ?? ''))

  // Candidate domains
  const domains: string[] = []
  if (websiteDomain) domains.push(websiteDomain)
  const companySlug = slugify(company)
  if (companySlug.length >= 3) {
    for (const tld of cctldForIso(iso)) {
      domains.push(`${companySlug}.${tld}`)
    }
  }

  for (const domain of domains) {
    if (!(await hasMx(domain))) continue
    // Prefer personalized, fallback generic
    const candidates: string[] = []
    if (personName) {
      candidates.push(`${personName.first}.${personName.last}@${domain}`)
      candidates.push(`${personName.first[0]}${personName.last}@${domain}`)
      candidates.push(`${personName.first}@${domain}`)
    }
    candidates.push(`contact@${domain}`, `info@${domain}`, `hello@${domain}`, `sales@${domain}`)
    // We just pick the top personalized candidate (or contact@ if no person)
    return candidates[0]
  }
  return null
}

async function main() {
  const sb = db()
  console.log(`[email-finder] max=${MAX} apply=${APPLY}`)

  // Pick directory rows WITHOUT email
  const { data: rows } = await sb.from('entrepreneurs_directory')
    .select('id, name, business_name, country_iso, website_url, linkedin_url')
    .is('email', null)
    .order('created_at', { ascending: false })
    .limit(MAX)

  if (!rows?.length) { console.log('nothing to process'); return }

  let guessed = 0, mxFail = 0
  for (const r of rows) {
    const email = await findEmail(r)
    if (!email) { mxFail++; continue }
    if (APPLY) {
      await sb.from('entrepreneurs_directory').update({ email }).eq('id', r.id)
    }
    guessed++
  }
  const { count: dirWithEmail } = await sb.from('entrepreneurs_directory').select('*', { count:'exact', head:true }).not('email','is',null)
  console.log(`[email-finder] processed=${rows.length} guessed=${guessed} mxFail=${mxFail} dir_with_email_total=${dirWithEmail}`)
}

main().catch(e => { console.error(e); process.exit(1) })
