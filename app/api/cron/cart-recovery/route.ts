/**
 * POST /api/cron/cart-recovery
 *
 * Auth : header `x-cron-secret` (CRON_SECRET) OU `Authorization: Bearer <CRON_SECRET>`
 *        OU user-agent `vercel-cron/1.0` (déclenché par Vercel Cron).
 *
 * Logique : 3 vagues d'emails sur paniers `status='active'`
 *   - Vague 1 (T+1h)  : reminder soft
 *   - Vague 2 (T+24h) : social proof
 *   - Vague 3 (T+72h) : code promo 10% auto-généré
 *
 * Cron Vercel suggéré : toutes les 30 minutes.
 *   Ajouter dans vercel.json :
 *     { "path": "/api/cron/cart-recovery", "schedule": "[asterisk-slash-30] * * * *" }
 *   (utiliser la vraie expression cron toutes-30-min en remplaçant
 *    [asterisk-slash-30] par l'étoile suivie d'un slash et de 30 — pas
 *    inscrit en clair ici car la séquence fermerait ce bloc commentaire).
 *
 * Idempotent : chaque cart est marqué dès l'envoi → pas de double-envoi.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  findAbandonedCarts,
  markCartAbandoned,
  generateRecoveryDiscountCode,
  type AbandonedCart,
  type RecoveryWave,
} from './_scheduler'
import {
  sendCartRecovery1,
  sendCartRecovery2,
  sendCartRecovery3,
} from './_email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

interface ProcessResult {
  wave: RecoveryWave
  attempted: number
  sent: number
  errors: string[]
}

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const headerSecret = req.headers.get('x-cron-secret')
  if (headerSecret && headerSecret === secret) return true
  const auth = req.headers.get('authorization') ?? ''
  if (auth === `Bearer ${secret}`) return true
  const ua = req.headers.get('user-agent') ?? ''
  if (ua.includes('vercel-cron')) return true
  return false
}

async function processWave(
  wave: RecoveryWave,
  carts: AbandonedCart[],
): Promise<ProcessResult> {
  const result: ProcessResult = { wave, attempted: carts.length, sent: 0, errors: [] }

  for (const cart of carts) {
    if (!cart.buyer_email) {
      // Pas d'email → on marque quand même comme tenté pour ne pas re-scanner.
      await markCartAbandoned(cart.id, wave)
      continue
    }
    try {
      let ok = false
      let discountCode: string | null = null
      if (wave === 1) {
        ok = await sendCartRecovery1(cart)
      } else if (wave === 2) {
        ok = await sendCartRecovery2(cart)
      } else {
        // wave 3 : générer un discount code 10% (lifetime 7 jours)
        discountCode = await generateRecoveryDiscountCode(cart.store_id, 10)
        ok = await sendCartRecovery3(cart, discountCode)
      }
      if (ok) {
        await markCartAbandoned(cart.id, wave)
        result.sent += 1
      } else {
        result.errors.push(`cart=${cart.id} email_failed`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`cart=${cart.id} ${msg}`)
    }
  }
  return result
}

async function run(req: NextRequest): Promise<NextResponse> {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const now = new Date()

  try {
    const [w1, w2, w3] = await Promise.all([
      findAbandonedCarts(now, 1),
      findAbandonedCarts(now, 2),
      findAbandonedCarts(now, 3),
    ])

    const [r1, r2, r3] = await Promise.all([
      processWave(1, w1),
      processWave(2, w2),
      processWave(3, w3),
    ])

    return NextResponse.json({
      ok: true,
      duration_ms: Date.now() - startedAt,
      results: { wave1: r1, wave2: r2, wave3: r3 },
      total_sent: r1.sent + r2.sent + r3.sent,
      total_errors: r1.errors.length + r2.errors.length + r3.errors.length,
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        duration_ms: Date.now() - startedAt,
      },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return run(req)
}

// Vercel Cron déclenche en GET par défaut → on supporte les deux.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return run(req)
}
