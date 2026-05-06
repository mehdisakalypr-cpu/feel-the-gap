/**
 * POST /api/contracts/accept
 * Body: { plan, email, typed_name, purchase_intent?, time_on_doc_ms?, total_time_on_page_ms?, scroll_completed? }
 *
 * Records a signed_agreements row with:
 *   - SHA256 of the body the user saw (re-fetched server-side from /api/contracts/template/[plan])
 *   - SHA256 of the POSTed body (tamper evidence)
 *   - IP + User-Agent captured from request headers
 *   - typed signature text (min 3 chars)
 *   - time_on_doc_ms + total_time_on_page_ms
 *
 * Sends a Resend receipt (best-effort — DB row is authoritative).
 *
 * Auth: optional — checkout can be pre-auth (free signup, anonymous upgrade).
 * We attach user_id when the Supabase session cookie is present.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { createHash } from 'node:crypto'
import { getAuthUser } from '@/lib/supabase-server'
import { ftgAgreementFor, type FtgPlanKey } from '@/lib/contracts-ftg'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  plan: string
  email: string
  typed_name: string
  purchase_intent?: Record<string, unknown>
  time_on_doc_ms?: number
  total_time_on_page_ms?: number
  scroll_completed?: boolean
}

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const FROM = process.env.RESET_FROM_EMAIL || process.env.EMAIL_FROM || 'Feel The Gap <noreply@gapup.io>'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

function validEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

function absoluteOrigin(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.FTG_PUBLIC_BASE_URL ||
    new URL('/', req.url).origin
  )
}

async function fetchRenderedBody(origin: string, plan: FtgPlanKey): Promise<string> {
  try {
    const r = await fetch(`${origin}/api/contracts/template/${plan}`, { cache: 'no-store' })
    if (!r.ok) return ''
    const j = (await r.json()) as { html?: string; markdown?: string }
    return j.markdown ?? j.html ?? ''
  } catch {
    return ''
  }
}

async function sendReceipt(to: string, opts: {
  planTitle: string
  version: string
  typedName: string
  ip: string | null
  ua: string | null
  hash: string
  signedAt: string
}): Promise<{ ok: boolean; id?: string }> {
  if (!RESEND_API_KEY || !to) return { ok: false }
  const html = `<!doctype html><html><body style="margin:0;background:#07090F;font-family:system-ui,sans-serif;color:#E5E7EB">
<div style="max-width:560px;margin:32px auto;padding:28px;background:#0D1117;border:1px solid rgba(201,168,76,.2);border-radius:16px">
  <div style="color:#C9A84C;font-weight:800;font-size:18px;margin-bottom:8px">Feel The Gap</div>
  <h2 style="color:#fff;font-size:20px;margin:0 0 10px">Signature confirmée</h2>
  <p style="color:rgba(255,255,255,.7);line-height:1.55;margin:0 0 16px">
    Nous confirmons votre signature électronique du document suivant, horodatée le
    <strong style="color:#fff">${signedAtHuman(opts.signedAt)}</strong>.
  </p>
  <div style="background:#111827;border:1px solid rgba(201,168,76,.25);border-radius:10px;padding:14px;margin:12px 0">
    <div style="color:#C9A84C;font-weight:700">${escapeHtml(opts.planTitle)}</div>
    <div style="color:rgba(255,255,255,.5);font-size:12px;margin-top:2px">v${escapeHtml(opts.version)} — sha256 <code style="font-size:11px">${opts.hash.slice(0, 16)}…</code></div>
  </div>
  <p style="color:rgba(255,255,255,.65);font-size:13px;line-height:1.5">
    Signé par : <strong style="color:#fff">${escapeHtml(opts.typedName)}</strong><br/>
    Adresse IP : ${escapeHtml(opts.ip ?? 'n/a')}<br/>
    User-Agent : <code style="font-size:11px">${escapeHtml((opts.ua ?? 'n/a').slice(0, 120))}</code>
  </p>
  <p style="color:rgba(255,255,255,.4);font-size:12px;margin-top:20px">
    Cette preuve est conservée 10 ans dans notre base <code>signed_agreements</code> conformément au Code de commerce français (art. L123-22). Pour toute question : legal@feelthegap.world.
  </p>
  <p style="color:rgba(255,255,255,.3);font-size:11px;margin-top:16px">
    OFA Holdings LLC d/b/a Feel The Gap · 30 N Gould St, Ste R, Sheridan, WY 82801, USA
  </p>
</div></body></html>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to,
        subject: `Signature confirmée — ${opts.planTitle}`,
        html,
        tags: [
          { name: 'kind',    value: 'contract_acceptance' },
          { name: 'product', value: 'ftg' },
        ],
      }),
    })
    if (!res.ok) return { ok: false }
    const j = (await res.json()) as { id?: string }
    return { ok: true, id: j.id }
  } catch {
    return { ok: false }
  }
}

function signedAtHuman(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!))
}

export async function POST(req: NextRequest) {
  let body: Body
  try { body = (await req.json()) as Body } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  if (!body.plan) return NextResponse.json({ ok: false, error: 'missing_plan' }, { status: 400 })
  if (!body.email || !validEmail(body.email)) return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 })
  if (!body.typed_name || body.typed_name.trim().length < 3) {
    return NextResponse.json({ ok: false, error: 'signature_too_short' }, { status: 400 })
  }

  const agreement = ftgAgreementFor(body.plan)

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? null
  const ua = hdrs.get('user-agent') ?? null

  // Hash the exact body shown to the user (re-fetched server-side — tamper-evident).
  const origin = absoluteOrigin(req)
  const renderedBody = await fetchRenderedBody(origin, agreement.plan)
  const agreementHash = renderedBody ? sha256(renderedBody) : 'fetch_failed'

  // Hash the POST body as a second integrity anchor.
  const bodyHash = sha256(JSON.stringify({
    plan: body.plan,
    email: body.email,
    typed_name: body.typed_name,
    purchase_intent: body.purchase_intent ?? {},
    time_on_doc_ms: body.time_on_doc_ms ?? 0,
    total_time_on_page_ms: body.total_time_on_page_ms ?? 0,
    scroll_completed: body.scroll_completed ?? false,
  }))

  const user = await getAuthUser().catch(() => null)
  const signedAt = new Date().toISOString()

  const db = sb()
  const { data: inserted, error } = await db.from('signed_agreements').insert({
    user_id: user?.id ?? null,
    email: body.email,
    product: 'ftg',
    plan: agreement.plan,
    agreement_version: agreement.version,
    agreement_hash_sha256: agreementHash,
    body_hash_sha256: bodyHash,
    ip,
    user_agent: ua,
    time_on_doc_ms: body.time_on_doc_ms ?? null,
    total_time_on_page_ms: body.total_time_on_page_ms ?? null,
    scroll_completed: body.scroll_completed ?? false,
    signature_text: body.typed_name.trim(),
    acceptance_method: 'typed_signature',
    purchase_intent: body.purchase_intent ?? {},
    signed_at: signedAt,
  }).select('id').single()

  if (error) {
    console.error('[contracts/accept] insert failed:', error.message)
    return NextResponse.json({ ok: false, error: 'db_insert_failed', detail: error.message }, { status: 500 })
  }

  // Receipt email — best-effort.
  const receipt = await sendReceipt(body.email, {
    planTitle: agreement.titleFr,
    version: agreement.version,
    typedName: body.typed_name.trim(),
    ip,
    ua,
    hash: agreementHash,
    signedAt,
  })

  if (receipt.ok && inserted?.id) {
    await db.from('signed_agreements')
      .update({ email_sent_at: new Date().toISOString(), email_message_id: receipt.id ?? null })
      .eq('id', inserted.id)
  }

  return NextResponse.json({
    ok: true,
    id: inserted?.id,
    plan: agreement.plan,
    version: agreement.version,
    agreement_hash_sha256: agreementHash,
    body_hash_sha256: bodyHash,
    signed_at: signedAt,
    email_sent: receipt.ok,
  })
}
