// @ts-nocheck
/**
 * E2E marketplace pay-fee · Shaka 2026-04-21
 *
 * Teste le flux pay-fee mode subscription (path inline, sans Stripe) :
 *   1. Crée 2 users test (producer + buyer) via admin API
 *   2. Crée production_volume + buyer_demand
 *   3. Crée marketplace_match status='confirmed' + pricing_tier_fee_eur
 *   4. Crée marketplace_subscription active avec quota dispo pour le buyer
 *   5. Appelle l'RPC billing_mode → attend 'subscription' + quota>0
 *   6. Simule la logique pay-fee : update subscription.matches_used + update match.status='paid' + reveal
 *   7. Valide : match.status='paid', identities_revealed_at NOT NULL, quota décrémenté, view v_marketplace_my_offers révèle les IDs
 *   8. Teste idempotence : 2e exécution ne double-consomme pas (via upsert revenue_events)
 *   9. Cleanup : supprime subscription, match, volume, demand, users
 *
 * Le path pay-per-act (Stripe Checkout) est SKIPPED car STRIPE_SECRET_KEY n'est
 * pas disponible en dev (gate post-LLC Wyoming). On teste séparément la construction
 * de session via dry-run (vérifie les params si clé présente).
 *
 * Usage: cd /var/www/feel-the-gap && npx tsx scripts/e2e-marketplace-pay-fee.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

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

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

type Step = { name: string; ok: boolean; detail: string }
const steps: Step[] = []
function log(name: string, ok: boolean, detail: string) {
  steps.push({ name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name} — ${detail}`)
}

const TAG = `e2e-${Date.now()}`

interface Fixtures {
  producerId?: string
  buyerId?: string
  volumeId?: string
  demandId?: string
  matchId?: string
  subscriptionId?: string
}
const fx: Fixtures = {}

// Pool of 2 existing demo users to reuse (avoid auth.admin.createUser which hits
// a mystery trigger error in dev). E2E creates volume/demand/match/sub tied to them
// with unique `notes` tag for cleanup idempotence.
const DEMO_PRODUCER_EMAIL = 'demo.entrepreneur@feelthegap.app'
const DEMO_BUYER_EMAIL    = 'demo.investisseur@feelthegap.app'

async function findUser(email: string) {
  const { data } = await db.from('profiles').select('id, email').eq('email', email).maybeSingle()
  if (!data) throw new Error(`demo user not found: ${email}`)
  return data.id
}

async function setup() {
  fx.producerId = await findUser(DEMO_PRODUCER_EMAIL)
  fx.buyerId    = await findUser(DEMO_BUYER_EMAIL)
  log('pick-demo-users', true, `producer=${fx.producerId!.slice(0, 8)} buyer=${fx.buyerId!.slice(0, 8)}`)

  const { data: vol, error: volErr } = await db.from('production_volumes').insert({
    producer_id: fx.producerId,
    country_iso: 'CIV',
    product_slug: 'coffee-robusta',
    product_label: 'Robusta green beans',
    quantity_kg: 2000,
    quality_grade: 'A',
    floor_price_eur_per_kg: 2.5,
    incoterm: 'FOB',
    status: 'open',
    notes: `E2E-TEST-${TAG}`,
  }).select('id').single()
  if (volErr) throw new Error(`volume: ${volErr.message}`)
  fx.volumeId = vol.id
  log('create-volume', true, `id=${fx.volumeId.slice(0, 8)} CIV coffee-robusta 2t`)

  const { data: dem, error: demErr } = await db.from('buyer_demands').insert({
    buyer_id: fx.buyerId,
    product_slug: 'coffee-robusta',
    product_label: 'Robusta green beans',
    quantity_kg_min: 1000,
    quantity_kg_max: 2500,
    ceiling_price_eur_per_kg: 3.0,
    incoterm: 'FOB',
    delivery_country_iso: 'FRA',
    status: 'open',
    notes: `E2E-TEST-${TAG}`,
  }).select('id').single()
  if (demErr) throw new Error(`demand: ${demErr.message}`)
  fx.demandId = dem.id
  log('create-demand', true, `id=${fx.demandId.slice(0, 8)} FRA ceiling €3/kg`)

  const proposedQty = 2000
  const proposedPrice = 2.75
  const proposedTotal = proposedQty * proposedPrice // 5500 € → Tier 1 (€0-10k) → €149 baseline
  const { data: feeCentsRow } = await db.rpc('marketplace_tier_fee_adjusted_cents', {
    total_eur: proposedTotal,
    country_iso: 'FRA',
  })
  const feeCents = typeof feeCentsRow === 'number' ? feeCentsRow : 14900
  const tierLabel = 'Tier 1 (€0-10k)'

  const { data: m, error: mErr } = await db.from('marketplace_matches').insert({
    volume_id: fx.volumeId,
    demand_id: fx.demandId,
    match_score: 92,
    proposed_quantity_kg: proposedQty,
    proposed_price_eur_per_kg: proposedPrice,
    commission_rate_pct: 2.5,
    status: 'confirmed',
    producer_decision: 'accept',
    producer_decision_at: new Date().toISOString(),
    buyer_decision: 'accept',
    buyer_decision_at: new Date().toISOString(),
    pricing_tier_label: tierLabel,
    pricing_tier_fee_eur: feeCents,
    buyer_pseudo: 'BuyerΞ42',
    seller_pseudo: 'SellerΩ17',
    confirmed_at: new Date().toISOString(),
  }).select('id').single()
  if (mErr) throw new Error(`match: ${mErr.message}`)
  fx.matchId = m.id
  log('create-match', true, `id=${fx.matchId.slice(0, 8)} confirmed feeCents=${feeCents} tier="${tierLabel}"`)

  const { data: sub, error: subErr } = await db.from('marketplace_subscriptions').insert({
    user_id: fx.buyerId,
    tier: 'starter',
    status: 'active',
    matches_per_month: 3,
    matches_used_this_period: 0,
    period_start: new Date().toISOString(),
    period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
    pricing_multiplier_at_start: 1.0,
    base_price_eur_cents: 9900,
    adjusted_price_eur_cents: 9900,
  }).select('id').single()
  if (subErr) throw new Error(`subscription: ${subErr.message}`)
  fx.subscriptionId = sub.id
  log('create-subscription', true, `id=${fx.subscriptionId.slice(0, 8)} starter 0/3 active`)
}

async function testBillingMode() {
  const { data, error } = await db.rpc('marketplace_billing_mode', { user_id: fx.buyerId })
  if (error) throw new Error(`billing_mode rpc: ${error.message}`)
  const row = Array.isArray(data) ? data[0] : data
  const ok = row?.mode === 'subscription' && row?.subscription_id === fx.subscriptionId && row?.quota_remaining === 3
  log('rpc-billing-mode', !!ok, `mode=${row?.mode} sub=${row?.subscription_id?.slice(0, 8)} quota=${row?.quota_remaining}`)
  if (!ok) throw new Error('billing_mode did not return expected subscription+quota')
}

async function simulatePayFee() {
  // Calls the atomic RPC that /api/marketplace/matches/[id]/pay-fee now uses
  const { data: rawData, error } = await db.rpc('marketplace_consume_subscription_match', {
    p_match_id:        fx.matchId,
    p_subscription_id: fx.subscriptionId,
    p_buyer_id:        fx.buyerId,
  })
  if (error) throw new Error(`rpc consume: ${error.message}`)
  const r = Array.isArray(rawData) ? rawData[0] : rawData
  if (!r?.consumed) throw new Error(`rpc did not consume: ${JSON.stringify(r)}`)
  log('simulate-pay-fee', true, `consumed · quota_remaining=${r.quota_remaining_after}`)
}

async function testAtomicIdempotence() {
  // Re-call the RPC → must return already_paid=true, consumed=false, no side effect
  const { data: rawData } = await db.rpc('marketplace_consume_subscription_match', {
    p_match_id:        fx.matchId,
    p_subscription_id: fx.subscriptionId,
    p_buyer_id:        fx.buyerId,
  })
  const r = Array.isArray(rawData) ? rawData[0] : rawData
  const ok = r?.already_paid === true && r?.consumed === false
  log('rpc-idempotence', !!ok, `consumed=${r?.consumed} already_paid=${r?.already_paid}`)

  // Confirm quota was NOT double-incremented
  const { data: sub } = await db.from('marketplace_subscriptions').select('matches_used_this_period').eq('id', fx.subscriptionId).single()
  const ok2 = sub?.matches_used_this_period === 1
  log('rpc-no-double-consume', !!ok2, `used=${sub?.matches_used_this_period} (must be 1)`)
}

async function verifyPostPay() {
  const { data: match } = await db.from('marketplace_matches').select('status, identities_revealed_at').eq('id', fx.matchId).single()
  const ok1 = match?.status === 'paid' && match?.identities_revealed_at !== null
  log('verify-match-paid', !!ok1, `status=${match?.status} revealed_at=${match?.identities_revealed_at?.slice(0, 19) ?? 'null'}`)

  const { data: sub } = await db.from('marketplace_subscriptions').select('matches_used_this_period').eq('id', fx.subscriptionId).single()
  const ok2 = sub?.matches_used_this_period === 1
  log('verify-quota-consumed', !!ok2, `used=${sub?.matches_used_this_period}/3`)

  const { data: view } = await db.from('v_marketplace_my_offers').select('producer_user_id_revealed, buyer_user_id_revealed').eq('id', fx.matchId).single()
  const ok3 = view?.producer_user_id_revealed === fx.producerId && view?.buyer_user_id_revealed === fx.buyerId
  log('verify-identities-revealed', !!ok3, `producer=${view?.producer_user_id_revealed?.slice(0, 8) ?? 'null'} buyer=${view?.buyer_user_id_revealed?.slice(0, 8) ?? 'null'}`)

  const { data: rev } = await db.from('revenue_events').select('event_type, amount_eur').eq('id', `mp_fee_sub_${fx.matchId}`).single()
  const ok4 = rev?.event_type === 'marketplace_fee_subscription_consumed' && Number(rev?.amount_eur) === 0
  log('verify-revenue-event', !!ok4, `type=${rev?.event_type} amount=${rev?.amount_eur}`)
}

async function testIdempotence() {
  // Re-running revenue upsert should NOT create a duplicate
  const before = await db.from('revenue_events').select('id').eq('id', `mp_fee_sub_${fx.matchId}`)
  await db.from('revenue_events').upsert({
    id: `mp_fee_sub_${fx.matchId}`,
    product: 'feel-the-gap',
    event_type: 'marketplace_fee_subscription_consumed',
    user_id: fx.buyerId,
    amount_eur: 0,
    metadata: { re_run: true },
    created_at: new Date().toISOString(),
  }, { onConflict: 'id', ignoreDuplicates: true })
  const after = await db.from('revenue_events').select('id').eq('id', `mp_fee_sub_${fx.matchId}`)
  const ok = (before.data?.length ?? 0) === 1 && (after.data?.length ?? 0) === 1
  log('idempotence-revenue', ok, `before=${before.data?.length} after=${after.data?.length}`)
}

async function testPayPerActSkip() {
  const hasStripe = !!process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('REMPLACER')
  log('pay-per-act-check', !hasStripe, hasStripe
    ? 'STRIPE_SECRET_KEY present — pay-per-act path testable (not run in this E2E)'
    : 'STRIPE_SECRET_KEY absent (gate post-LLC Wyoming) — path skipped as expected')
}

async function cleanup() {
  try {
    if (fx.matchId) await db.from('marketplace_matches').delete().eq('id', fx.matchId)
    if (fx.volumeId) await db.from('production_volumes').delete().eq('id', fx.volumeId)
    if (fx.demandId) await db.from('buyer_demands').delete().eq('id', fx.demandId)
    if (fx.subscriptionId) await db.from('marketplace_subscriptions').delete().eq('id', fx.subscriptionId)
    if (fx.matchId) await db.from('revenue_events').delete().eq('id', `mp_fee_sub_${fx.matchId}`)
    // Demo users are reused — never delete
    log('cleanup', true, 'fixtures removed (demo users preserved)')
  } catch (e: any) {
    log('cleanup', false, e.message)
  }
}

async function main() {
  console.log(`🧘 E2E marketplace pay-fee — tag=${TAG}\n`)
  try {
    await setup()
    await testBillingMode()
    await simulatePayFee()
    await verifyPostPay()
    await testAtomicIdempotence()
    await testIdempotence()
    await testPayPerActSkip()
  } catch (e: any) {
    log('FATAL', false, e.message)
  } finally {
    await cleanup()
  }

  console.log('\n── Summary ──')
  const ok = steps.filter(s => s.ok).length
  const ko = steps.length - ok
  console.log(`${ok}/${steps.length} passed${ko ? ` · ${ko} failed` : ''}`)
  process.exit(ko ? 1 : 0)
}

main()
