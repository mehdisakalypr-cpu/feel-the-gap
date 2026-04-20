// © 2025-2026 Feel The Gap — products list (owner)

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireStoreOwner } from '../_lib/store-owner'
import { createSupabaseServer } from '@/lib/supabase-server'
import { ProductsTable } from '@/components/store/ProductsTable'

export const dynamic = 'force-dynamic'

interface SearchProps {
  searchParams?: Promise<{ category?: string; segment?: string; visibility?: string; low_stock?: string }>
}

export default async function StoreProductsPage(props: SearchProps) {
  const gate = await requireStoreOwner()
  if (!gate.ok) redirect(gate.redirectTo)
  const { ctx } = gate

  const sp = (await props.searchParams) ?? {}

  const sb = await createSupabaseServer()
  let query = sb
    .from('store_products')
    .select('id, name, sku, segment, visibility, stock_qty, stock_low_alert, stock_unlimited, price_b2c_ttc_cents, price_b2b_ht_cents, packaging_type, packaging_unit, packaging_qty, category_id, updated_at')
    .eq('store_id', ctx.store.id)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (sp.category) query = query.eq('category_id', sp.category)
  if (sp.segment && ['b2b', 'b2c', 'both'].includes(sp.segment)) query = query.eq('segment', sp.segment)
  if (sp.visibility && ['draft', 'active', 'archived'].includes(sp.visibility)) query = query.eq('visibility', sp.visibility)

  const { data: products } = await query

  let rows = products ?? []
  if (sp.low_stock === '1') {
    rows = rows.filter(p => !p.stock_unlimited && p.stock_low_alert != null && Number(p.stock_qty) <= Number(p.stock_low_alert))
  }

  const { data: cats } = await sb
    .from('store_product_categories')
    .select('id, name, slug')
    .eq('store_id', ctx.store.id)
    .order('position', { ascending: true })

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Produits</h1>
          <p className="mt-1 text-sm text-gray-400">{rows.length} produit{rows.length > 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/account/store/products/new"
          className="rounded-xl bg-[#C9A84C] px-5 py-2.5 text-sm font-bold text-[#07090F] hover:bg-[#E8C97A]"
        >
          + Ajouter un produit
        </Link>
      </header>

      <form className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#0D1117] p-4">
        <select
          name="category"
          defaultValue={sp.category ?? ''}
          className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
        >
          <option value="">Toutes cat\u00e9gories</option>
          {(cats ?? []).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          name="segment"
          defaultValue={sp.segment ?? ''}
          className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
        >
          <option value="">Tous segments</option>
          <option value="b2c">B2C</option>
          <option value="b2b">B2B</option>
          <option value="both">B2B + B2C</option>
        </select>
        <select
          name="visibility"
          defaultValue={sp.visibility ?? ''}
          className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
        >
          <option value="">Toutes visibilit\u00e9s</option>
          <option value="active">En ligne</option>
          <option value="draft">Brouillon</option>
          <option value="archived">Archiv\u00e9</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-300">
          <input type="checkbox" name="low_stock" value="1" defaultChecked={sp.low_stock === '1'} />
          Stock faible
        </label>
        <button type="submit" className="rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10">
          Filtrer
        </button>
        <Link href="/account/store/products" className="text-xs text-gray-500 hover:text-gray-300">
          R\u00e9initialiser
        </Link>
      </form>

      <ProductsTable rows={rows} />
    </div>
  )
}
