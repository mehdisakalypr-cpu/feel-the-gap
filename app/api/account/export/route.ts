import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getAuthUser } from '@/lib/supabase-server'

const FROM_EMAIL = process.env.EMAIL_FROM || 'Feel The Gap <outreach@ofaops.xyz>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://feel-the-gap.vercel.app'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// POST /api/account/export — RGPD data export, emailed as JSON attachment
export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = admin()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const ua = req.headers.get('user-agent') || null

  // Collect all user data from known tables
  const collect = async (table: string, col: string = 'user_id') => {
    try {
      const { data } = await sb.from(table).select('*').eq(col, user.id).limit(1000)
      return data ?? []
    } catch { return [] }
  }

  const [
    profile,
    referralCode,
    referralsMade,
    earnings,
    savedOpps,
    reports,
    auditLog,
    emailEnrollments,
  ] = await Promise.all([
    sb.from('profiles').select('*').eq('id', user.id).maybeSingle().then(r => r.data),
    sb.from('user_referral_codes').select('*').eq('user_id', user.id).maybeSingle().then(r => r.data),
    collect('user_referrals', 'referrer_id'),
    collect('user_referral_earnings', 'referrer_id'),
    collect('saved_opportunities'),
    collect('reports'),
    collect('account_audit_log'),
    collect('email_sequence_enrollments'),
  ])

  const exportObj = {
    generated_at: new Date().toISOString(),
    user: { id: user.id, email: user.email, created_at: user.created_at },
    profile,
    referral: { code: referralCode, referrals_made: referralsMade, earnings },
    saved_opportunities: savedOpps,
    reports,
    audit_log: auditLog,
    email_enrollments: emailEnrollments,
  }

  const json = JSON.stringify(exportObj, null, 2)
  const base64 = Buffer.from(json, 'utf-8').toString('base64')

  // Log event
  await sb.from('account_audit_log').insert({
    user_id: user.id, event: 'data_export_requested', ip, user_agent: ua,
  })

  const apiKey = process.env.RESEND_API_KEY
  if (apiKey && user.email) {
    try {
      const resend = new Resend(apiKey)
      await resend.emails.send({
        from: FROM_EMAIL,
        to: user.email,
        subject: 'Export de vos données Feel The Gap',
        html: `
          <h2>Votre export RGPD</h2>
          <p>Bonjour,</p>
          <p>Voici l'export complet de vos données personnelles enregistrées sur Feel The Gap, conformément à votre droit RGPD.</p>
          <p>Le fichier JSON est joint à cet email.</p>
          <p>Pour toute question, répondez simplement à cet email.</p>
          <p style="color:#888;font-size:12px;margin-top:32px">Feel The Gap · <a href="${APP_URL}">${APP_URL}</a></p>
        `,
        attachments: [
          { filename: `ftg-export-${user.id}.json`, content: base64 },
        ],
      })
    } catch (err) {
      console.error('[account/export] resend', err)
    }
  }

  return NextResponse.json({ ok: true, size_bytes: json.length, emailed_to: user.email })
}
