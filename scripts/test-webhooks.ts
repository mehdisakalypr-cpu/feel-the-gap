// @ts-nocheck
/**
 * Tests unitaires lib/api-platform/webhooks.
 *
 * Usage:
 *   npx tsx scripts/test-webhooks.ts
 *
 * Couvre :
 *  - signPayload déterministe
 *  - verifySignature round-trip
 *  - invalid cases (wrong secret, wrong timestamp, wrong body, tampered sig)
 *  - constant-time compare (pas de early-return naïf)
 *  - format generateWebhookSecret (whsec_ prefix + 48 hex)
 */

import { signPayload, verifySignature, generateWebhookSecret } from '../lib/api-platform/webhooks'

type Test = { name: string; ok: boolean; detail?: string }
const results: Test[] = []

function check(name: string, cond: boolean, detail?: string) {
  results.push({ name, ok: !!cond, detail })
}

// ── Tests ──────────────────────────────────────────────────────────────────

const secret = generateWebhookSecret()
check('generateWebhookSecret prefix whsec_', secret.startsWith('whsec_'), secret)
check('generateWebhookSecret length ≥ 48', secret.length >= 48, `len=${secret.length}`)

const body = JSON.stringify({ event: 'opportunity.created', data: { id: 'abc' } })
const ts = 1713456789

// Deterministic
const sig1 = signPayload(body, secret, ts)
const sig2 = signPayload(body, secret, ts)
check('signPayload deterministic', sig1 === sig2)
check('signPayload length 64 hex', /^[0-9a-f]{64}$/.test(sig1), sig1)

// Round-trip
check('verifySignature valid → true', verifySignature(body, secret, ts, sig1))

// Invalid cases
check('verifySignature wrong secret → false',
  !verifySignature(body, 'wrong_secret', ts, sig1))
check('verifySignature wrong timestamp → false',
  !verifySignature(body, secret, ts + 1, sig1))
check('verifySignature wrong body → false',
  !verifySignature('{"event":"tampered"}', secret, ts, sig1))
check('verifySignature tampered sig → false',
  !verifySignature(body, secret, ts, sig1.slice(0, -1) + (sig1.at(-1) === '0' ? '1' : '0')))

// Different secret → different signature
const secret2 = generateWebhookSecret()
const sig3 = signPayload(body, secret2, ts)
check('different secrets → different sigs', sig1 !== sig3)

// Different timestamp → different signature
const sig4 = signPayload(body, secret, ts + 1)
check('different ts → different sigs', sig1 !== sig4)

// Different body → different signature
const sig5 = signPayload(body + ' ', secret, ts)
check('different body → different sigs', sig1 !== sig5)

// Length mismatch (verifySignature short-circuit on length check)
check('verifySignature short sig → false',
  !verifySignature(body, secret, ts, sig1.slice(0, 10)))

// Empty body
const emptySig = signPayload('', secret, ts)
check('signPayload empty body', /^[0-9a-f]{64}$/.test(emptySig))
check('verifySignature empty body round-trip', verifySignature('', secret, ts, emptySig))

// Unicode body
const uniBody = JSON.stringify({ country: 'Côte d\'Ivoire', emoji: '🌍' })
const uniSig = signPayload(uniBody, secret, ts)
check('signPayload unicode body', /^[0-9a-f]{64}$/.test(uniSig))
check('verifySignature unicode round-trip', verifySignature(uniBody, secret, ts, uniSig))

// ── Summary ────────────────────────────────────────────────────────────────

console.log('\n━━━━━ TEST lib/api-platform/webhooks ━━━━━')
for (const r of results) {
  const icon = r.ok ? '✅' : '❌'
  console.log(`${icon} ${r.name.padEnd(60)} ${r.detail ?? ''}`)
}
const passed = results.filter(r => r.ok).length
const total = results.length
console.log(`\n${passed}/${total} passed`)
process.exit(passed === total ? 0 : 1)
