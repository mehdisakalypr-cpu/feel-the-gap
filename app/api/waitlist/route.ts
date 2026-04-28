import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from '@/lib/email/send'
import { getAuthUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLAN_LABEL: Record<string, string> = {
  solo_producer: 'Solo Producer',
  starter: 'Starter',
  strategy: 'Strategy',
  premium: 'Premium',
  ultimate: 'Ultimate',
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

function validEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

export async function POST(req: NextRequest) {
  let body: { email?: string; plan?: string; pack?: string; locale?: string; source_path?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }) }

  const email = (body.email ?? '').trim().toLowerCase()
  if (!validEmail(email)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 })
  }

  const plan = (body.plan ?? '').slice(0, 32)
  const pack = (body.pack ?? '').slice(0, 16)
  const locale = (body.locale ?? 'fr').slice(0, 5)
  const sourcePath = (body.source_path ?? '').slice(0, 200)
  const planLabel = PLAN_LABEL[plan] ?? (pack ? `Pack ${pack}` : 'Accès anticipé')

  const user = await getAuthUser().catch(() => null)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const ua = req.headers.get('user-agent')?.slice(0, 200) ?? null
  const country = req.headers.get('x-vercel-ip-country') ?? null

  const sb = admin()
  const { error } = await sb.from('crm_contacts').upsert(
    {
      user_id: user?.id ?? null,
      email,
      source_product: 'ftg',
      source_url: sourcePath || null,
      status: 'free',
      locale,
      metadata: {
        waitlist: true,
        plan_target: plan || null,
        pack_target: pack || null,
        signup_ip_country: country,
        signup_ip_hash: ip ? Buffer.from(ip).toString('base64').slice(0, 16) : null,
        signup_ua: ua,
      },
    },
    { onConflict: 'email,source_product' },
  )

  if (error) {
    console.error('[waitlist] insert failed', error.message)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  await sendResendEmail({
    to: email,
    subject: 'Tu es sur la liste — Feel The Gap',
    html: `<!doctype html><html><body style="margin:0;background:#07090F;font-family:system-ui,-apple-system,sans-serif;color:#E5E7EB">
<div style="max-width:520px;margin:32px auto;padding:32px;background:#0D1117;border:1px solid rgba(201,168,76,.2);border-radius:16px">
  <div style="color:#C9A84C;font-weight:800;font-size:20px;margin-bottom:12px">Feel The Gap</div>
  <h2 style="color:#fff;font-size:22px;margin:0 0 12px">Tu es sur la liste prioritaire</h2>
  <p style="color:rgba(255,255,255,.75);line-height:1.6;margin:0 0 16px">
    Plan visé : <strong style="color:#C9A84C">${planLabel}</strong>.<br/>
    On t'écrit dès que la souscription est ouverte. Tu auras un accès prioritaire et une remise de bienvenue.
  </p>
  <p style="color:rgba(255,255,255,.55);font-size:13px;margin:16px 0 0">
    En attendant, explore librement les rapports pays sur <a href="https://www.gapup.io/reports" style="color:#C9A84C">gapup.io/reports</a>.
  </p>
  <p style="color:rgba(255,255,255,.35);font-size:11px;margin-top:24px">
    Feel The Gap · gapup.io · Pour ne plus recevoir d'emails, réponds <em>STOP</em>.
  </p>
</div></body></html>`,
  }).catch(() => false)

  return NextResponse.json({ ok: true, plan, pack })
}
