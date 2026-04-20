// © 2025-2026 Feel The Gap — store analytics dashboard

import { redirect } from 'next/navigation'
import { requireStoreOwner } from '../_lib/store-owner'
import { createSupabaseServer } from '@/lib/supabase-server'
import { fmtMoney } from '@/components/store/_utils'
import { AnalyticsCard, RevenueChart, type DayBucket } from '@/components/store/AnalyticsCard'

export const dynamic = 'force-dynamic'

export default async function StoreDashboardPage() {
  const gate = await requireStoreOwner()
  if (!gate.ok) redirect(gate.redirectTo)

  const sb = await createSupabaseServer()

  const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()

  // 30 days orders (paid only)
  const { data: orders30 } = await sb
    .from('store_orders')
    .select('id, total_cents, currency, created_at, paid_at, status')
    .eq('store_id', gate.ctx.store.id)
    .gte('created_at', since30)
    .order('created_at', { ascending: false })

  const paid30 = (orders30 ?? []).filter(o => o.status === 'paid' || o.status === 'fulfilled')

  const buckets: DayBucket[] = []
  const dayMap = new Map<string, number>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000)
    const key = d.toISOString().slice(0, 10)
    dayMap.set(key, 0)
    buckets.push({ day: key, value_cents: 0 })
  }
  for (const o of paid30) {
    const key = String(o.created_at).slice(0, 10)
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + Number(o.total_cents))
  }
  for (const b of buckets) b.value_cents = dayMap.get(b.day) ?? 0

  const todayKey = new Date().toISOString().slice(0, 10)
  const weekStart = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const todayRev = paid30.filter(o => String(o.created_at).slice(0, 10) === todayKey).reduce((s, o) => s + Number(o.total_cents), 0)
  const weekRev = paid30.filter(o => String(o.created_at).slice(0, 10) >= weekStart).reduce((s, o) => s + Number(o.total_cents), 0)
  const monthRev = paid30.reduce((s, o) => s + Number(o.total_cents), 0)
  const avgBasket = paid30.length ? Math.round(monthRev / paid30.length) : 0
  const totalAttempts = orders30?.length ?? 0
  const conversion = totalAttempts ? Math.round((paid30.length / totalAttempts) * 100) : 0

  // Top products by revenue (joined via items)
  const { data: itemsRaw } = await sb
    .from('store_order_items')
    .select('product_id, qty, line_total_cents, store_orders!inner(store_id, status, created_at)')
    .gte('store_orders.created_at', since30)
    .eq('store_orders.store_id', gate.ctx.store.id)

  type AggRow = { qty: number; total_cents: number }
  const topMap = new Map<string, AggRow>()
  for (const it of itemsRaw ?? []) {
    const oRel = (it as { store_orders?: { status?: string } }).store_orders
    const status = oRel?.status
    if (status !== 'paid' && status !== 'fulfilled') continue
    const pid = String((it as { product_id?: string | null }).product_id ?? '')
    if (!pid) continue
    const cur = topMap.get(pid) ?? { qty: 0, total_cents: 0 }
    cur.qty += Number((it as { qty: number | string }).qty)
    cur.total_cents += Number((it as { line_total_cents: number }).line_total_cents)
    topMap.set(pid, cur)
  }
  const topIds = Array.from(topMap.entries()).sort((a, b) => b[1].total_cents - a[1].total_cents).slice(0, 5)
  const { data: prodNames } = topIds.length
    ? await sb.from('store_products').select('id, name').in('id', topIds.map(([id]) => id))
    : { data: [] as { id: string; name: string }[] }
  const nameMap = new Map((prodNames ?? []).map(p => [String(p.id), String(p.name)]))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-400">Vue 30 derniers jours \u00b7 boutique <span className="font-mono">{gate.ctx.store.slug}</span></p>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <AnalyticsCard label="CA aujourd&apos;hui" value={fmtMoney(todayRev)} />
        <AnalyticsCard label="CA 7 jours" value={fmtMoney(weekRev)} />
        <AnalyticsCard label="CA 30 jours" value={fmtMoney(monthRev)} />
        <AnalyticsCard label="Panier moyen" value={fmtMoney(avgBasket)} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0D1117] p-5">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Chiffre d&apos;affaires \u2014 30 jours</div>
            <div className="text-lg font-semibold text-white">{fmtMoney(monthRev)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-gray-500">Conversion</div>
            <div className="text-lg font-semibold text-white">{conversion}%</div>
          </div>
        </div>
        <RevenueChart data={buckets} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0D1117] p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Top produits (30j)</h2>
        {topIds.length === 0 ? (
          <div className="text-sm text-gray-400">Aucune vente sur la p\u00e9riode.</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {topIds.map(([id, agg]) => (
              <li key={id} className="grid grid-cols-12 items-center gap-2 py-3">
                <div className="col-span-7 truncate text-sm text-white">{nameMap.get(id) ?? id.slice(0, 8)}</div>
                <div className="col-span-2 text-sm text-gray-300">{agg.qty} ventes</div>
                <div className="col-span-3 text-right text-sm font-semibold text-white">{fmtMoney(agg.total_cents)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
