'use client'

// Lightweight client-side event tracker — stores in Supabase tracking_events
// No external dependency (no GA, no Mixpanel)

const SESSION_KEY = 'ftg_session'

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let sid = sessionStorage.getItem(SESSION_KEY)
  if (!sid) {
    sid = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, sid)
    // Register new session
    track('session_start', {})
  }
  return sid
}

export async function track(
  eventType: string,
  data: Record<string, unknown>,
  page?: string,
) {
  if (typeof window === 'undefined') return

  const sid = getSessionId()
  const payload = {
    session_id: sid,
    event_type: eventType,
    event_data: data,
    page: page ?? window.location.pathname,
  }

  try {
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Fire-and-forget — don't block UI
      keepalive: true,
    })
  } catch {
    // Never throw — tracking must never break the app
  }
}

// ── Convenience helpers ───────────────────────────────────────────────────────

export const trackPageView = (page: string) =>
  track('page_view', { page })

export const trackCountryClick = (iso: string, name: string) =>
  track('country_click', { country: iso, name })

export const trackFilter = (category: string, subcategory?: string) =>
  track('filter', { category, subcategory })

export const trackSearch = (query: string) =>
  track('search', { query })

export const trackPlanView = (iso: string, product: string, planType: string) =>
  track('plan_view', { country: iso, product, plan: planType })

export const trackUpgradeClick = (tier: string, source: string) =>
  track('upgrade_click', { tier, source })

export const trackDemoStep = (step: number, stepName: string) =>
  track('demo_step', { step, name: stepName })
