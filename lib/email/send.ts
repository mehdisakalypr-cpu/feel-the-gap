/**
 * Generic transactional email sender — fail-silent if RESEND_API_KEY absent.
 * Utilisé par deal-rooms, ad-factory, any one-off transactional emails.
 * Pour les templates marketplace/sequences complexes → voir lib/email/marketplace.ts / lib/email/sequences.ts.
 */

import { Resend } from 'resend'

const FROM = process.env.EMAIL_FROM || 'Feel The Gap <outreach@ofaops.xyz>'

export async function sendResendEmail(args: {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.log(`[email/send] RESEND_API_KEY absent — skip "${args.subject}"`)
    return false
  }
  if (!args.to || (Array.isArray(args.to) && args.to.length === 0)) return false
  try {
    const resend = new Resend(key)
    await resend.emails.send({
      from: args.from || FROM,
      to: args.to,
      subject: args.subject,
      html: args.html,
      replyTo: args.replyTo,
    })
    return true
  } catch (err) {
    console.error('[email/send] error', err)
    return false
  }
}
