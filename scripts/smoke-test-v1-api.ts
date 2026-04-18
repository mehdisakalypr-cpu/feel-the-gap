// @ts-nocheck
/**
 * Smoke test du V1 API — Vague 3 #7 validation · 2026-04-18
 *
 * Procedure :
 *  1. Génère un token éphémère (tier sovereign pour éviter rate-limit)
 *  2. Hit /v1/opportunities, /v1/countries, /v1/products, /v1/openapi.json
 *  3. Vérifie status 200 + présence headers X-RateLimit-* + body non vide
 *  4. Teste le cas 401 sans token
 *  5. Révoque le token puis vérifie 401 avec ce token
 *  6. Supprime le token DB en fin de run (cleanup)
 *
 * Usage :
 *   npx tsx scripts/smoke-test-v1-api.ts
 *   npx tsx scripts/smoke-test-v1-api.ts --base=https://feel-the-gap.com
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { generateToken } from '../lib/api-platform/auth'

// load .env.local
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

const argv = process.argv.slice(2)
const BASE = argv.find(a => a.startsWith('--base='))?.split('=')[1] || 'http://localhost:3000'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

type TestResult = { name: string; ok: boolean; detail: string }
const results: TestResult[] = []

async function setupToken(): Promise<{ id: string; token: string } | null> {
  // On a besoin d'un owner_id existant — on cherche n'importe quel user
  const { data: users } = await db.from('profiles').select('id').limit(1)
  const ownerId = users?.[0]?.id
  if (!ownerId) {
    console.error('[smoke] Aucun user profiles en DB, impossible de créer un token')
    return null
  }

  const { token, prefix, hash } = generateToken()
  const { data, error } = await db.from('api_tokens').insert({
    owner_id: ownerId,
    name: '_smoke_test_' + Date.now(),
    token_prefix: prefix,
    token_hash: hash,
    tier: 'sovereign',
    rate_limit_per_min: 3000,
    rate_limit_per_day: 10_000_000,
    permissions: ['opportunities:read', 'countries:read', 'products:read'],
  }).select('id').single()

  if (error || !data) {
    console.error('[smoke] Erreur création token :', error?.message)
    return null
  }
  return { id: data.id, token }
}

async function teardownToken(id: string): Promise<void> {
  await db.from('api_tokens').delete().eq('id', id)
}

async function hit(path: string, token?: string): Promise<{ status: number; headers: Headers; body: any }> {
  const headers: Record<string, string> = {}
  if (token) headers['authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, { headers })
  const body = await res.json().catch(() => null)
  return { status: res.status, headers: res.headers, body }
}

async function main() {
  console.log(`[smoke] Target : ${BASE}`)

  // OpenAPI spec (non-auth)
  {
    const r = await hit('/api/v1/openapi')
    results.push({
      name: '/api/v1/openapi (public)',
      ok: r.status === 200 && r.body?.openapi === '3.1.0',
      detail: `status=${r.status} title=${r.body?.info?.title ?? 'missing'}`,
    })
  }

  // 401 sans token
  {
    const r = await hit('/api/v1/opportunities?limit=1')
    results.push({
      name: '/api/v1/opportunities sans token → 401',
      ok: r.status === 401,
      detail: `status=${r.status}`,
    })
  }

  // Crée un token
  const tok = await setupToken()
  if (!tok) {
    results.push({ name: 'setup token', ok: false, detail: 'échec insert' })
    summary()
    return
  }
  results.push({ name: 'setup token sovereign', ok: true, detail: `id=${tok.id.slice(0, 8)}` })

  // Opportunities
  {
    const r = await hit('/api/v1/opportunities?limit=3', tok.token)
    const hasRL = r.headers.get('x-ratelimit-tier') === 'sovereign'
    results.push({
      name: '/api/v1/opportunities (authed)',
      ok: r.status === 200 && r.body?.ok === true && Array.isArray(r.body?.items) && hasRL,
      detail: `status=${r.status} count=${r.body?.count ?? '?'} items=${r.body?.items?.length ?? 0} tier=${r.headers.get('x-ratelimit-tier')}`,
    })
  }

  // Countries
  {
    const r = await hit('/api/v1/countries?limit=3', tok.token)
    results.push({
      name: '/api/v1/countries (authed)',
      ok: r.status === 200 && Array.isArray(r.body?.items) && r.body.items.length > 0,
      detail: `status=${r.status} count=${r.body?.count} first=${r.body?.items?.[0]?.id ?? '?'}`,
    })
  }

  // Products
  {
    const r = await hit('/api/v1/products?limit=3', tok.token)
    results.push({
      name: '/api/v1/products (authed)',
      ok: r.status === 200 && Array.isArray(r.body?.items) && r.body.items.length > 0,
      detail: `status=${r.status} count=${r.body?.count} first=${r.body?.items?.[0]?.name ?? '?'}`,
    })
  }

  // Scope test : token avec scope countries:read only (créons-en un autre)
  {
    const { token: t2, prefix, hash } = generateToken()
    const { data } = await db.from('api_tokens').insert({
      owner_id: (await db.from('profiles').select('id').limit(1).single()).data?.id,
      name: '_smoke_test_scoped_' + Date.now(),
      token_prefix: prefix,
      token_hash: hash,
      tier: 'starter',
      rate_limit_per_min: 30,
      rate_limit_per_day: 10_000,
      permissions: ['countries:read'],
    }).select('id').single()

    const r = await hit('/api/v1/opportunities?limit=1', t2)
    const okForbidden = r.status === 403
    results.push({
      name: 'Scope check : starter+countries uniquement → 403 sur /opportunities',
      ok: okForbidden,
      detail: `status=${r.status}`,
    })
    if (data?.id) await db.from('api_tokens').delete().eq('id', data.id)
  }

  // Revoke token puis vérifier 401
  {
    await db.from('api_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', tok.id)
    const r = await hit('/api/v1/countries?limit=1', tok.token)
    results.push({
      name: 'Token révoqué → 401',
      ok: r.status === 401,
      detail: `status=${r.status}`,
    })
  }

  // Cleanup
  await teardownToken(tok.id)
  results.push({ name: 'cleanup', ok: true, detail: 'token supprimé' })

  summary()
}

function summary() {
  console.log('\n━━━━━ SMOKE TEST V1 API ━━━━━')
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌'
    console.log(`${icon} ${r.name.padEnd(60)} ${r.detail}`)
  }
  const passed = results.filter(r => r.ok).length
  const total = results.length
  console.log(`\n${passed}/${total} passed`)
  process.exit(passed === total ? 0 : 1)
}

main().catch(err => {
  console.error('[smoke] fatal:', err)
  process.exit(1)
})
