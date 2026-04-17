import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import BuyersList from '../success/debouches/buyers-list'
import JourneyChipsBar from '@/components/JourneyChipsBar'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ iso: string }>; searchParams: Promise<{ product?: string }> }

export default async function ClientsPotentielsPage({ params, searchParams }: Props) {
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

  const { data: allForFilters } = await db
    .from('local_buyers')
    .select('product_slugs')
    .eq('country_iso', iso.toUpperCase())
    .limit(500)
  const productCounts: Record<string, number> = {}
  for (const r of (allForFilters ?? []) as { product_slugs: string[] }[]) {
    for (const p of r.product_slugs ?? []) productCounts[p] = (productCounts[p] ?? 0) + 1
  }
  const topProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 15)
  const totalVerified = (buyers ?? []).filter(b => b.verified).length
  const totalLeads = Object.values(productCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Chips bar — active product context, scroll-sticky. */}
        <JourneyChipsBar className="mb-4" />
        <Link href={`/country/${iso}`} className="text-[#C9A84C] text-sm hover:underline mb-4 inline-block">← Fiche pays</Link>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🎯</span>
          <h1 className="text-3xl md:text-4xl font-bold">Clients potentiels — {iso.toUpperCase()}</h1>
        </div>
        <p className="text-gray-400 text-sm mb-8 max-w-2xl">
          {totalLeads.toLocaleString('fr-FR')} acheteurs B2B identifiés dans ce marché (industriels, grossistes, centrales d'achats, transformateurs, distributeurs, HORECA, traders export).
          {totalVerified > 0 && <> {totalVerified} sont déjà vérifiés par nos agents.</>}
        </p>

        {topProducts.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <Link
              href={`/country/${iso}/clients`}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${!product ? 'bg-[#C9A84C] text-black' : 'bg-white/5 text-white border border-white/10'}`}
            >
              Toutes denrées ({totalLeads})
            </Link>
            {topProducts.map(([p, n]) => (
              <Link
                key={p}
                href={`/country/${iso}/clients?product=${encodeURIComponent(p)}`}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${product === p ? 'bg-[#C9A84C] text-black' : 'bg-white/5 text-white border border-white/10'}`}
              >
                {p} ({n})
              </Link>
            ))}
          </div>
        )}

        <BuyersList buyers={buyers ?? []} />

        {!buyers?.length && (
          <div className="mt-8 p-6 rounded-2xl border border-white/10 bg-white/5 text-center">
            <p className="text-gray-400 text-sm">Aucun client identifié pour ce pays{product ? ` sur la denrée « ${product} »` : ''} pour l'instant.</p>
            <p className="text-xs text-gray-500 mt-2">Nos agents scoutent en continu. Priorisez votre filière en contactant l'équipe — nous accélérons le scout ciblé sous 48h.</p>
          </div>
        )}

        <div className="mt-10 p-5 rounded-2xl border border-[#C9A84C]/30 bg-[#C9A84C]/5">
          <p className="text-sm text-[#C9A84C] font-semibold mb-1">Next step</p>
          <p className="text-sm text-gray-300">
            Vous voulez contacter ces acheteurs en votre nom avec une vitrine produit ?{' '}
            <Link href={`/country/${iso}/store`} className="text-[#C9A84C] underline">Créez votre site e-commerce en 5 min →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
