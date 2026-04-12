import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import BuyersList from './buyers-list'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ iso: string }>; searchParams: Promise<{ product?: string }> }

export default async function DebouchesPage({ params, searchParams }: Props) {
  const { iso } = await params
  const { product } = await searchParams
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  let q = db.from('local_buyers')
    .select('id, name, buyer_type, city, address, website_url, email, phone, whatsapp, contact_name, product_slugs, annual_volume_mt_min, annual_volume_mt_max, quality_requirements, certifications_required, confidence_score, verified, notes')
    .eq('country_iso', iso.toUpperCase())
    .order('verified', { ascending: false })
    .order('confidence_score', { ascending: false })
    .limit(200)
  if (product) q = q.contains('product_slugs', [product.toLowerCase()])
  const { data: buyers } = await q

  // Distinct product tags in this country (for filters)
  const { data: allForFilters } = await db.from('local_buyers').select('product_slugs').eq('country_iso', iso.toUpperCase()).limit(500)
  const productCounts: Record<string, number> = {}
  for (const r of (allForFilters ?? []) as any[]) for (const p of r.product_slugs ?? []) productCounts[p] = (productCounts[p] ?? 0) + 1
  const topProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 15)

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link href={`/country/${iso}/success`} className="text-[#C9A84C] text-sm hover:underline mb-4 inline-block">← Route vers le succès</Link>
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Débouchés locaux — {iso.toUpperCase()}</h1>
        <p className="text-gray-400 text-sm mb-8 max-w-2xl">
          Acheteurs locaux identifiés dans le pays : industriels, grossistes, centrales d'achats, transformateurs, distributeurs, traders. Priorité à ceux qui sont vérifiés.
        </p>

        {/* Product filters */}
        {topProducts.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <Link href={`/country/${iso}/success/debouches`} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${!product ? 'bg-[#C9A84C] text-black' : 'bg-white/5 text-white border border-white/10'}`}>
              Toutes denrées ({Object.values(productCounts).reduce((a, b) => a + b, 0)})
            </Link>
            {topProducts.map(([p, n]) => (
              <Link key={p} href={`/country/${iso}/success/debouches?product=${encodeURIComponent(p)}`}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${product === p ? 'bg-[#C9A84C] text-black' : 'bg-white/5 text-white border border-white/10'}`}>
                {p} ({n})
              </Link>
            ))}
          </div>
        )}

        <BuyersList buyers={buyers ?? []} />

        {!buyers?.length && (
          <div className="mt-8 p-6 rounded-2xl border border-white/10 bg-white/5 text-center">
            <p className="text-gray-400 text-sm">Aucun acheteur encore répertorié pour ce pays{product ? ` sur la denrée « ${product} »` : ''}.</p>
            <p className="text-xs text-gray-500 mt-2">Les agents FTG scoutent en continu : revenez bientôt, ou nous pouvons prioriser votre filière sur demande.</p>
          </div>
        )}
      </div>
    </div>
  )
}
