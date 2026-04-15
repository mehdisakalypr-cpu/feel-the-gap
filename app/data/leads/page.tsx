import Link from 'next/link'
import { adminSupabase, type LeadPack } from '@/lib/lead-marketplace'

export const revalidate = 60
export const metadata = {
  title: 'Lead Marketplace B2B — Feel The Gap',
  description: 'Packs de leads prêts à l\'emploi : acheteurs locaux, exportateurs, investisseurs, entrepreneurs. Livraison CSV instantanée.',
}

function priceEUR(cents: number) { return (cents / 100).toFixed(0) + ' €' }

async function getPacks({ country, sector, tier }: { country?: string; sector?: string; tier?: string }) {
  const sb = adminSupabase()
  let q = sb.from('lead_packs').select('*').eq('is_active', true).order('is_featured', { ascending: false }).order('price_cents', { ascending: true })
  if (country) q = q.eq('country_iso', country)
  if (sector) q = q.eq('sector', sector)
  if (tier) q = q.eq('tier', tier)
  const { data } = await q
  return (data ?? []) as LeadPack[]
}

export default async function LeadMarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; sector?: string; tier?: string }>
}) {
  const sp = await searchParams
  const packs = await getPacks(sp)

  const countries = Array.from(new Set(packs.map(p => p.country_iso).filter(Boolean))) as string[]
  const sectors = Array.from(new Set(packs.map(p => p.sector).filter(Boolean))) as string[]

  return (
    <main className="min-h-screen px-6 py-16 md:py-24 max-w-6xl mx-auto">
      <div className="mb-12">
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Accueil</Link>
        <h1 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight">Lead Marketplace B2B</h1>
        <p className="mt-4 text-lg text-white/70 max-w-2xl">
          Packs de leads qualifiés prêts à l&apos;emploi : acheteurs, exportateurs, investisseurs, entrepreneurs.
          Livraison CSV sécurisée, sous 3 téléchargements, conformes RGPD (intérêt légitime B2B).
        </p>
      </div>

      {/* Filtres */}
      <div className="mb-8 flex flex-wrap gap-2">
        <Link
          href="/data/leads"
          className={`px-3 py-1.5 rounded-full text-sm border transition ${!sp.country && !sp.sector && !sp.tier ? 'bg-blue-500 text-white border-blue-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
        >
          Tous
        </Link>
        {countries.map(c => (
          <Link key={c}
            href={`/data/leads?country=${c}`}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${sp.country === c ? 'bg-blue-500 text-white border-blue-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
          >
            {c}
          </Link>
        ))}
        {sectors.map(s => (
          <Link key={s}
            href={`/data/leads?sector=${s}`}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${sp.sector === s ? 'bg-blue-500 text-white border-blue-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
          >
            {s}
          </Link>
        ))}
        {(['S','M','L','XL'] as const).map(t => (
          <Link key={t}
            href={`/data/leads?tier=${t}`}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${sp.tier === t ? 'bg-blue-500 text-white border-blue-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
          >
            Taille {t}
          </Link>
        ))}
      </div>

      {/* Grid */}
      {packs.length === 0 ? (
        <p className="text-white/50">Aucun pack ne correspond à ces filtres.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packs.map(p => (
            <Link
              key={p.id}
              href={`/data/leads/${p.slug}`}
              className="group rounded-xl border border-white/10 bg-white/[0.02] p-5 hover:border-blue-400/40 hover:bg-white/[0.04] transition"
            >
              <div className="flex items-start justify-between">
                <span className="text-3xl">{p.hero_emoji ?? '📇'}</span>
                <span className="text-xs uppercase tracking-wider text-white/40">Tier {p.tier}</span>
              </div>
              <h2 className="mt-3 font-semibold text-lg leading-tight group-hover:text-blue-300 transition">
                {p.title}
              </h2>
              {p.subtitle && <p className="mt-1 text-sm text-white/50">{p.subtitle}</p>}
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{priceEUR(p.price_cents)}</div>
                  <div className="text-xs text-white/40">{p.target_count.toLocaleString('fr-FR')} leads</div>
                </div>
                <span className="text-sm text-blue-300 group-hover:translate-x-0.5 transition">Voir →</span>
              </div>
              {p.verified_only && (
                <div className="mt-3 inline-block text-[11px] px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-full">
                  ✓ Verified only
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-16 p-6 rounded-xl border border-white/10 bg-white/[0.02]">
        <h3 className="font-semibold">🛡️ Conformité & qualité</h3>
        <ul className="mt-2 text-sm text-white/60 space-y-1 list-disc pl-5">
          <li>Données B2B collectées sous intérêt légitime (RGPD Art. 6 §1 f) — opt-out disponible sur demande.</li>
          <li>Chaque CSV est watermarké pour tracer les reventes.</li>
          <li>Téléchargement limité à 3 fois, lien signé expirant sous 7 jours.</li>
          <li>Support : <a href="mailto:support@feel-the-gap.com" className="text-blue-300">support@feel-the-gap.com</a></li>
        </ul>
      </div>
    </main>
  )
}
