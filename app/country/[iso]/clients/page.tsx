import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import BuyersList from '../success/debouches/buyers-list'
import JourneyChipsBar from '@/components/JourneyChipsBar'
import SectionFillLoader from '@/components/SectionFillLoader'
import { createSupabaseServer } from '@/lib/supabase-server'
import { BUYER_REVEAL_QUOTA_BY_TIER } from '@/lib/credits/costs'
import type { PlanTier } from '@/lib/credits/costs'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ iso: string }>; searchParams: Promise<{ product?: string }> }

const VALID_TIERS = new Set<PlanTier>([
  'free',
  'solo_producer',
  'starter',
  'strategy',
  'premium',
  'ultimate',
  'custom',
])

function normalizeTier(raw: string | null | undefined): PlanTier {
  if (!raw) return 'free'
  // Aliases legacy (cf. PaywallGate.toPlanTier).
  const map: Record<string, PlanTier> = {
    explorer: 'free', basic: 'starter', data: 'starter', standard: 'strategy',
    enterprise: 'custom',
  }
  const t = map[raw] ?? raw
  return VALID_TIERS.has(t as PlanTier) ? (t as PlanTier) : 'free'
}

export default async function ClientsPotentielsPage({ params, searchParams }: Props) {
  const { iso } = await params
  const { product } = await searchParams
  const isoUpper = iso.toUpperCase()
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  let q = db.from('local_buyers')
    .select('id, name, buyer_type, city, address, website_url, email, phone, whatsapp, contact_name, product_slugs, annual_volume_mt_min, annual_volume_mt_max, quality_requirements, certifications_required, confidence_score, verified, notes')
    .eq('country_iso', isoUpper)
    .order('verified', { ascending: false })
    .order('confidence_score', { ascending: false })
    .limit(200)
  if (product) q = q.contains('product_slugs', [product.toLowerCase()])
  const { data: buyers } = await q

  const { data: allForFilters } = await db
    .from('local_buyers')
    .select('product_slugs')
    .eq('country_iso', isoUpper)
    .limit(500)
  const productCounts: Record<string, number> = {}
  for (const r of (allForFilters ?? []) as { product_slugs: string[] }[]) {
    for (const p of r.product_slugs ?? []) productCounts[p] = (productCounts[p] ?? 0) + 1
  }
  const topProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 15)
  const totalVerified = (buyers ?? []).filter(b => b.verified).length
  const totalLeads = Object.values(productCounts).reduce((a, b) => a + b, 0)

  // Auth + tier + crédits + reveals déjà persistés pour ce user.
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()

  let userTier: PlanTier = 'free'
  let userCredits = 0
  const revealedSet = new Set<string>()

  if (user) {
    const [{ data: profile }, { data: balRow }, { data: revealRows }] = await Promise.all([
      sb.from('profiles').select('tier').eq('id', user.id).maybeSingle(),
      sb.rpc('fillthegap_balance', { p_user_id: user.id }),
      db
        .from('buyer_reveals')
        .select('buyer_id')
        .eq('user_id', user.id)
        .in('buyer_id', (buyers ?? []).map(b => b.id)),
    ])
    userTier = normalizeTier(profile?.tier as string | undefined)
    const row = Array.isArray(balRow) ? balRow[0] : balRow
    userCredits = typeof row?.balance === 'number' ? row.balance : 0
    for (const r of (revealRows ?? []) as { buyer_id: string }[]) revealedSet.add(r.buyer_id)
  }

  const quotaIncluded = BUYER_REVEAL_QUOTA_BY_TIER[userTier]

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Chips bar — active product context, scroll-sticky. */}
        <JourneyChipsBar className="mb-4" />
        <Link href={`/country/${iso}`} className="text-[#C9A84C] text-sm hover:underline mb-4 inline-block">← Fiche pays</Link>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🎯</span>
          <h1 className="text-3xl md:text-4xl font-bold">Clients potentiels — {isoUpper}</h1>
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

        <BuyersList
          buyers={buyers ?? []}
          iso={isoUpper}
          userTier={userTier}
          userCredits={userCredits}
          quotaIncluded={quotaIncluded}
          revealedSet={revealedSet}
        />

        {!buyers?.length && (
          // Anti "section-vide-payée" : on déclenche un fetch on-demand
          // (Serper) pour ajouter ≥5 buyers sans débit crédits.
          <div className="mt-8">
            <SectionFillLoader
              iso={isoUpper}
              section="clients"
              product={product}
              label={`Recherche d'acheteurs ${product ? `« ${product} »` : ''} en cours…`}
            />
          </div>
        )}

      </div>
    </div>
  )
}
