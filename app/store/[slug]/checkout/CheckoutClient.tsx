// © 2025-2026 Feel The Gap — multi-step checkout client (account → addr → ship → pay)
'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckoutSteps } from '@/components/store-public/CheckoutSteps'
import { PaymentForm } from '@/components/store-public/PaymentForm'
import { fmtMoney, type CartTotals } from '@/components/store-public/_lib'

interface AddressUI {
  id: string
  label: string | null
  full_name: string
  company: string | null
  line1: string
  line2: string | null
  postal_code: string
  city: string
  state: string | null
  country_iso2: string
  phone: string | null
  type: string
  is_default: boolean
}

interface ZoneUI {
  id: string
  name: string
  country_codes: string[]
}

interface RateUI {
  id: string
  zone_id: string
  name: string
  carrier: string | null
  price_cents: number
  free_above_cents: number | null
  delivery_days_min: number | null
  delivery_days_max: number | null
}

interface AddressDraft {
  full_name: string
  company: string
  line1: string
  line2: string
  postal_code: string
  city: string
  country_iso2: string
  phone: string
}

interface Props {
  storeSlug: string
  storeAccent: string
  isLoggedIn: boolean
  buyerEmail: string | null
  addresses: AddressUI[]
  zones: ZoneUI[]
  rates: RateUI[]
  initialStep: number
  cartTotals: CartTotals
  itemCount: number
}

const EMPTY_DRAFT: AddressDraft = {
  full_name: '',
  company: '',
  line1: '',
  line2: '',
  postal_code: '',
  city: '',
  country_iso2: 'FR',
  phone: '',
}

export function CheckoutClient(props: Props) {
  const router = useRouter()
  const [step, setStep] = useState<number>(props.initialStep)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Step 1 — account / guest email
  const [guestEmail, setGuestEmail] = useState<string>(props.buyerEmail ?? '')
  const [mode, setMode] = useState<'guest' | 'login'>(props.isLoggedIn ? 'login' : 'guest')

  // Step 2 — addresses
  const [shipAddrId, setShipAddrId] = useState<string | null>(props.addresses[0]?.id ?? null)
  const [billAddrId, setBillAddrId] = useState<string | null>(props.addresses[0]?.id ?? null)
  const [shipDraft, setShipDraft] = useState<AddressDraft>({ ...EMPTY_DRAFT })
  const [billDraft, setBillDraft] = useState<AddressDraft>({ ...EMPTY_DRAFT })
  const [billSameAsShip, setBillSameAsShip] = useState(true)

  // Step 3 — shipping rate
  const [rateId, setRateId] = useState<string | null>(null)

  // Step 4 — payment intent
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

  function readDiscountCookie(): string | null {
    if (typeof document === 'undefined') return null
    const m = document.cookie.match(/(?:^|; )ftg_discount_code=([^;]+)/)
    return m ? decodeURIComponent(m[1]) : null
  }

  function getShippingPayload() {
    if (shipAddrId) return { address_id: shipAddrId }
    return { draft: shipDraft }
  }
  function getBillingPayload() {
    if (billSameAsShip) return getShippingPayload()
    if (billAddrId) return { address_id: billAddrId }
    return { draft: billDraft }
  }

  function validateDraft(d: AddressDraft): string | null {
    if (!d.full_name.trim()) return 'Nom complet requis'
    if (!d.line1.trim()) return 'Adresse requise'
    if (!d.postal_code.trim()) return 'Code postal requis'
    if (!d.city.trim()) return 'Ville requise'
    if (!d.country_iso2.trim() || d.country_iso2.length !== 2) return 'Pays requis (code ISO2)'
    return null
  }

  const goNext = () => {
    setError(null)
    if (step === 0) {
      if (mode === 'guest' && (!guestEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guestEmail))) {
        setError('Email valide requis pour passer commande.')
        return
      }
      setStep(1)
      return
    }
    if (step === 1) {
      if (!shipAddrId) {
        const e = validateDraft(shipDraft)
        if (e) { setError(e); return }
      }
      if (!billSameAsShip && !billAddrId) {
        const e = validateDraft(billDraft)
        if (e) { setError(`Facturation : ${e}`); return }
      }
      setStep(2)
      return
    }
    if (step === 2) {
      if (!rateId) { setError('Choisissez une méthode de livraison.'); return }
      void createIntent()
      return
    }
  }

  const createIntent = async () => {
    setError(null)
    setBusy(true)
    try {
      const body = {
        email: props.buyerEmail || guestEmail,
        shipping: getShippingPayload(),
        billing: getBillingPayload(),
        rate_id: rateId,
        discount_code: readDiscountCookie(),
      }
      const res = await fetch(`/api/store/${encodeURIComponent(props.storeSlug)}/checkout/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((j as { error?: string }).error || 'Impossible de préparer le paiement.')
        return
      }
      setClientSecret(String((j as { client_secret?: string }).client_secret || ''))
      setOrderId(String((j as { order_id?: string }).order_id || ''))
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="md:hidden">
        <CheckoutSteps current={step} />
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {step === 0 && (
        <div className="space-y-4 rounded-2xl border border-white/5 bg-[#0D1117] p-6">
          <h2 className="text-lg font-semibold text-white">Identification</h2>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`rounded-lg px-3 py-1.5 ${mode === 'login' ? 'bg-[#C9A84C] text-[#07090F]' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
            >
              Me connecter
            </button>
            <button
              type="button"
              onClick={() => setMode('guest')}
              className={`rounded-lg px-3 py-1.5 ${mode === 'guest' ? 'bg-[#C9A84C] text-[#07090F]' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
            >
              Continuer en invité
            </button>
          </div>

          {mode === 'login' ? (
            <div className="space-y-3 text-sm text-gray-300">
              <p>Connectez-vous pour réutiliser vos adresses et accéder à l&apos;historique de vos commandes.</p>
              <Link
                href={`/store/${props.storeSlug}/account/login?redirect=${encodeURIComponent(`/store/${props.storeSlug}/checkout?step=1`)}`}
                className="inline-block rounded-xl bg-[#C9A84C] px-5 py-2.5 text-sm font-bold text-[#07090F]"
              >
                Aller à la connexion →
              </Link>
              <div className="text-xs text-gray-500">
                Pas encore de compte ?{' '}
                <Link
                  href={`/store/${props.storeSlug}/account/register?redirect=${encodeURIComponent(`/store/${props.storeSlug}/checkout?step=1`)}`}
                  className="text-[#C9A84C] hover:underline"
                >
                  Créer un compte
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Email</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={guestEmail}
                  onChange={e => setGuestEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-sm text-white focus:border-[#C9A84C] focus:outline-none"
                  placeholder="vous@exemple.com"
                />
              </label>
              <p className="text-[10px] text-gray-500">
                Nous utilisons votre email pour la confirmation de commande et la facture.
              </p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={goNext}
              className="rounded-xl bg-[#C9A84C] px-5 py-2.5 text-sm font-bold text-[#07090F]"
            >
              Continuer →
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 rounded-2xl border border-white/5 bg-[#0D1117] p-6">
          <h2 className="text-lg font-semibold text-white">Adresses</h2>

          <AddressBlock
            title="Adresse de livraison"
            addresses={props.addresses}
            selectedId={shipAddrId}
            onSelect={setShipAddrId}
            draft={shipDraft}
            onDraftChange={setShipDraft}
          />

          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={billSameAsShip}
              onChange={e => setBillSameAsShip(e.target.checked)}
              className="rounded border-white/10 bg-[#111827]"
            />
            Même adresse pour la facturation
          </label>

          {!billSameAsShip && (
            <AddressBlock
              title="Adresse de facturation"
              addresses={props.addresses}
              selectedId={billAddrId}
              onSelect={setBillAddrId}
              draft={billDraft}
              onDraftChange={setBillDraft}
            />
          )}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-gray-300 hover:bg-white/10"
            >
              ← Retour
            </button>
            <button
              type="button"
              onClick={goNext}
              className="rounded-xl bg-[#C9A84C] px-5 py-2.5 text-sm font-bold text-[#07090F]"
            >
              Continuer →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 rounded-2xl border border-white/5 bg-[#0D1117] p-6">
          <h2 className="text-lg font-semibold text-white">Méthode de livraison</h2>
          {props.rates.length === 0 ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              Aucune méthode de livraison configurée. La boutique doit ajouter au moins un tarif.
            </div>
          ) : (
            <ul className="space-y-2">
              {props.rates.map(r => {
                const zone = props.zones.find(z => z.id === r.zone_id)
                return (
                  <li key={r.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#111827] p-3 text-sm hover:border-[rgba(201,168,76,.4)]">
                      <input
                        type="radio"
                        name="rate"
                        value={r.id}
                        checked={rateId === r.id}
                        onChange={() => setRateId(r.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-white">
                          {r.carrier ? `${r.carrier} — ${r.name}` : r.name}
                          {zone && <span className="ml-2 text-[10px] text-gray-500">({zone.name})</span>}
                        </div>
                        {(r.delivery_days_min || r.delivery_days_max) && (
                          <div className="text-[10px] text-gray-500">
                            Livraison sous {r.delivery_days_min ?? '?'}–{r.delivery_days_max ?? '?'} jours
                          </div>
                        )}
                      </div>
                      <div className="text-sm font-bold text-white">
                        {r.price_cents > 0 ? fmtMoney(r.price_cents) : 'Gratuit'}
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-gray-300 hover:bg-white/10"
            >
              ← Retour
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={busy || !rateId}
              className="rounded-xl bg-[#C9A84C] px-5 py-2.5 text-sm font-bold text-[#07090F] disabled:opacity-60"
            >
              {busy ? 'Préparation…' : 'Continuer vers le paiement →'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && clientSecret && orderId && (
        <div className="space-y-4 rounded-2xl border border-white/5 bg-[#0D1117] p-6">
          <h2 className="text-lg font-semibold text-white">Paiement</h2>
          <PaymentForm
            storeSlug={props.storeSlug}
            clientSecret={clientSecret}
            orderId={orderId}
            totalCents={props.cartTotals.total_cents + (props.rates.find(r => r.id === rateId)?.price_cents ?? 0)}
            currency={props.cartTotals.currency}
            accent={props.storeAccent}
          />
          <div className="flex justify-start pt-2">
            <button
              type="button"
              onClick={() => { setStep(2); setClientSecret(null); setOrderId(null); router.refresh() }}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-gray-300 hover:bg-white/10"
            >
              ← Modifier la livraison
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AddressBlock(props: {
  title: string
  addresses: AddressUI[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  draft: AddressDraft
  onDraftChange: (d: AddressDraft) => void
}) {
  const [showDraft, setShowDraft] = useState<boolean>(props.addresses.length === 0)
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{props.title}</h3>
      {props.addresses.length > 0 && (
        <ul className="space-y-2">
          {props.addresses.map(a => (
            <li key={a.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-[#111827] p-3 text-sm hover:border-[rgba(201,168,76,.4)]">
                <input
                  type="radio"
                  name={`addr-${props.title}`}
                  checked={props.selectedId === a.id && !showDraft}
                  onChange={() => { props.onSelect(a.id); setShowDraft(false) }}
                  className="mt-1"
                />
                <div className="text-gray-200">
                  <div className="font-semibold text-white">{a.full_name}</div>
                  {a.company && <div className="text-xs text-gray-500">{a.company}</div>}
                  <div className="text-xs">{a.line1}{a.line2 ? `, ${a.line2}` : ''}</div>
                  <div className="text-xs">{a.postal_code} {a.city} ({a.country_iso2})</div>
                  {a.phone && <div className="text-xs text-gray-500">{a.phone}</div>}
                </div>
              </label>
            </li>
          ))}
          <li>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/10 bg-white/5 p-3 text-sm hover:border-[rgba(201,168,76,.4)]">
              <input
                type="radio"
                name={`addr-${props.title}`}
                checked={showDraft}
                onChange={() => { props.onSelect(null); setShowDraft(true) }}
              />
              <span className="text-gray-300">+ Saisir une nouvelle adresse</span>
            </label>
          </li>
        </ul>
      )}
      {(showDraft || props.addresses.length === 0) && (
        <DraftFields draft={props.draft} onChange={props.onDraftChange} />
      )}
    </div>
  )
}

function DraftFields(props: { draft: AddressDraft; onChange: (d: AddressDraft) => void }) {
  const update = (patch: Partial<AddressDraft>) => props.onChange({ ...props.draft, ...patch })
  // dummy form handler so React doesn't warn about controlled inputs
  void ({} as FormEvent<HTMLFormElement>)
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2 block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Nom complet *</span>
        <input value={props.draft.full_name} onChange={e => update({ full_name: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white focus:border-[#C9A84C] focus:outline-none" />
      </label>
      <label className="sm:col-span-2 block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Société (option.)</span>
        <input value={props.draft.company} onChange={e => update({ company: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white focus:border-[#C9A84C] focus:outline-none" />
      </label>
      <label className="sm:col-span-2 block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Adresse *</span>
        <input value={props.draft.line1} onChange={e => update({ line1: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white focus:border-[#C9A84C] focus:outline-none" />
      </label>
      <label className="sm:col-span-2 block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Complément</span>
        <input value={props.draft.line2} onChange={e => update({ line2: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white focus:border-[#C9A84C] focus:outline-none" />
      </label>
      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Code postal *</span>
        <input value={props.draft.postal_code} onChange={e => update({ postal_code: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white focus:border-[#C9A84C] focus:outline-none" />
      </label>
      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Ville *</span>
        <input value={props.draft.city} onChange={e => update({ city: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white focus:border-[#C9A84C] focus:outline-none" />
      </label>
      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Pays (ISO2) *</span>
        <input value={props.draft.country_iso2} maxLength={2} onChange={e => update({ country_iso2: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm uppercase text-white focus:border-[#C9A84C] focus:outline-none" />
      </label>
      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Téléphone</span>
        <input type="tel" value={props.draft.phone} onChange={e => update({ phone: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white focus:border-[#C9A84C] focus:outline-none" />
      </label>
    </div>
  )
}
