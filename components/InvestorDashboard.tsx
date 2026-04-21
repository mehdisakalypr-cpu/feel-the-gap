'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { INVESTOR_TIER_LABEL, INVESTOR_TIER_QUOTA, type InvestorTierKey } from '@/lib/funding/investor-tiers'

// Shared dashboard rendered at /finance/dashboard and /invest/dashboard.
// Shows subscription state, quota usage, extra credits, and the pipeline of sent offers.

type Subscription = {
  tier: InvestorTierKey
  role_kind: 'financeur' | 'investisseur'
  status: string
  commitment_months: number
  founding_pioneer: boolean
  quota_month: number
  quota_used_month: number
  quota_period_start: string
  extra_credits: number
  renews_at: string | null
}

type SubscriptionPayload = {
  subscription: Subscription | null
  quota_remaining: number
  extra_credits: number
  can_make_offer: boolean
}

type Offer = {
  offer_id: string
  kind: 'funding' | 'investor'
  dossier_id: string
  dossier_public_number: number | null
  dossier_country: string | null
  dossier_type: 'financement' | 'investissement'
  dossier_amount_eur: number
  amount_eur: number
  status: 'sent' | 'accepted' | 'declined' | 'draft' | string
  refusal_reason_code: string | null
  refusal_reason_text: string | null
  quota_charged: boolean
  sent_at: string
  decided_at: string | null
}

interface Props {
  role: 'financeur' | 'investisseur'
  accentColor: string
  catalogHref: string
}

function fmtEur(n: number): string {
  if (!n && n !== 0) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' M€'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' k€'
  return n.toLocaleString('fr-FR') + ' €'
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  sent:     { bg: 'rgba(96,165,250,0.12)',  fg: '#60A5FA', label: 'Envoyée' },
  accepted: { bg: 'rgba(52,211,153,0.12)',  fg: '#34D399', label: 'Acceptée' },
  declined: { bg: 'rgba(239,68,68,0.12)',   fg: '#F87171', label: 'Refusée' },
  draft:    { bg: 'rgba(255,255,255,0.06)', fg: '#9CA3AF', label: 'Brouillon' },
}

const REFUSAL_LABEL: Record<string, string> = {
  ticket_too_low:    'Ticket trop bas',
  valuation_unfit:   'Valorisation inadaptée',
  not_aligned:       'Non aligné avec ma thèse',
  timing:            'Timing inadapté',
  terms_unfavorable: 'Termes défavorables',
  other:             'Autre',
}

export default function InvestorDashboard({ role, accentColor, catalogHref }: Props) {
  const [sub, setSub] = useState<SubscriptionPayload | null>(null)
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'sent' | 'accepted' | 'declined'>('all')

  useEffect(() => {
    Promise.all([
      fetch('/api/funding/investor/subscription').then(r => r.json()),
      fetch('/api/funding/investor/offers-history').then(r => r.json()),
    ]).then(([s, h]) => {
      if (!s.error) setSub(s as SubscriptionPayload)
      if (!h.error) setOffers((h.offers ?? []) as Offer[])
    }).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return offers
    return offers.filter((o) => o.status === filter)
  }, [offers, filter])

  const counts = useMemo(() => {
    const c = { all: offers.length, sent: 0, accepted: 0, declined: 0 }
    for (const o of offers) {
      if (o.status === 'sent') c.sent++
      else if (o.status === 'accepted') c.accepted++
      else if (o.status === 'declined') c.declined++
    }
    return c
  }, [offers])

  const subscription = sub?.subscription
  const quotaPct = subscription ? Math.round((subscription.quota_used_month / subscription.quota_month) * 100) : 0

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Mon pipeline</h1>
          <p className="text-sm text-gray-400 mt-1">
            Suivez vos offres envoyées, consultez votre quota et gérez votre abonnement.
          </p>
        </div>
        <Link href={catalogHref} className="px-5 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: accentColor, color: '#07090F' }}>
          Ouvrir le catalogue →
        </Link>
      </div>

      {/* Subscription card */}
      <div className="grid md:grid-cols-3 gap-5 mb-8">
        <div className="rounded-2xl p-5 md:col-span-2"
          style={{ background: '#0D1117', border: `1px solid ${accentColor}25` }}>
          {loading ? (
            <div className="text-sm text-gray-500">Chargement…</div>
          ) : !subscription ? (
            <div>
              <div className="text-sm text-gray-300 mb-3">
                Aucun abonnement actif. Vous voyez les dossiers en version anonymisée uniquement.
              </div>
              <Link href={`/pricing/funding?role=${role}`}
                className="inline-block px-5 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: accentColor, color: '#07090F' }}>
                Activer un abonnement →
              </Link>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs uppercase tracking-widest text-gray-500">Abonnement actif</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: accentColor + '20', color: accentColor }}>
                  {INVESTOR_TIER_LABEL[subscription.tier]}
                </span>
                {subscription.founding_pioneer && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)' }}>
                    👑 Founding Pioneer
                  </span>
                )}
                {subscription.commitment_months > 1 && (
                  <span className="text-[10px] text-gray-500">
                    {subscription.commitment_months} mois engagés
                  </span>
                )}
              </div>

              <div className="text-sm text-gray-400 mb-2">
                Quota mensuel : <span className="text-white font-bold">{subscription.quota_used_month}/{subscription.quota_month}</span>
                {subscription.extra_credits > 0 && (
                  <> · Crédits extra : <span className="text-[#C9A84C] font-bold">+{subscription.extra_credits}</span></>
                )}
              </div>

              <div className="w-full h-2 rounded-full overflow-hidden mb-2"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, quotaPct)}%`, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}aa)` }} />
              </div>

              <div className="flex items-center gap-3 mt-3">
                {subscription.quota_month - subscription.quota_used_month <= 0 && subscription.extra_credits === 0 && (
                  <Link href={`/pricing/funding?role=${role}`} className="text-xs font-bold hover:underline"
                    style={{ color: '#C9A84C' }}>
                    Acheter des acceptations supplémentaires →
                  </Link>
                )}
                <Link href="/account" className="text-xs text-gray-500 hover:text-white hover:underline">
                  Gérer l'abonnement
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl p-5 grid grid-cols-3 gap-3 text-center"
          style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.05)' }}>
          <Stat label="Envoyées" value={counts.sent} color="#60A5FA" />
          <Stat label="Acceptées" value={counts.accepted} color="#34D399" />
          <Stat label="Refusées" value={counts.declined} color="#F87171" />
        </div>
      </div>

      {/* Pipeline filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(['all', 'sent', 'accepted', 'declined'] as const).map((f) => {
          const active = filter === f
          const n = counts[f]
          const labels: Record<string, string> = { all: 'Tout', sent: 'Envoyées', accepted: 'Acceptées', declined: 'Refusées' }
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{
                background: active ? accentColor + '20' : 'rgba(255,255,255,0.04)',
                border: active ? `1px solid ${accentColor}60` : '1px solid rgba(255,255,255,0.08)',
                color: active ? accentColor : '#9CA3AF',
              }}>
              {labels[f]} <span className="opacity-60 ml-1">({n})</span>
            </button>
          )
        })}
      </div>

      {/* Pipeline list */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: '#0D1117' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl p-12 text-center"
          style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-4xl mb-2">📭</div>
          <div className="text-white font-semibold mb-1">Aucune offre {filter !== 'all' ? 'dans ce filtre' : 'encore'}</div>
          <div className="text-sm text-gray-500 mb-4">
            Parcourez le deal flow et envoyez vos premières propositions.
          </div>
          <Link href={catalogHref}
            className="inline-block px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: accentColor, color: '#07090F' }}>
            Ouvrir le catalogue →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const st = STATUS_STYLE[o.status] ?? STATUS_STYLE.draft
            const baseHref = o.dossier_type === 'financement' ? '/finance/reports' : '/invest/reports'
            return (
              <Link key={o.offer_id} href={`${baseHref}/${o.dossier_id}`}
                className="block rounded-2xl p-5 transition-all hover:-translate-y-0.5"
                style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                  <span className="font-bold text-white">Dossier #{o.dossier_public_number ?? '—'}</span>
                  {o.dossier_country && (
                    <span className="text-xs text-gray-500">🌍 {o.dossier_country}</span>
                  )}
                  <span className="text-xs text-gray-500">· {o.dossier_type}</span>
                  <div className="ml-auto text-right shrink-0">
                    <div className="text-[10px] text-gray-500 uppercase">Proposé</div>
                    <div className="text-lg font-bold" style={{ color: accentColor }}>{fmtEur(o.amount_eur)}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-3">
                  Envoyée le {new Date(o.sent_at).toLocaleDateString('fr-FR')}
                  {o.decided_at && <> · Décidée le {new Date(o.decided_at).toLocaleDateString('fr-FR')}</>}
                  {o.quota_charged && <> · Quota consommé</>}
                </div>
                {o.status === 'declined' && o.refusal_reason_code && (
                  <div className="mt-2 text-xs" style={{ color: '#F87171' }}>
                    Raison : {REFUSAL_LABEL[o.refusal_reason_code] ?? o.refusal_reason_code}
                    {o.refusal_reason_text && <span className="text-gray-500"> — « {o.refusal_reason_text} »</span>}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  )
}
