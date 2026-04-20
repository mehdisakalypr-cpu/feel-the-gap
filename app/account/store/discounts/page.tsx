// © 2025-2026 Feel The Gap — discount codes & campaigns

import { redirect } from 'next/navigation'
import { requireStoreOwner } from '../_lib/store-owner'
import { createSupabaseServer } from '@/lib/supabase-server'
import { DiscountForm } from '@/components/store/DiscountForm'
import { CampaignForm } from '@/components/store/CampaignForm'
import { fmtDate } from '@/components/store/_utils'

export const dynamic = 'force-dynamic'

export default async function DiscountsPage() {
  const gate = await requireStoreOwner()
  if (!gate.ok) redirect(gate.redirectTo)

  const sb = await createSupabaseServer()
  const { data: codes } = await sb
    .from('store_discount_codes')
    .select('id, code, discount_type, discount_value, max_uses, used_count, starts_at, ends_at, applies_to, active')
    .eq('store_id', gate.ctx.store.id)
    .order('created_at', { ascending: false })

  const { data: campaigns } = await sb
    .from('store_discount_campaigns')
    .select('id, name, discount_pct, product_ids, starts_at, ends_at, status')
    .eq('store_id', gate.ctx.store.id)
    .order('starts_at', { ascending: false })

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-white">Promotions</h1>
        <p className="mt-1 text-sm text-gray-400">G\u00e9rez les codes promo et campagnes time-bounded.</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Codes promo</h2>
        <DiscountForm />
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]">
          {codes && codes.length ? (
            <ul className="divide-y divide-white/5">
              {codes.map(c => (
                <li key={c.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                  <div className="col-span-3 font-mono text-white">{c.code}</div>
                  <div className="col-span-2 text-gray-300">
                    {c.discount_type === 'fixed'
                      ? `- ${(Number(c.discount_value) / 100).toFixed(2)} \u20ac`
                      : `- ${Number(c.discount_value)}%`}
                  </div>
                  <div className="col-span-2 text-gray-400">{c.used_count} / {c.max_uses ?? '\u221e'}</div>
                  <div className="col-span-3 text-gray-400">{fmtDate(c.starts_at)} \u2192 {c.ends_at ? fmtDate(c.ends_at) : '\u221e'}</div>
                  <div className="col-span-2 text-right">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                      c.active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-gray-500/30 bg-gray-500/10 text-gray-300'
                    }`}>
                      {c.active ? 'actif' : 'inactif'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-6 text-center text-sm text-gray-400">Aucun code promo.</div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Campagnes (% sur lot, time-bounded)</h2>
        <CampaignForm />
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]">
          {campaigns && campaigns.length ? (
            <ul className="divide-y divide-white/5">
              {campaigns.map(c => (
                <li key={c.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                  <div className="col-span-4 text-white">{c.name}</div>
                  <div className="col-span-2 text-gray-300">- {Number(c.discount_pct)}%</div>
                  <div className="col-span-2 text-gray-400">{(c.product_ids ?? []).length} produits</div>
                  <div className="col-span-3 text-gray-400">{fmtDate(c.starts_at)} \u2192 {fmtDate(c.ends_at)}</div>
                  <div className="col-span-1 text-right">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-300">
                      {c.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-6 text-center text-sm text-gray-400">Aucune campagne.</div>
          )}
        </div>
      </section>
    </div>
  )
}
