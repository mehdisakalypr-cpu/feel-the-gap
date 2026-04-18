/**
 * lib/api-platform/webhooks — dispatch HTTP POST signé HMAC-SHA256.
 *
 * Signature header: X-Ftg-Signature = `sha256=<hex>`
 * Timestamp header: X-Ftg-Timestamp = unix seconds (replay protection côté client)
 * Payload format: { event, data, delivered_at }
 *
 * Retry : 1 tentative immédiate. Si échec, flag failure_count++ + last_failure_at.
 * Au-delà de 10 échecs consécutifs → active=false (le cron désactive).
 */

import { createHash, createHmac, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export type WebhookEvent =
  | 'opportunity.created'
  | 'opportunity.updated'
  | 'country.stats_refreshed'

export interface WebhookPayload {
  event: WebhookEvent
  data: Record<string, unknown>
  delivered_at: string
}

export function generateWebhookSecret(): string {
  return 'whsec_' + randomBytes(24).toString('hex')
}

export function signPayload(body: string, secret: string, timestamp: number): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex')
}

/** Vérifie signature reçue côté cible (utile pour tests + sample code côté client). */
export function verifySignature(body: string, secret: string, timestamp: number, receivedSig: string): boolean {
  const expected = signPayload(body, secret, timestamp)
  if (expected.length !== receivedSig.length) return false
  // Constant-time compare via hash (Node crypto timingSafeEqual alternative)
  const a = createHash('sha256').update(expected).digest()
  const b = createHash('sha256').update(receivedSig).digest()
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function deliverWebhook(args: {
  webhookId: string
  url: string
  secret: string
  event: WebhookEvent
  data: Record<string, unknown>
  timeoutMs?: number
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  const payload: WebhookPayload = {
    event: args.event,
    data: args.data,
    delivered_at: new Date().toISOString(),
  }
  const body = JSON.stringify(payload)
  const ts = Math.floor(Date.now() / 1000)
  const sig = signPayload(body, args.secret, ts)

  const sb = admin()
  const timeout = args.timeoutMs ?? 10_000

  let status = 0
  let responseBody = ''
  let ok = false
  let errorMsg: string | undefined

  try {
    const res = await fetch(args.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Feel-The-Gap-Webhooks/1.0',
        'X-Ftg-Event': args.event,
        'X-Ftg-Timestamp': String(ts),
        'X-Ftg-Signature': `sha256=${sig}`,
      },
      body,
      signal: AbortSignal.timeout(timeout),
    })
    status = res.status
    responseBody = (await res.text().catch(() => '')).slice(0, 500)
    ok = res.ok
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err)
    responseBody = errorMsg.slice(0, 500)
  }

  // Journal + update stats
  void sb.from('api_webhook_deliveries').insert({
    webhook_id: args.webhookId,
    event: args.event,
    payload,
    status,
    response_body: responseBody,
    delivered: ok,
  })

  if (ok) {
    void sb.from('api_webhooks').update({
      last_success_at: new Date().toISOString(),
      failure_count: 0,
      updated_at: new Date().toISOString(),
    }).eq('id', args.webhookId)
  } else {
    // Increment failure_count via RPC ou update (lecture puis maj)
    const { data: cur } = await sb
      .from('api_webhooks')
      .select('failure_count')
      .eq('id', args.webhookId)
      .maybeSingle()
    const newFailCount = (cur?.failure_count ?? 0) + 1
    const shouldDeactivate = newFailCount >= 10
    void sb.from('api_webhooks').update({
      last_failure_at: new Date().toISOString(),
      failure_count: newFailCount,
      active: shouldDeactivate ? false : true,
      updated_at: new Date().toISOString(),
    }).eq('id', args.webhookId)
  }

  return { ok, status, error: errorMsg }
}

/**
 * Dispatch un event à tous les webhooks actifs abonnés à cet event.
 * Déclenché depuis le cron qui détecte les nouvelles opps / updates.
 */
export async function dispatchEvent(event: WebhookEvent, data: Record<string, unknown>): Promise<{
  total: number
  success: number
  failure: number
}> {
  const sb = admin()
  const { data: hooks } = await sb
    .from('api_webhooks')
    .select('id, url, secret, events')
    .eq('active', true)
    .contains('events', [event])

  const list = hooks ?? []
  const results = await Promise.all(
    list.map(h => deliverWebhook({ webhookId: h.id, url: h.url, secret: h.secret, event, data })),
  )
  const success = results.filter(r => r.ok).length
  return { total: list.length, success, failure: list.length - success }
}
