/**
 * Feel The Gap — Funnel Tracking & Exit Feedback
 *
 * Tracks user journey through the demo/signup funnel.
 * Captures exit feedback non-intrusively when users leave.
 *
 * Funnel steps:
 *   landing → demo_start → demo_explore → demo_feature_X → signup_start →
 *   signup_complete → plan_view → plan_select → checkout → active_user
 *
 * Exit feedback: appears as a small, non-intrusive slide-up when user
 * shows exit intent (mouse leaves viewport, back button, idle 60s).
 */

import { createSupabaseBrowser } from '@/lib/supabase'

// ── Session ID (persists across page navigations) ──────────────────────────────
function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr'
  let id = sessionStorage.getItem('ftg_session')
  if (!id) {
    id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    sessionStorage.setItem('ftg_session', id)
  }
  return id
}

// ── Track funnel event ─────────────────────────────────────────────────────────
export function trackStep(step: string, action: string, metadata?: Record<string, any>) {
  if (typeof window === 'undefined') return

  const sessionId = getSessionId()

  // Fire and forget — never block the UI
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'funnel_step',
      properties: {
        session_id: sessionId,
        step,
        action,
        url: window.location.pathname,
        referrer: document.referrer,
        lang: localStorage.getItem('ftg_lang') ?? navigator.language,
        ...metadata,
      },
    }),
  }).catch(() => null)
}

// ── CTA configurations per step ────────────────────────────────────────────────
export const STEP_CTAS: Record<string, { text: string; textFr: string; href: string; color: string }> = {
  map: {
    text: 'See opportunities for this country →',
    textFr: 'Voir les opportunités de ce pays →',
    href: '/auth/register',
    color: '#C9A84C',
  },
  country: {
    text: 'Get the full AI business plan →',
    textFr: 'Obtenir le business plan IA complet →',
    href: '/auth/register?plan=standard',
    color: '#C9A84C',
  },
  reports: {
    text: 'Unlock all 337 opportunities →',
    textFr: 'Débloquer les 337 opportunités →',
    href: '/auth/register',
    color: '#34D399',
  },
  farming: {
    text: 'Scan your product — 30 seconds →',
    textFr: 'Scannez votre produit — 30 secondes →',
    href: '/auth/register?plan=standard',
    color: '#C9A84C',
  },
  catalog: {
    text: 'Browse 609 products from 30+ countries →',
    textFr: 'Parcourez 609 produits de 30+ pays →',
    href: '/auth/register',
    color: '#A78BFA',
  },
  deals: {
    text: 'Discover 206 investment opportunities →',
    textFr: 'Découvrez 206 opportunités d\'investissement →',
    href: '/auth/register?plan=premium',
    color: '#60A5FA',
  },
  pricing: {
    text: 'Start free — upgrade anytime →',
    textFr: 'Commencer gratuitement — upgrader à tout moment →',
    href: '/auth/register',
    color: '#34D399',
  },
}

// ── Exit feedback reasons (for the non-intrusive survey) ──────────────────────
export const EXIT_REASONS = [
  { key: 'not_ready', label: 'I\'m not ready yet', labelFr: 'Je ne suis pas prêt' },
  { key: 'too_expensive', label: 'Too expensive', labelFr: 'Trop cher' },
  { key: 'not_clear', label: 'I don\'t understand the value', labelFr: 'Je ne comprends pas la valeur' },
  { key: 'missing_feature', label: 'Missing a feature I need', labelFr: 'Il manque une fonctionnalité' },
  { key: 'my_product_not_here', label: 'My product/market isn\'t here', labelFr: 'Mon produit/marché n\'est pas ici' },
  { key: 'just_browsing', label: 'Just browsing', labelFr: 'Je regarde juste' },
  { key: 'will_return', label: 'I\'ll come back later', labelFr: 'Je reviendrai plus tard' },
]

// ── Submit exit feedback ──────────────────────────────────────────────────────
export function submitExitFeedback(data: {
  exitStep: string
  reason?: string
  feedbackText?: string
  wouldReturn?: boolean
  missingFeature?: string
  email?: string
}) {
  if (typeof window === 'undefined') return

  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'exit_feedback',
      properties: {
        session_id: getSessionId(),
        exit_step: data.exitStep,
        reason: data.reason,
        feedback_text: data.feedbackText,
        would_return: data.wouldReturn,
        missing_feature: data.missingFeature,
        email: data.email,
        url: window.location.pathname,
      },
    }),
  }).catch(() => null)
}

// ── Value propositions per persona (for micro-videos / benefit cards) ──────────
export const VALUE_PROPS = {
  entrepreneur: [
    { title: 'Find where to sell', titleFr: 'Trouvez où vendre', desc: '337 scored opportunities across 115 countries', icon: '🌍' },
    { title: 'AI business plans', titleFr: 'Business plans IA', desc: 'Complete Capex/Opex/ROI in 30 seconds', icon: '📊' },
    { title: '609 products in tension', titleFr: '609 produits en tension', desc: 'These products are imported — the demand exists', icon: '📦' },
    { title: 'Opportunity Farming', titleFr: 'Opportunity Farming', desc: 'Describe your product, AI finds your customers', icon: '🎯' },
  ],
  influenceur: [
    { title: '609 products to promote', titleFr: '609 produits à promouvoir', desc: 'Artisanal, terroir, cooperatives from 30+ countries', icon: '🛍️' },
    { title: '70% commission', titleFr: '70% de commission', desc: 'You keep 70%, platform takes 30%', icon: '💰' },
    { title: 'Tracked affiliate links', titleFr: 'Liens affiliés trackés', desc: 'Real-time clicks, conversions, revenue', icon: '🔗' },
    { title: 'Automatic payouts', titleFr: 'Paiements automatiques', desc: 'Stripe Connect, D+7 after conversion', icon: '⚡' },
  ],
  financeur: [
    { title: '206 vetted deal flows', titleFr: '206 deals qualifiés', desc: 'Pre-scored, data-backed investment opportunities', icon: '📋' },
    { title: '15 sectors covered', titleFr: '15 secteurs couverts', desc: 'Agrifood, fintech, energy, health, edtech...', icon: '🏢' },
    { title: 'AI risk assessment', titleFr: 'Évaluation des risques IA', desc: 'Market data + production costs + logistics', icon: '🔍' },
    { title: 'Direct deal rooms', titleFr: 'Salles de deal directes', desc: 'Connect with entrepreneurs, escrow ready', icon: '🤝' },
  ],
  investisseur: [
    { title: '206 investment opportunities', titleFr: '206 opportunités d\'investissement', desc: 'Seed to growth, €100K to €5M', icon: '📈' },
    { title: '30+ emerging markets', titleFr: '30+ marchés émergents', desc: 'Africa, LATAM, Southeast Asia, MENA', icon: '🌎' },
    { title: 'Impact metrics', titleFr: 'Métriques d\'impact', desc: 'Jobs created, carbon saved, SDG alignment', icon: '🌱' },
    { title: 'Portfolio construction', titleFr: 'Construction de portfolio', desc: 'Filter by sector, geography, stage, risk', icon: '🧩' },
  ],
}
