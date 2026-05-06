import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

/**
 * daily-content-dispatcher — auto-pumps the content_jobs queue per SaaS.
 *
 * For each of the 7 portfolio SaaS, ensures N "queued" content_jobs exist
 * with rotated personas / hooks / modes. The dedicated workflow
 * `content-daily-generate.yml` then picks them up and runs the cascade.
 *
 * Designed to be invoked by a cron (or PM2 loop) every day at 02:00 UTC,
 * just before the daily-generate workflow itself fires.
 */

import { createClient } from '@supabase/supabase-js'

const SAAS_LIST = [
  { slug: 'ftg', personas: ['entrepreneur', 'financeur'], hooks: [
    'Imagine waking up tomorrow with 10 buyers in 5 countries already booked.',
    'When customs broke our shipment, the AI rerouted it before noon.',
    'How we mapped a €40M trade flow nobody else noticed.',
  ]},
  { slug: 'ofa', personas: ['entrepreneur', 'influenceur'], hooks: [
    'Built a Shopify-killer site in 3 minutes. Roasted my own pricing in the next 2.',
    'Why 99% of e-commerce sites look the same — and the 1% that print money.',
    'I gave the AI my product photo. It built the brand around it.',
  ]},
  { slug: 'estate', personas: ['entrepreneur', 'investisseur'], hooks: [
    'Hotel ops are broken because nobody talks to the data.',
    'The boutique that doubled occupancy without raising prices.',
    'Why the smart concierge of 2026 is a piece of code.',
  ]},
  { slug: 'aici', personas: ['entrepreneur', 'investisseur'], hooks: [
    'Your competitor just shipped 3 features. Did you notice?',
    'The early-warning system every founder wishes they had.',
    'How we caught a competitor pivot 6 weeks before the press.',
  ]},
  { slug: 'aiplb', personas: ['investisseur', 'financeur'], hooks: [
    'A patent was filed 90 days ago. The market still has no clue.',
    'How patent flow predicts the next deep-tech rounds.',
    'Why the smartest IP funds bought the alerts, not the patents.',
  ]},
  { slug: 'ancf', personas: ['financeur'], hooks: [
    'Your contracts say one thing. Your reality says another.',
    'The AI that flagged a €2M discrepancy nobody saw.',
    'Compliance is not paperwork. It is a feed.',
  ]},
  { slug: 'hub', personas: ['entrepreneur', 'influenceur'], hooks: [
    'Seven SaaS products. One subscription. Cancel any tab anytime.',
    'Why building a portfolio beats building a single product.',
    'The cockpit that runs all my businesses from one card.',
  ]},
] as const

const MODES = ['regenerate', 'theme-variants'] as const
const TARGET_PER_SAAS_PER_DAY = parseInt(process.env.DAILY_TARGET_PER_SAAS ?? '3', 10)

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function existingPendingFor(slug: string): Promise<number> {
  const db = adminDb()
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const { count } = await db
    .from('content_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('inputs->>target_saas', slug)
    .in('status', ['queued', 'running'])
    .gte('created_at', today.toISOString())
  return count ?? 0
}

function pickRotated<T>(arr: readonly T[], offset: number): T {
  return arr[offset % arr.length]
}

async function enqueueOne(slug: string, persona: string, hook: string, mode: string): Promise<string | null> {
  const db = adminDb()
  const id = `dispatcher_${slug}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const { error } = await db.from('content_jobs').insert({
    id,
    workflow: 'daily-dispatcher',
    mode,
    status: 'queued',
    inputs: {
      mode,
      prompt: hook,
      persona,
      target_saas: slug,
      variants: 3,
    },
    triggered_by: 'cron://daily-content-dispatcher',
  })
  if (error) {
    console.error(`[dispatcher] enqueue error for ${slug}: ${error.message}`)
    return null
  }
  return id
}

async function main() {
  let totalEnqueued = 0
  for (const saas of SAAS_LIST) {
    const pending = await existingPendingFor(saas.slug)
    const need = Math.max(0, TARGET_PER_SAAS_PER_DAY - pending)
    if (need === 0) {
      console.log(`[dispatcher] ${saas.slug} OK (${pending}/${TARGET_PER_SAAS_PER_DAY} pending today)`)
      continue
    }
    const dayHash = Math.floor(Date.now() / 86_400_000)
    for (let i = 0; i < need; i++) {
      const persona = pickRotated(saas.personas, dayHash + i)
      const hook = pickRotated(saas.hooks, dayHash + i)
      const mode = pickRotated(MODES, dayHash + i)
      const id = await enqueueOne(saas.slug, persona, hook, mode)
      if (id) totalEnqueued++
      console.log(`[dispatcher] ${saas.slug} +1 (${persona}/${mode}) → ${id ?? 'FAILED'}`)
    }
  }
  console.log(`[dispatcher] DONE total_enqueued=${totalEnqueued} saas=${SAAS_LIST.length}`)
}

main().catch(err => {
  console.error('[dispatcher] fatal:', err)
  process.exit(1)
})
