import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendResendEmail } from '@/lib/email/send'

interface CountryRule {
  iso: string
  name: string
  pattern: RegExp
  hint: string
}

// EORI format rules per country (EU27 + UK + EFTA where applicable).
// Authoritative reference: https://taxation-customs.ec.europa.eu/eori-number_en
const RULES: Record<string, CountryRule> = {
  AT: { iso: 'AT', name: 'Austria',        pattern: /^AT[A-Z0-9]{1,15}$/,    hint: 'AT + up to 15 alphanumeric' },
  BE: { iso: 'BE', name: 'Belgium',        pattern: /^BE\d{10}$/,            hint: 'BE + 10 digits (enterprise nb)' },
  BG: { iso: 'BG', name: 'Bulgaria',       pattern: /^BG\d{9,10}$/,          hint: 'BG + 9 or 10 digits (UIC)' },
  HR: { iso: 'HR', name: 'Croatia',        pattern: /^HR\d{11}$/,            hint: 'HR + 11 digits (OIB)' },
  CY: { iso: 'CY', name: 'Cyprus',         pattern: /^CY[A-Z0-9]{1,15}$/,    hint: 'CY + up to 15 alphanumeric' },
  CZ: { iso: 'CZ', name: 'Czechia',        pattern: /^CZ\d{8,10}$/,          hint: 'CZ + 8 to 10 digits' },
  DK: { iso: 'DK', name: 'Denmark',        pattern: /^DK\d{8}$/,             hint: 'DK + 8 digits (CVR)' },
  EE: { iso: 'EE', name: 'Estonia',        pattern: /^EE\d{8,10}$/,          hint: 'EE + 8 to 10 digits' },
  FI: { iso: 'FI', name: 'Finland',        pattern: /^FI\d{8}$/,             hint: 'FI + 8 digits (Y-tunnus)' },
  FR: { iso: 'FR', name: 'France',         pattern: /^FR\d{14}$/,            hint: 'FR + 14 digits (SIRET)' },
  DE: { iso: 'DE', name: 'Germany',        pattern: /^DE\d{9,15}$/,          hint: 'DE + 9 to 15 digits' },
  GR: { iso: 'GR', name: 'Greece',         pattern: /^(GR|EL)\d{9}$/,        hint: 'GR or EL + 9 digits (AFM)' },
  HU: { iso: 'HU', name: 'Hungary',        pattern: /^HU\d{8}$/,             hint: 'HU + 8 digits' },
  IE: { iso: 'IE', name: 'Ireland',        pattern: /^IE[A-Z0-9]{1,15}$/,    hint: 'IE + up to 15 alphanumeric' },
  IT: { iso: 'IT', name: 'Italy',          pattern: /^IT\d{11,17}$/,         hint: 'IT + 11 to 17 digits' },
  LV: { iso: 'LV', name: 'Latvia',         pattern: /^LV\d{11}$/,            hint: 'LV + 11 digits' },
  LT: { iso: 'LT', name: 'Lithuania',      pattern: /^LT\d{9,12}$/,          hint: 'LT + 9 to 12 digits' },
  LU: { iso: 'LU', name: 'Luxembourg',     pattern: /^LU\d{8}$/,             hint: 'LU + 8 digits' },
  MT: { iso: 'MT', name: 'Malta',          pattern: /^MT\d{8}$/,             hint: 'MT + 8 digits' },
  NL: { iso: 'NL', name: 'Netherlands',    pattern: /^NL\d{9,12}$/,          hint: 'NL + 9 to 12 digits (RSIN)' },
  PL: { iso: 'PL', name: 'Poland',         pattern: /^PL\d{10,17}$/,         hint: 'PL + 10 to 17 digits (NIP)' },
  PT: { iso: 'PT', name: 'Portugal',       pattern: /^PT\d{9}$/,             hint: 'PT + 9 digits (NIF)' },
  RO: { iso: 'RO', name: 'Romania',        pattern: /^RO\d{2,10}$/,          hint: 'RO + 2 to 10 digits' },
  SK: { iso: 'SK', name: 'Slovakia',       pattern: /^SK\d{10}$/,            hint: 'SK + 10 digits' },
  SI: { iso: 'SI', name: 'Slovenia',       pattern: /^SI\d{8}$/,             hint: 'SI + 8 digits' },
  ES: { iso: 'ES', name: 'Spain',          pattern: /^ES[A-Z0-9]{9}$/,       hint: 'ES + 9 alphanumeric (NIF/CIF)' },
  SE: { iso: 'SE', name: 'Sweden',         pattern: /^SE\d{10}$/,            hint: 'SE + 10 digits' },
  GB: { iso: 'GB', name: 'United Kingdom', pattern: /^GB\d{12}(000)?$/,      hint: 'GB + 12 digits (+ optional 000)' },
  XI: { iso: 'XI', name: 'Northern Ireland', pattern: /^XI\d{12}(000)?$/,    hint: 'XI + 12 digits (+ optional 000)' },
  CH: { iso: 'CH', name: 'Switzerland',    pattern: /^CH\d{6,7}$/,           hint: 'CH + 6 or 7 digits (UID)' },
  NO: { iso: 'NO', name: 'Norway',         pattern: /^NO\d{9}$/,             hint: 'NO + 9 digits' },
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateEori(input: string): { valid: boolean; rule: CountryRule | null; prefix: string } {
  const cleaned = input.replace(/\s+/g, '').toUpperCase()
  const prefix = cleaned.slice(0, 2)
  const rule = RULES[prefix] ?? null
  if (!rule) return { valid: false, rule: null, prefix }
  return { valid: rule.pattern.test(cleaned), rule, prefix }
}

export async function POST(req: NextRequest) {
  let body: { eori?: string; email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const eori = (body.eori || '').trim().toUpperCase()
  const email = (body.email || '').trim().toLowerCase()

  if (!eori || eori.length < 4 || eori.length > 20) {
    return NextResponse.json({ ok: false, error: 'EORI must be 4-20 characters' }, { status: 400 })
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 })
  }

  const { valid, rule, prefix } = validateEori(eori)
  const country_iso = rule?.iso ?? prefix
  const country_name = rule?.name ?? 'unknown'
  const format_hint = rule?.hint ?? '2-letter country code + national ID'

  // Persist opt-in lead in commerce_leads (source = lead_magnet_eori)
  const sb = supabaseAdmin()
  const slug = `lead-magnet-eori-${eori.toLowerCase()}-${Date.now().toString(36)}`
  await sb.from('commerce_leads').upsert(
    {
      business_name: `EORI lookup: ${eori}`,
      slug,
      country_iso,
      email,
      source: 'lead_magnet_eori',
      source_id: eori,
      source_url: 'https://www.gapup.io/tools/eori',
      status: 'identified',
      notes: valid
        ? `EORI format VALID for ${country_name}`
        : `EORI format INVALID — input did not match ${country_name || 'any known country'} pattern`,
    },
    { onConflict: 'slug', ignoreDuplicates: false },
  )

  // Send confirmation email (fail-silent if RESEND_API_KEY absent)
  const html = valid
    ? `<p>Hi,</p>
       <p>Your EORI <strong>${eori}</strong> matches the expected format for <strong>${country_name}</strong>.</p>
       <p>Format rule: <code>${format_hint}</code></p>
       <p>Note: this confirms the format only. To verify the EORI is registered and active, query the
       <a href="https://ec.europa.eu/taxation_customs/dds2/eos/eori_validation.jsp">EU EORI database</a>.</p>
       <p>— Feel The Gap · <a href="https://www.gapup.io">www.gapup.io</a></p>`
    : `<p>Hi,</p>
       <p>Your input <strong>${eori}</strong> does <strong>not</strong> match the EORI format for <strong>${country_name}</strong>.</p>
       <p>Expected: <code>${format_hint}</code></p>
       <p>Common mistakes: missing country prefix, wrong number of digits, including spaces or dashes.</p>
       <p>— Feel The Gap · <a href="https://www.gapup.io">www.gapup.io</a></p>`
  const sent = await sendResendEmail({
    to: email,
    subject: `EORI ${valid ? 'valid' : 'invalid'} — ${country_name}`,
    html,
  })

  return NextResponse.json({
    ok: true,
    valid,
    country_iso,
    country_name,
    format_hint,
    gated_email_sent: sent,
  })
}
