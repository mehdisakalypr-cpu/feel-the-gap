'use client'
import { useMemo, useState } from 'react'
import { PaywallModal } from '@/components/PaywallModal'
import { BUYER_REVEAL_COST_CREDITS } from '@/lib/credits/costs'
import type { PlanTier } from '@/lib/credits/costs'

type Buyer = {
  id: string; name: string; buyer_type: string; city: string | null; address: string | null;
  website_url: string | null; email: string | null; phone: string | null; whatsapp: string | null;
  contact_name: string | null; product_slugs: string[];
  annual_volume_mt_min: number | null; annual_volume_mt_max: number | null;
  quality_requirements: string | null; certifications_required: string[] | null;
  confidence_score: number | null; verified: boolean; notes: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  industriel: 'Industriel', grossiste: 'Grossiste', centrale_achats: 'Centrale d\'achats',
  transformateur: 'Transformateur', distributeur: 'Distributeur', horeca: 'HORECA',
  export_trader: 'Trader export',
}

const TYPE_COLOR: Record<string, string> = {
  industriel: '#3B82F6', grossiste: '#10B981', centrale_achats: '#8B5CF6',
  transformateur: '#F59E0B', distributeur: '#06B6D4', horeca: '#EF4444',
  export_trader: '#EC4899',
}

type BuyersListProps = {
  buyers: Buyer[]
  /** ISO pays courant — utilisé par l'API reveal pour valider la portée. */
  iso?: string
  /** Tier user — drive le quota inclus + l'upsell. */
  userTier?: PlanTier
  /** Crédits Fill-the-Gap dispo (live, mis à jour après reveal). */
  userCredits?: number
  /**
   * Top-N buyers révélés automatiquement (inclus dans le tier).
   * `null` = illimité (ultimate/custom). `0` = aucun (free/starter).
   */
  quotaIncluded?: number | null
  /** Set des buyer_ids déjà débloqués pour ce user (persistés en DB). */
  revealedSet?: Set<string>
}

type RevealResp =
  | { ok: true; revealed: string[]; balance: number; debited: number }
  | { ok: false; error: string; balance?: number; needed?: number }

export default function BuyersList({
  buyers,
  iso,
  userTier = 'free',
  userCredits = 0,
  quotaIncluded = 0,
  revealedSet,
}: BuyersListProps) {
  const [filter, setFilter] = useState<string>('all')
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set(revealedSet ?? []))
  const [credits, setCredits] = useState<number>(userCredits)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [paywallVariant, setPaywallVariant] = useState<
    | { kind: 'tier_locked'; requiredTier: PlanTier; feature: 'client_contact_reveal' }
    | { kind: 'insufficient_credits'; needed: number; balance: number }
    | null
  >(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const types = Array.from(new Set(buyers.map(b => b.buyer_type)))
  const filtered = filter === 'all' ? buyers : buyers.filter(b => b.buyer_type === filter)

  // Map id -> rang global (basé sur l'ordre fourni par le serveur, déjà trié par
  // verified desc puis confidence_score desc). On utilise ce rang pour appliquer
  // le quota inclus du tier, indépendamment du filtre actif.
  const rankById = useMemo(() => {
    const m = new Map<string, number>()
    buyers.forEach((b, i) => m.set(b.id, i))
    return m
  }, [buyers])

  function isWithinIncludedQuota(buyer: Buyer): boolean {
    if (quotaIncluded === null) return true // illimité
    const rank = rankById.get(buyer.id) ?? Infinity
    return rank < quotaIncluded
  }

  function isRevealed(buyer: Buyer): boolean {
    return isWithinIncludedQuota(buyer) || revealed.has(buyer.id)
  }

  function costFor(buyer: Buyer): number {
    return buyer.verified
      ? BUYER_REVEAL_COST_CREDITS.verified
      : BUYER_REVEAL_COST_CREDITS.basic
  }

  const lockedFiltered = filtered.filter(b => !isRevealed(b))
  const selectionCost = useMemo(
    () => filtered.filter(b => selected.has(b.id)).reduce((acc, b) => acc + costFor(b), 0),
    [filtered, selected],
  )

  function openPaywallForBuyer(buyer: Buyer) {
    // Si user n'a pas accès au feature client_contact_reveal (free/starter), tier-lock.
    // Le minimum tier pour le reveal est 'strategy' (cf FEATURE_ACCESS).
    const tierBlocked =
      userTier === 'free' || userTier === 'solo_producer' || userTier === 'starter'
    if (tierBlocked) {
      setPaywallVariant({
        kind: 'tier_locked',
        requiredTier: 'strategy',
        feature: 'client_contact_reveal',
      })
      setPaywallOpen(true)
      return
    }
    const cost = costFor(buyer)
    if (credits < cost) {
      setPaywallVariant({
        kind: 'insufficient_credits',
        needed: cost,
        balance: credits,
      })
      setPaywallOpen(true)
      return
    }
    // Sinon : on bascule en mode sélection multiple, pré-sélectionne le buyer cliqué.
    setSelecting(true)
    setSelected(prev => {
      const n = new Set(prev)
      n.add(buyer.id)
      return n
    })
  }

  function toggleSelected(buyerId: string) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(buyerId)) n.delete(buyerId)
      else n.add(buyerId)
      return n
    })
  }

  async function submitSelection() {
    if (selected.size === 0) return
    if (credits < selectionCost) {
      setPaywallVariant({
        kind: 'insufficient_credits',
        needed: selectionCost,
        balance: credits,
      })
      setPaywallOpen(true)
      return
    }
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/buyers/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer_ids: Array.from(selected),
          ...(iso ? { iso } : {}),
        }),
      })
      const data = (await res.json()) as RevealResp
      if (!res.ok || !('ok' in data) || !data.ok) {
        if (
          res.status === 402 &&
          'balance' in data &&
          'needed' in data &&
          typeof data.balance === 'number' &&
          typeof data.needed === 'number'
        ) {
          setPaywallVariant({
            kind: 'insufficient_credits',
            needed: data.needed,
            balance: data.balance,
          })
          setPaywallOpen(true)
          return
        }
        setErrorMsg(
          'error' in data && typeof data.error === 'string'
            ? `Erreur : ${data.error}`
            : 'Erreur lors du déblocage.',
        )
        return
      }
      // Succès : merge revealed, update credits, exit selection mode.
      setRevealed(prev => {
        const n = new Set(prev)
        for (const id of data.revealed) n.add(id)
        return n
      })
      setCredits(data.balance)
      setSelected(new Set())
      setSelecting(false)
    } catch {
      setErrorMsg('Erreur réseau lors du déblocage.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {types.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold ${filter === 'all' ? 'bg-white/20' : 'bg-white/5 border border-white/10'}`}>
            Tous ({buyers.length})
          </button>
          {types.map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`px-3 py-1 rounded-full text-xs font-semibold ${filter === t ? 'text-black' : 'text-white bg-white/5 border border-white/10'}`}
              style={filter === t ? { background: TYPE_COLOR[t] ?? '#C9A84C' } : {}}>
              {TYPE_LABEL[t] ?? t} ({buyers.filter(b => b.buyer_type === t).length})
            </button>
          ))}
        </div>
      )}

      {/* Action bar: counts + selection mode */}
      {lockedFiltered.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#C9A84C]/30 bg-[#C9A84C]/5 p-3 text-xs">
          <div className="text-white/80">
            {lockedFiltered.length} client{lockedFiltered.length > 1 ? 's' : ''} verrouillé{lockedFiltered.length > 1 ? 's' : ''} ·{' '}
            <span className="text-[#C9A84C] font-semibold">{credits} crédits</span> disponibles
          </div>
          {!selecting ? (
            <button
              onClick={() => setSelecting(true)}
              className="ml-auto px-3 py-1.5 rounded-md bg-[#C9A84C] text-black font-semibold hover:bg-[#E8C97A]"
            >
              Sélectionner plusieurs clients
            </button>
          ) : (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-white/70">
                {selected.size} sélectionné{selected.size > 1 ? 's' : ''} · {selectionCost} crédits
              </span>
              <button
                onClick={() => { setSelecting(false); setSelected(new Set()); setErrorMsg(null) }}
                disabled={submitting}
                className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white"
              >
                Annuler
              </button>
              <button
                onClick={submitSelection}
                disabled={submitting || selected.size === 0}
                className="px-3 py-1.5 rounded-md bg-[#C9A84C] text-black font-semibold hover:bg-[#E8C97A] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Déblocage…' : `Valider ma sélection (${selectionCost} cr)`}
              </button>
            </div>
          )}
        </div>
      )}
      {errorMsg && (
        <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(b => {
          const revealedNow = isRevealed(b)
          const cost = costFor(b)
          const isSelected = selected.has(b.id)
          return (
            <div
              key={b.id}
              className={`relative rounded-xl border bg-white/5 p-4 transition-colors ${
                revealedNow
                  ? 'border-white/10 hover:border-white/25'
                  : 'border-[#C9A84C]/30 hover:border-[#C9A84C]/60'
              } ${isSelected ? 'ring-2 ring-[#C9A84C]' : ''}`}
            >
              <BuyerCard buyer={b} blurred={!revealedNow} />

              {!revealedNow && (
                <BuyerLockOverlay
                  cost={cost}
                  selecting={selecting}
                  isSelected={isSelected}
                  verified={b.verified}
                  onClickReveal={() => openPaywallForBuyer(b)}
                  onToggleSelect={() => toggleSelected(b.id)}
                />
              )}
            </div>
          )
        })}
      </div>

      {paywallOpen && paywallVariant && (
        <PaywallModal
          open={paywallOpen}
          onClose={() => setPaywallOpen(false)}
          variant={paywallVariant}
        />
      )}
    </div>
  )
}

/** Carte d'un buyer — contenu identique à l'ancienne version, blur conditionnel. */
function BuyerCard({ buyer: b, blurred }: { buyer: Buyer; blurred: boolean }) {
  return (
    <div
      style={
        blurred
          ? { filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }
          : undefined
      }
      aria-hidden={blurred}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <b className="text-sm">{b.name}</b>
            {b.verified && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">✓ vérifié</span>}
          </div>
          <div className="text-[11px] uppercase tracking-wider opacity-60 mt-1" style={{ color: TYPE_COLOR[b.buyer_type] ?? undefined }}>
            {TYPE_LABEL[b.buyer_type] ?? b.buyer_type}
            {b.city && <span className="opacity-80"> · {b.city}</span>}
          </div>
        </div>
      </div>

      {b.product_slugs?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {b.product_slugs.slice(0, 5).map(p => (
            <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10">{p}</span>
          ))}
        </div>
      )}

      {(b.annual_volume_mt_min || b.annual_volume_mt_max) && (
        <div className="text-xs opacity-80 mb-1">
          Volume : {b.annual_volume_mt_min ?? '?'}{b.annual_volume_mt_max ? `-${b.annual_volume_mt_max}` : '+'} MT/an
        </div>
      )}
      {b.quality_requirements && <div className="text-xs opacity-70 mb-1">Qualité : {b.quality_requirements}</div>}

      <div className="flex flex-wrap gap-2 mt-3 text-xs">
        {b.website_url && <a href={b.website_url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10">🔗 Site</a>}
        {b.email && <a href={`mailto:${b.email}`} className="px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10">✉️ Email</a>}
        {b.phone && <a href={`tel:${b.phone}`} className="px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10">📞 {b.phone}</a>}
        {b.whatsapp && <a href={`https://wa.me/${b.whatsapp.replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 hover:bg-[#25D366]/30">💬 WhatsApp</a>}
      </div>

      {b.notes && <div className="text-[11px] opacity-50 mt-2 line-clamp-2">{b.notes}</div>}

      {!b.verified && b.confidence_score !== null && (
        <div className="text-[10px] opacity-40 mt-2">Confiance : {Math.round((b.confidence_score ?? 0) * 100)}% · à vérifier</div>
      )}
    </div>
  )
}

/** Overlay verrou : 2 modes — single-click reveal (paywall) OU checkbox (sélection). */
function BuyerLockOverlay({
  cost,
  selecting,
  isSelected,
  verified,
  onClickReveal,
  onToggleSelect,
}: {
  cost: number
  selecting: boolean
  isSelected: boolean
  verified: boolean
  onClickReveal: () => void
  onToggleSelect: () => void
}) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center rounded-xl"
      style={{ background: 'rgba(7, 9, 15, 0.55)', backdropFilter: 'blur(1px)' }}
    >
      {selecting ? (
        <button
          type="button"
          onClick={onToggleSelect}
          className="flex flex-col items-center gap-2 px-5 py-3 rounded-lg bg-[#07090F]/85 border border-[#C9A84C]/40 hover:border-[#C9A84C]"
          aria-pressed={isSelected}
          aria-label={isSelected ? 'Désélectionner ce client' : `Sélectionner ce client (${cost} crédits)`}
        >
          <span
            className={`w-6 h-6 rounded border-2 flex items-center justify-center text-xs font-bold ${
              isSelected
                ? 'bg-[#C9A84C] border-[#C9A84C] text-black'
                : 'border-white/40 text-transparent'
            }`}
          >
            ✓
          </span>
          <span className="text-[11px] text-white/80">
            {cost} crédit{cost > 1 ? 's' : ''} {verified ? '· vérifié' : ''}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onClickReveal}
          className="flex flex-col items-center gap-1.5 px-5 py-3 rounded-lg bg-[#07090F]/85 border border-[#C9A84C]/40 hover:border-[#C9A84C] hover:bg-[#07090F]/95"
        >
          <span className="text-xl">🔒</span>
          <span className="text-xs font-semibold text-white">
            Découvrir ce client pour {cost} crédit{cost > 1 ? 's' : ''}
          </span>
          {verified && <span className="text-[10px] text-emerald-300">contact vérifié</span>}
        </button>
      )}
    </div>
  )
}
