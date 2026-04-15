'use client'

import { useState } from 'react'
import type { Feature } from '@/lib/credits/tiers'
import { PLAN_PRICE_EUR, PLAN_MONTHLY_GRANT, TOPUP_PACKS } from '@/lib/credits/costs'

type Variant =
  | { kind: 'tier_locked'; requiredTier: 'starter' | 'premium'; feature: Feature }
  | { kind: 'insufficient_credits'; needed: number; balance: number }

export function PaywallModal({
  open,
  onClose,
  variant,
}: {
  open: boolean
  onClose: () => void
  variant: Variant
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        className="relative max-w-md w-full rounded-xl border border-white/10 bg-zinc-950 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-3 right-3 text-white/60 hover:text-white"
        >
          ✕
        </button>
        {variant.kind === 'tier_locked' ? (
          <TierLockedContent variant={variant} />
        ) : (
          <InsufficientCreditsContent variant={variant} />
        )}
      </div>
    </div>
  )
}

function TierLockedContent({
  variant,
}: {
  variant: Extract<Variant, { kind: 'tier_locked' }>
}) {
  const tier = variant.requiredTier
  const price = PLAN_PRICE_EUR[tier]
  const credits = PLAN_MONTHLY_GRANT[tier]
  const featureLabel: Record<Feature, string> = {
    map_view: 'Map monde',
    country_list: 'Liste pays',
    demo_bp: 'Demo BP',
    opportunity_detail: 'Détail opportunité',
    bp_generate: 'Business plan complet',
    training_youtube: 'Training hub YouTube',
    ecommerce_site_propose: 'Site e-commerce',
    client_list: 'Liste clients potentiels',
    client_contact_reveal: 'Révéler un contact client',
    site_creation: 'Création du site (clé en main)',
  }
  return (
    <div className="p-6">
      <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">
        🔒 Paywall · {tier === 'starter' ? 'Starter' : 'Premium'}
      </div>
      <h2 className="text-xl font-semibold mb-3">
        {featureLabel[variant.feature]} — réservé aux abonnés
      </h2>

      {tier === 'starter' && (
        <p className="text-sm text-white/70 mb-5">
          Passe <b>Starter</b> et débloque tous les détails d'opportunités, les business plans
          IA (15-30 pages), l'accès illimité au hub Training YouTube, et la proposition de
          site e-commerce.
        </p>
      )}
      {tier === 'premium' && (
        <p className="text-sm text-white/70 mb-5">
          Passe <b>Premium</b> et débloque la liste complète des clients potentiels avec
          coordonnées, plus la création de ton site e-commerce clé en main.
        </p>
      )}

      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 mb-3">
        <div className="flex items-baseline justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500 text-black font-semibold">
              Meilleur choix
            </span>
            <span className="font-medium">{tier === 'starter' ? 'Starter' : 'Premium'}</span>
          </div>
          <div className="text-2xl font-bold">€{price}<span className="text-sm text-white/50">/mo</span></div>
        </div>
        <ul className="text-sm text-white/80 space-y-1 mb-4">
          <li>• <b>{credits} crédits</b> inclus / mois</li>
          {tier === 'starter' && (
            <>
              <li>• Tous les détails d'opportunités (1 cr)</li>
              <li>• Business plans IA (10 cr, soit 6 BPs/mois inclus)</li>
              <li>• Training hub YouTube (inclus)</li>
              <li>• Proposer site e-commerce (inclus)</li>
            </>
          )}
          {tier === 'premium' && (
            <>
              <li>• Tout du Starter +</li>
              <li>• Liste clients potentiels (5 cr/contact)</li>
              <li>• Création site e-commerce clé en main</li>
              <li>• Support prioritaire</li>
            </>
          )}
        </ul>
        <a
          href={`/pricing?plan=${tier}`}
          className="block w-full text-center py-3 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-medium"
        >
          Souscrire €{price}/mo
        </a>
      </div>

      {variant.feature === 'bp_generate' && (
        <div className="mt-4">
          <div className="text-xs text-white/50 mb-2">Juste 1 BP ?</div>
          <a
            href="/credits/buy?pack=10"
            className="block w-full text-center py-2 rounded border border-white/20 text-sm text-white/80 hover:bg-white/5"
          >
            Acheter pack +10 crédits — €12 (1 BP)
          </a>
          <div className="text-xs text-white/40 mt-2 text-center">
            Subscription = €0.48/crédit · pack = €1.20/crédit
          </div>
        </div>
      )}
    </div>
  )
}

function InsufficientCreditsContent({
  variant,
}: {
  variant: Extract<Variant, { kind: 'insufficient_credits' }>
}) {
  return (
    <div className="p-6">
      <div className="text-xs uppercase tracking-widest text-amber-400 mb-2">
        ⚠️ Crédits insuffisants
      </div>
      <h2 className="text-xl font-semibold mb-2">Tu as {variant.balance} crédits</h2>
      <p className="text-sm text-white/70 mb-5">
        Cette action en demande <b>{variant.needed}</b>. Achète un pack ou passe à un
        tier supérieur pour plus de crédits inclus.
      </p>
      <div className="space-y-2 mb-4">
        {TOPUP_PACKS.map((p) => (
          <a
            key={p.size}
            href={`/credits/buy?pack=${p.size}`}
            className="flex items-center justify-between px-4 py-3 rounded border border-white/10 hover:border-emerald-500/50 hover:bg-white/5 transition"
          >
            <div>
              <div className="font-medium">+{p.size} crédits</div>
              <div className="text-xs text-white/50">€{p.unit.toFixed(2)}/crédit · valable 12 mois</div>
            </div>
            <div className="text-lg font-bold">€{p.price}</div>
          </a>
        ))}
      </div>
      <div className="pt-4 border-t border-white/10">
        <div className="text-xs text-white/50 mb-2">Ou pour plus d'autonomie :</div>
        <a
          href="/pricing"
          className="block w-full text-center py-3 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-medium"
        >
          Voir les abonnements (dès €29/mo, 60 crédits)
        </a>
      </div>
    </div>
  )
}
