// © 2025-2026 Feel The Gap — edit product + media + variants

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireStoreOwner } from '../../_lib/store-owner'
import { createSupabaseServer } from '@/lib/supabase-server'
import { ProductForm, type ProductFormValue } from '@/components/store/ProductForm'
import { MediaManager, type MediaItem } from '@/components/store/MediaManager'
import { VariantsEditor, type VariantInput, type OptionInput } from '@/components/store/VariantsEditor'

export const dynamic = 'force-dynamic'

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const gate = await requireStoreOwner()
  if (!gate.ok) redirect(gate.redirectTo)

  const sb = await createSupabaseServer()
  const { data: prod } = await sb
    .from('store_products')
    .select('*')
    .eq('id', id)
    .eq('store_id', gate.ctx.store.id)
    .maybeSingle()

  if (!prod) notFound()

  const { data: mediaRaw } = await sb
    .from('store_product_media')
    .select('id, type, url, caption, position, is_cover')
    .eq('product_id', id)
    .order('position', { ascending: true })
  const media: MediaItem[] = (mediaRaw ?? []).map(m => ({
    id: String(m.id),
    type: m.type as 'photo' | 'video',
    url: String(m.url),
    caption: m.caption ? String(m.caption) : null,
    position: Number(m.position),
    is_cover: !!m.is_cover,
  }))

  const { data: optsRaw } = await sb
    .from('store_product_options')
    .select('id, name, position, values')
    .eq('product_id', id)
    .order('position', { ascending: true })
  const options: OptionInput[] = (optsRaw ?? []).map(o => ({
    id: String(o.id),
    name: String(o.name),
    position: Number(o.position),
    values: (o.values ?? []) as string[],
  }))

  const { data: varsRaw } = await sb
    .from('store_product_variants')
    .select('id, sku, ean, option_values, price_b2c_ttc_cents, price_b2b_ht_cents, stock_qty, weight_g, position, active')
    .eq('product_id', id)
    .order('position', { ascending: true })
  const variants: VariantInput[] = (varsRaw ?? []).map(v => ({
    id: String(v.id),
    sku: v.sku ? String(v.sku) : '',
    ean: v.ean ? String(v.ean) : '',
    option_values: (v.option_values ?? {}) as Record<string, string>,
    price_b2c_ttc_cents: v.price_b2c_ttc_cents ?? null,
    price_b2b_ht_cents: v.price_b2b_ht_cents ?? null,
    stock_qty: Number(v.stock_qty ?? 0),
    weight_g: v.weight_g ?? null,
    position: Number(v.position ?? 0),
    active: !!v.active,
  }))

  const initial: Partial<ProductFormValue> = {
    name: String(prod.name),
    description: prod.description ? String(prod.description) : '',
    sku: prod.sku ? String(prod.sku) : '',
    ean: prod.ean ? String(prod.ean) : '',
    segment: (prod.segment as ProductFormValue['segment']) ?? 'b2c',
    packaging_type: (prod.packaging_type as ProductFormValue['packaging_type']) ?? 'unit',
    packaging_unit: String(prod.packaging_unit ?? 'piece'),
    packaging_qty: String(prod.packaging_qty ?? 1),
    price_b2c_ttc_cents: prod.price_b2c_ttc_cents ?? null,
    price_b2b_ht_cents: prod.price_b2b_ht_cents ?? null,
    vat_rate_pct: String(prod.vat_rate_pct ?? 20),
    stock_qty: String(prod.stock_qty ?? 0),
    stock_low_alert: prod.stock_low_alert != null ? String(prod.stock_low_alert) : '',
    stock_unlimited: !!prod.stock_unlimited,
    norms: Array.isArray(prod.norms) ? (prod.norms as string[]).join(', ') : '',
    labels: Array.isArray(prod.labels) ? (prod.labels as string[]).join(', ') : '',
    legal_docs: JSON.stringify(prod.legal_docs ?? [], null, 2),
    visibility: (prod.visibility as ProductFormValue['visibility']) ?? 'draft',
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/account/store/products" className="text-xs text-gray-500 hover:text-gray-300">
            \u2190 Retour aux produits
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-white">{String(prod.name)}</h1>
          <p className="mt-1 text-sm text-gray-400">
            Mis \u00e0 jour le {new Date(String(prod.updated_at)).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        </div>
      </header>

      <ProductForm initial={initial} productId={id} />

      <section className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">M\u00e9dias</h2>
        <MediaManager productId={id} initial={media} />
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Variantes</h2>
        <VariantsEditor productId={id} initialOptions={options} initialVariants={variants} />
      </section>
    </div>
  )
}
