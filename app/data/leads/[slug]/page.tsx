import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  adminSupabase,
  applyPackFilters,
  anonymizeRow,
  PUBLIC_COLUMNS,
  type LeadPack,
} from '@/lib/lead-marketplace'
import PackCheckoutButton from './checkout-button'

export const revalidate = 120

function priceEUR(cents: number) { return (cents / 100).toFixed(0) + ' €' }

async function getPack(slug: string) {
  const sb = adminSupabase()
  const { data } = await sb.from('lead_packs').select('*').eq('slug', slug).eq('is_active', true).maybeSingle()
  return data as LeadPack | null
}

async function getPreview(pack: LeadPack) {
  const sb = adminSupabase()
  const cols = PUBLIC_COLUMNS[pack.source_table]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseCount: any = sb.from(pack.source_table).select('id', { count: 'exact', head: true })
  const { count } = await applyPackFilters(baseCount, pack.source_table, pack.filters, pack.verified_only)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseSel: any = sb.from(pack.source_table).select(cols.join(','))
  const { data } = await applyPackFilters(baseSel, pack.source_table, pack.filters, pack.verified_only).limit(5)
  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((r: Record<string, unknown>) => anonymizeRow(r))
  return { count: (count as number | null) ?? 0, rows }
}

export default async function LeadPackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const pack = await getPack(slug)
  if (!pack) return notFound()
  const { count, rows } = await getPreview(pack)
  const available = Math.min(count, pack.target_count)

  return (
    <main className="min-h-screen px-6 py-12 md:py-20 max-w-5xl mx-auto">
      <Link href="/data/leads" className="text-sm text-blue-400 hover:text-blue-300">← Marketplace</Link>

      <header className="mt-6 flex items-start gap-5">
        <div className="text-5xl md:text-6xl">{pack.hero_emoji ?? '📇'}</div>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{pack.title}</h1>
          {pack.subtitle && <p className="mt-1 text-white/60">{pack.subtitle}</p>}
          <div className="mt-3 flex gap-2 flex-wrap">
            {pack.tags.map(t => (
              <span key={t} className="text-[11px] px-2 py-0.5 bg-white/5 border border-white/10 rounded-full">{t}</span>
            ))}
            <span className="text-[11px] px-2 py-0.5 bg-white/5 border border-white/10 rounded-full">Tier {pack.tier}</span>
            {pack.verified_only && (
              <span className="text-[11px] px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-full">✓ Verified only</span>
            )}
          </div>
        </div>
      </header>

      <div className="mt-8 grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-6">
          {pack.description && (
            <section className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
              <h2 className="font-semibold">À propos du pack</h2>
              <p className="mt-2 text-sm text-white/70 leading-relaxed">{pack.description}</p>
            </section>
          )}

          <section className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
            <h2 className="font-semibold flex items-center gap-2">
              Aperçu (5 lignes anonymisées)
              <span className="text-[11px] font-normal text-white/40">— {available.toLocaleString('fr-FR')} leads disponibles</span>
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-white/40 border-b border-white/10">
                    {(rows[0] ? Object.keys(rows[0]) : []).slice(0, 6).map(k => (
                      <th key={k} className="text-left px-2 py-2 font-medium">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: Record<string, unknown>, i: number) => (
                    <tr key={i} className="border-b border-white/5">
                      {Object.keys(r).slice(0, 6).map(k => (
                        <td key={k} className="px-2 py-2 text-white/70 whitespace-nowrap max-w-[200px] truncate">
                          {Array.isArray(r[k]) ? (r[k] as unknown[]).join(', ') : String(r[k] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <p className="text-white/40 text-sm">Preview indisponible pour ce pack.</p>}
            </div>
            <p className="mt-3 text-xs text-white/40">
              Les emails, téléphones et noms sont masqués dans la preview. Données complètes livrées après paiement.
            </p>
          </section>

          <section className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
            <h2 className="font-semibold">Ce que vous recevez</h2>
            <ul className="mt-2 text-sm text-white/70 space-y-1 list-disc pl-5">
              <li>Fichier CSV (UTF-8) avec toutes les colonnes visibles ci-dessus — non masquées.</li>
              <li>Lien de téléchargement signé (3 DL max, valide 7 jours).</li>
              <li>Watermark intégré pour lutter contre la revente non autorisée.</li>
              <li>Conformité RGPD B2B (intérêt légitime, opt-out sous 48h).</li>
              <li>Support par email : <a href="mailto:support@feel-the-gap.com" className="text-blue-300">support@feel-the-gap.com</a></li>
            </ul>
          </section>
        </div>

        <aside className="md:col-span-1">
          <div className="sticky top-6 p-5 rounded-xl border border-blue-500/30 bg-blue-500/5">
            <div className="text-3xl font-bold">{priceEUR(pack.price_cents)}</div>
            <div className="text-xs text-white/50">{pack.target_count.toLocaleString('fr-FR')} leads — one-shot, sans abonnement</div>
            <PackCheckoutButton slug={pack.slug} />
            <p className="mt-3 text-[11px] text-white/40 leading-relaxed">
              Paiement sécurisé Stripe. Livraison sous 60 secondes par email + espace compte.
              En achetant, vous acceptez les <Link href="/legal/cgv" className="underline">CGV</Link> et la
              politique RGPD B2B.
            </p>
          </div>
        </aside>
      </div>
    </main>
  )
}
