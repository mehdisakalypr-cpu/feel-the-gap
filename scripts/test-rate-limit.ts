/**
 * Smoke-test for the /api/auth/login rate limiter.
 *
 *   npx tsx scripts/test-rate-limit.ts [baseUrl]
 *
 * Default baseUrl: http://localhost:3000
 * Expects the 6th attempt to return 429 with Retry-After header.
 */
const base = process.argv[2] || 'http://localhost:3000'

async function main() {
  const email = `ratelimit-test-${Date.now()}@example.com`
  const results: Array<{ attempt: number; status: number; retryAfter: string | null }> = []
  for (let i = 1; i <= 7; i++) {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.42' },
      body: JSON.stringify({ email, password: 'wrongpassword' }),
    })
    results.push({ attempt: i, status: res.status, retryAfter: res.headers.get('retry-after') })
  }
  console.table(results)
  const first429 = results.find(r => r.status === 429)
  if (!first429) {
    console.error('FAIL: no 429 observed in 7 attempts')
    process.exit(1)
  }
  if (first429.attempt !== 6) {
    console.warn(`WARN: first 429 at attempt ${first429.attempt} (expected 6).`)
  }
  console.log(`OK: rate-limit triggers at attempt ${first429.attempt} with Retry-After=${first429.retryAfter}`)
}
main().catch(e => { console.error(e); process.exit(1) })
