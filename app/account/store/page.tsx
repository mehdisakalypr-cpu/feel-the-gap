// © 2025-2026 Feel The Gap — store onboarding / overview

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getOwnerContext, tierCanOwnStore } from './_lib/store-owner'
import { StoreOnboardingForm } from '@/components/store/StoreOnboardingForm'
import { ActivateButton } from '@/components/store/ActivateButton'

export const dynamic = 'force-dynamic'

export default async function StoreOverviewPage() {
  const ctx = await getOwnerContext()
  if (!ctx) redirect('/auth/login?redirect=/account/store')

  // Tier gate
  if (!tierCanOwnStore(ctx.tier)) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center">
        <div className="text-lg font-semibold text-white">Boutique e-commerce</div>
        <p className="mt-2 text-sm text-gray-300">
          La cr\u00e9ation d&apos;une boutique est r\u00e9serv\u00e9e aux abonn\u00e9s
          <span className="font-semibold text-amber-300"> Premium, Ultimate ou Custom</span>.
        </p>
        <p className="mt-1 text-xs text-gray-500">Tier actuel : <span className="font-mono">{ctx.tier}</span></p>
        <Link
          href="/pricing"
          className="mt-6 inline-block rounded-xl bg-[#C9A84C] px-5 py-2.5 text-sm font-bold text-[#07090F] hover:bg-[#E8C97A]"
        >
          Voir les plans \u2192
        </Link>
      </div>
    )
  }

  // Pas de store => onboarding
  if (!ctx.store) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-white">Cr\u00e9er ma boutique</h1>
          <p className="mt-2 text-sm text-gray-400">
            Choisissez un slug, votre mode de vente et signez les CGV FTG. Votre boutique sera cr\u00e9\u00e9e en mode brouillon.
            Vous pourrez l&apos;activer apr\u00e8s avoir compl\u00e9t\u00e9 vos mentions l\u00e9gales et activ\u00e9 la 2FA.
          </p>
        </header>
        <StoreOnboardingForm ownerEmail={ctx.user.email ?? ''} />
      </div>
    )
  }

  // Store existant : overview + checklist activation
  const s = ctx.store
  const checklist: { label: string; done: boolean; href?: string }[] = [
    { label: 'CGV FTG sign\u00e9es', done: !!s.cgv_signed_at },
    { label: 'Mentions l\u00e9gales compl\u00e8tes', done: s.legal_docs_complete, href: '/account/store/legal' },
    { label: 'Authentification \u00e0 deux facteurs (2FA)', done: s.twofa_enabled, href: '/account/store/settings' },
    { label: 'Au moins 1 produit en ligne', done: false, href: '/account/store/products' },
  ]
  const allReady = checklist.every(c => c.done)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Vue d&apos;ensemble</h1>
          <p className="mt-1 text-sm text-gray-400">
            Boutique <span className="font-mono text-gray-300">{s.slug}</span> \u2014 statut <strong className="text-white">{s.status}</strong>
          </p>
        </div>
        {s.status !== 'active' && (
          <ActivateButton disabled={!allReady} />
        )}
      </header>

      <section className="rounded-2xl border border-white/10 bg-[#0D1117] p-6">
        <h2 className="text-sm font-semibold text-white mb-3">Checklist activation</h2>
        <ul className="space-y-2">
          {checklist.map(c => (
            <li key={c.label} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
              <span className="flex items-center gap-2 text-sm">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                    c.done
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-white/5 text-gray-500'
                  }`}
                >
                  {c.done ? '\u2713' : '!'}
                </span>
                <span className={c.done ? 'text-gray-300' : 'text-gray-200'}>{c.label}</span>
              </span>
              {!c.done && c.href && (
                <Link href={c.href} className="text-xs text-[#C9A84C] hover:underline">
                  Compl\u00e9ter \u2192
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/account/store/products" className="rounded-2xl border border-white/10 bg-[#0D1117] p-5 hover:border-[#C9A84C]/30">
          <div className="text-xs uppercase tracking-wider text-gray-500">Catalogue</div>
          <div className="mt-1 text-base font-semibold text-white">G\u00e9rer mes produits</div>
        </Link>
        <Link href="/account/store/orders" className="rounded-2xl border border-white/10 bg-[#0D1117] p-5 hover:border-[#C9A84C]/30">
          <div className="text-xs uppercase tracking-wider text-gray-500">Ventes</div>
          <div className="mt-1 text-base font-semibold text-white">Voir mes commandes</div>
        </Link>
        <Link href="/account/store/dashboard" className="rounded-2xl border border-white/10 bg-[#0D1117] p-5 hover:border-[#C9A84C]/30">
          <div className="text-xs uppercase tracking-wider text-gray-500">Analytique</div>
          <div className="mt-1 text-base font-semibold text-white">Voir mon dashboard</div>
        </Link>
      </section>
    </div>
  )
}
