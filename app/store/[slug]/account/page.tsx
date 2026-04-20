// © 2025-2026 Feel The Gap — buyer account dashboard

import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase-server'
import { requireBuyer } from './_lib/store-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props { params: Promise<{ slug: string }> }

interface OrderRow {
  id: string
  created_at: string
  status: string
  total_cents: number
  currency: string
}

interface AddressRow {
  id: string
  label: string | null
  city: string
  country_iso2: string
  is_default: boolean
}

function fmtMoney(cents: number, currency = 'EUR'): string {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 })
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:   { label: 'En attente',  color: '#9CA3AF' },
  paid:      { label: 'Payée',       color: '#60A5FA' },
  fulfilled: { label: 'Expédiée',    color: '#34D399' },
  refunded:  { label: 'Remboursée',  color: '#F472B6' },
  cancelled: { label: 'Annulée',     color: '#F87171' },
}

export default async function BuyerDashboardPage({ params }: Props) {
  const { slug } = await params
  const { user, store } = await requireBuyer(slug)

  const sb = await createSupabaseServer()
  const [ordersRes, addrRes, totalRes] = await Promise.all([
    sb.from('store_orders')
      .select('id, created_at, status, total_cents, currency')
      .eq('store_id', store.id)
      .eq('buyer_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    sb.from('store_buyer_addresses')
      .select('id, label, city, country_iso2, is_default')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .limit(3),
    sb.from('store_orders')
      .select('total_cents', { count: 'exact' })
      .eq('store_id', store.id)
      .eq('buyer_user_id', user.id)
      .in('status', ['paid', 'fulfilled']),
  ])

  const orders: OrderRow[] = (ordersRes.data ?? []) as OrderRow[]
  const addresses: AddressRow[] = (addrRes.data ?? []) as AddressRow[]
  const totalSpent = (totalRes.data ?? []).reduce(
    (acc: number, row: { total_cents: number }) => acc + (row.total_cents ?? 0),
    0,
  )
  const ordersCount = totalRes.count ?? 0
  const lastOrder = orders[0] ?? null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Bonjour {user.email?.split('@')[0]}</h1>
        <p className="mt-1 text-sm text-gray-400">
          Votre tableau de bord acheteur sur <span className="text-[#C9A84C]">{store.name}</span>.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total dépensé" value={fmtMoney(totalSpent)} />
        <StatCard label="Commandes" value={String(ordersCount)} />
        <StatCard
          label="Dernière commande"
          value={lastOrder ? new Date(lastOrder.created_at).toLocaleDateString('fr-FR') : '—'}
        />
      </div>

      <div className="rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">Commandes récentes</h2>
          <Link href={`/store/${slug}/account/orders`} className="text-xs text-[#C9A84C] hover:underline">
            Tout voir →
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune commande pour le moment. <Link href={`/store/${slug}`} className="text-[#C9A84C] hover:underline">Découvrir la boutique</Link></p>
        ) : (
          <ul className="divide-y divide-white/5">
            {orders.map(o => {
              const status = STATUS_LABEL[o.status] ?? { label: o.status, color: '#9CA3AF' }
              return (
                <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                  <Link
                    href={`/store/${slug}/account/orders/${o.id}`}
                    className="min-w-0 flex-1 truncate text-sm text-gray-200 hover:text-white"
                  >
                    <span className="font-mono text-xs text-gray-500">#{o.id.slice(0, 8)}</span>
                    <span className="ml-2">{new Date(o.created_at).toLocaleDateString('fr-FR')}</span>
                  </Link>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: `${status.color}20`, color: status.color }}
                  >
                    {status.label}
                  </span>
                  <span className="text-sm font-semibold text-white">{fmtMoney(o.total_cents, o.currency)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117] p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">Adresses</h2>
            <Link href={`/store/${slug}/account/addresses`} className="text-xs text-[#C9A84C] hover:underline">
              Gérer →
            </Link>
          </div>
          {addresses.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune adresse enregistrée.</p>
          ) : (
            <ul className="space-y-2 text-sm text-gray-300">
              {addresses.map(a => (
                <li key={a.id} className="flex items-center gap-2">
                  <span className="text-[#C9A84C]">📍</span>
                  <span>{a.label || `${a.city}, ${a.country_iso2}`}</span>
                  {a.is_default && (
                    <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      Défaut
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117] p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-300">Mon profil</h2>
          <div className="space-y-2 text-sm text-gray-300">
            <div><span className="text-gray-500">Email : </span>{user.email}</div>
            <div><span className="text-gray-500">Membre depuis : </span>{new Date(user.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/store/${slug}/account/profile`} className="rounded-xl bg-[#C9A84C] px-4 py-2 text-xs font-semibold text-[#07090F] hover:bg-[#E8C97A]">
              Modifier
            </Link>
            <Link href={`/store/${slug}/account/notifications`} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10">
              Notifications
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117] p-5">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-white">{value}</div>
    </div>
  )
}
