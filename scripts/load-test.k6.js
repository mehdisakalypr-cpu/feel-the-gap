/**
 * FTG load test — run pre-launch to validate scaling.
 *
 * Usage:
 *   k6 run scripts/load-test.k6.js
 *   k6 run --vus 100 --duration 60s scripts/load-test.k6.js
 *
 * Thresholds enforced:
 *   - p95 < 800ms on public routes
 *   - error rate < 1%
 */
import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE = __ENV.BASE_URL || 'https://www.gapup.io'

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // ramp-up to 20 VUs
    { duration: '60s', target: 50 },   // sustained 50 VUs
    { duration: '30s', target: 100 },  // spike to 100 VUs
    { duration: '30s', target: 0 },    // ramp-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
  },
}

const routes = [
  { path: '/',                  weight: 5 },
  { path: '/marketplace',       weight: 4 },
  { path: '/pricing',           weight: 3 },
  { path: '/reports/CIV',       weight: 2 },
  { path: '/api/health',        weight: 1 },
  { path: '/api/countries',     weight: 1 },
  { path: '/api/opportunities', weight: 1 },
]

const totalWeight = routes.reduce((s, r) => s + r.weight, 0)

function pickRoute() {
  let r = Math.random() * totalWeight
  for (const route of routes) {
    r -= route.weight
    if (r <= 0) return route.path
  }
  return routes[0].path
}

export default function () {
  const path = pickRoute()
  const res = http.get(`${BASE}${path}`, {
    headers: { 'User-Agent': 'k6-load-test/1.0 (FTG pre-launch)' },
    tags: { route: path },
  })
  check(res, {
    'status ok': (r) => r.status >= 200 && r.status < 400,
  })
  sleep(Math.random() * 2 + 0.5)
}
