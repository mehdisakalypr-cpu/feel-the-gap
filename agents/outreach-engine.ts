// @ts-nocheck
/**
 * outreach-engine — Vague 2 #4 · 2026-04-18
 *
 * Prend les entrepreneur_demos prêts (status='generated', outreach_sent_at=null,
 * expires_at > now, email OU whatsapp/phone) et envoie le pitch au bon canal :
 *  - Resend email (prio si email présent)
 *  - CallMeBot WhatsApp (fallback si email absent mais whatsapp présent)
 *
 * Met à jour status='contacted' + outreach_channel + outreach_sent_at.
 *
 * Usage :
 *   npx tsx agents/outreach-engine.ts                       # dry-run (n'envoie rien)
 *   npx tsx agents/outreach-engine.ts --apply               # envoie en vrai
 *   npx tsx agents/outreach-engine.ts --apply --limit=50    # batch 50
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { sendWhatsAppCallMeBot } from '../lib/outreach/whatsapp'

// ── env ─────────────────────────────────────────────────────────────────────
function loadEnv() {
  const p = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i).trim()
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://feel-the-gap.vercel.app'
const FROM    = process.env.EMAIL_FROM || 'Feel The Gap <outreach@ofaops.xyz>'

// ── args ────────────────────────────────────────────────────────────────────
const argv = {
  apply: process.argv.includes('--apply'),
  limit: Number((process.argv.find(a => a.startsWith('--limit=')) ?? '--limit=25').split('=')[1]),
}

// ── db ──────────────────────────────────────────────────────────────────────
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

// ── templates ───────────────────────────────────────────────────────────────
function pitchEmailHtml(args: {
  fullName: string
  companyName: string | null
  heroMessage: string
  demoUrl: string
  archetype: string | null
  roiMonthlyEur: number | null
}): string {
  const { fullName, companyName, heroMessage, demoUrl, archetype, roiMonthlyEur } = args
  const roi = roiMonthlyEur ? `<strong style="color:#C9A84C">${roiMonthlyEur.toLocaleString('fr-FR')} €/mois</strong>` : '—'
  const company = companyName ? ` · ${companyName}` : ''
  return `<div style="font-family:system-ui,sans-serif;background:#07090F;color:#e2e8f0;padding:40px 32px;max-width:600px;margin:0 auto">
    <div style="margin-bottom:24px">
      <span style="color:#C9A84C;font-weight:800;font-size:18px;letter-spacing:.04em">Feel The Gap</span>
    </div>
    <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">Bonjour ${fullName}${company ? `,<br><span style="color:rgba(255,255,255,.5);font-size:14px;font-weight:400">${companyName}</span>` : ''}</h2>
    <p style="color:rgba(255,255,255,.75);line-height:1.7;font-size:15px;margin-bottom:20px">${heroMessage}</p>
    ${archetype ? `<div style="margin:16px 0;padding:12px 16px;background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.25);border-radius:10px;font-size:13px;color:rgba(255,255,255,.7)">
      Profil détecté : <strong style="color:#C9A84C">${archetype}</strong>${roiMonthlyEur ? `<br>Potentiel mensuel estimé : ${roi}` : ''}
    </div>` : ''}
    <a href="${demoUrl}" style="display:inline-block;margin-top:16px;background:#C9A84C;color:#07090F;padding:14px 28px;text-decoration:none;font-weight:700;border-radius:10px;font-size:15px">
      Voir votre démo personnalisée →
    </a>
    <p style="color:rgba(255,255,255,.4);font-size:12px;margin-top:24px;line-height:1.6">
      Cette démo est unique et expire dans 30 jours. Elle est gratuite, sans engagement.
    </p>
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid rgba(255,255,255,.08);font-size:12px;color:rgba(255,255,255,.3)">
      Feel The Gap · data d'import/export mondiales + business plans IA<br>
      <a href="${APP_URL}" style="color:#C9A84C;text-decoration:none">${APP_URL.replace(/^https?:\/\//, '')}</a>
    </div>
  </div>`
}

function pitchWhatsAppText(args: {
  fullName: string
  heroMessage: string
  demoUrl: string
}): string {
  const short = args.heroMessage.length > 180 ? args.heroMessage.slice(0, 177) + '…' : args.heroMessage
  return `Bonjour ${args.fullName.split(' ')[0]},\n\n${short}\n\nVotre démo personnalisée Feel The Gap (gratuite, 30j) : ${args.demoUrl}`
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[outreach-engine] mode=${argv.apply ? 'APPLY' : 'DRY-RUN'} limit=${argv.limit}`)

  const nowIso = new Date().toISOString()
  const { data: demos, error } = await db
    .from('entrepreneur_demos')
    .select(`
      id, token, full_name, company_name, email, hero_message,
      country_iso, city, sector, archetype, roi_monthly_eur,
      outreach_sent_at, status, expires_at
    `)
    .eq('status', 'generated')
    .is('outreach_sent_at', null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('created_at', { ascending: true })
    .limit(argv.limit)

  if (error) {
    console.error('[outreach-engine] DB error:', error.message)
    process.exit(1)
  }
  if (!demos || demos.length === 0) {
    console.log('[outreach-engine] rien à envoyer (0 demos prêts)')
    return
  }

  console.log(`[outreach-engine] ${demos.length} demos à traiter`)

  const resendKey = process.env.RESEND_API_KEY
  const callmebotKey = process.env.CALLMEBOT_API_KEY
  const resend = resendKey ? new Resend(resendKey) : null

  let sentEmail = 0
  let sentWhatsapp = 0
  let skipped = 0
  let errs = 0

  for (const d of demos) {
    const demoUrl = `${APP_URL}/demo/${d.token}`

    // Backfill : email manquant → cherche dans entrepreneurs_directory par name+country
    let email: string | null = d.email
    let whatsapp: string | null = null
    let phone: string | null = null
    if (!email) {
      const { data: dirRow } = await db
        .from('entrepreneurs_directory')
        .select('email, phone, whatsapp')
        .eq('country_iso', d.country_iso)
        .ilike('name', d.full_name)
        .limit(1)
        .maybeSingle()
      email = dirRow?.email ?? null
      whatsapp = dirRow?.whatsapp ?? null
      phone = dirRow?.phone ?? null
    }

    if (!email && !whatsapp && !phone) {
      skipped++
      continue
    }

    let channel: 'email' | 'whatsapp' | null = null
    let sent = false

    if (email) {
      if (!argv.apply || !resend) {
        console.log(`[outreach-engine] [dry] email ${email} — demo ${d.id.slice(0, 8)}`)
        channel = 'email'; sent = !!argv.apply
      } else {
        try {
          await resend.emails.send({
            from: FROM,
            to: email,
            subject: `${d.full_name.split(' ')[0]}, votre démo Feel The Gap est prête`,
            html: pitchEmailHtml({
              fullName: d.full_name,
              companyName: d.company_name,
              heroMessage: d.hero_message ?? 'Feel The Gap analyse votre marché et identifie les opportunités d\'import/export.',
              demoUrl,
              archetype: d.archetype,
              roiMonthlyEur: d.roi_monthly_eur,
            }),
          })
          channel = 'email'
          sent = true
          sentEmail++
        } catch (err) {
          console.error(`[outreach-engine] ❌ email ${email}`, err)
          errs++
        }
      }
    } else if (whatsapp || phone) {
      const wa = whatsapp ?? phone!
      if (!argv.apply || !callmebotKey) {
        console.log(`[outreach-engine] [dry] whatsapp ${wa} — demo ${d.id.slice(0, 8)}`)
        channel = 'whatsapp'; sent = !!argv.apply
      } else {
        const r = await sendWhatsAppCallMeBot({
          phone: wa,
          text: pitchWhatsAppText({ fullName: d.full_name, heroMessage: d.hero_message ?? 'Votre démo Feel The Gap est prête.', demoUrl }),
        })
        if (r.ok) {
          channel = 'whatsapp'
          sent = true
          sentWhatsapp++
        } else {
          console.error(`[outreach-engine] ❌ whatsapp ${wa} status=${r.status} ${r.detail ?? ''}`)
          errs++
        }
      }
    }

    if (sent && argv.apply && channel) {
      await db.from('entrepreneur_demos').update({
        status: 'contacted',
        outreach_channel: channel,
        outreach_sent_at: new Date().toISOString(),
      }).eq('id', d.id)
    }
  }

  console.log(`[outreach-engine] ✅ emails=${sentEmail} · whatsapp=${sentWhatsapp} · skipped=${skipped} · errors=${errs}`)
}

main().catch(err => {
  console.error('[outreach-engine] fatal:', err)
  process.exit(1)
})
