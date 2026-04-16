import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/lead-marketplace'

export const dynamic = 'force-dynamic'

function priceEUR(cents?: number | null) { return ((cents ?? 0) / 100).toFixed(0) + ' €' }

export default async function PurchasesPage() {
  const user = await getAuthUser()
  if (!user) redirect('/auth/login?next=/account/purchases')

  const sb = adminSupabase()
  const { data: purchases } = await sb.from('lead_purchases')
    .select('*').eq('user_id', user.id).order('created_at', { ascending: false })
  const nowMs = Date.now()

  return (
    <main className="min-h-screen px-6 py-16 max-w-4xl mx-auto">
      <Link href="/account" className="text-sm text-blue-400 hover:text-blue-300">← Mon compte</Link>
      <h1 className="mt-4 text-3xl font-bold">Mes achats de leads</h1>
      <p className="mt-2 text-white/60 text-sm">
        Liens de téléchargement valides 7 jours, 3 téléchargements max par pack.
      </p>

      {!purchases || purchases.length === 0 ? (
        <div className="mt-10 p-6 rounded-xl border border-white/10 bg-white/[0.02]">
          <p className="text-white/60">Aucun achat pour l&apos;instant.</p>
          <Link href="/data/leads" className="mt-3 inline-block text-blue-300 hover:underline">
            Découvrir la marketplace →
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {purchases.map(p => {
            const expired = p.csv_expires_at && new Date(p.csv_expires_at).getTime() < nowMs
            const ready = p.status === 'fulfilled' && !expired
            const limit = (p.download_count ?? 0) >= (p.max_downloads ?? 3)
            return (
              <li key={p.id} className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-semibold">{p.pack_title ?? p.pack_slug}</div>
                  <div className="text-xs text-white/50">
                    {new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' • '}
                    {priceEUR(p.amount_cents)}
                    {p.rows_count ? ` • ${p.rows_count.toLocaleString('fr-FR')} lignes` : ''}
                  </div>
                  <div className="mt-1 text-xs">
                    {p.status === 'pending' && <span className="text-yellow-400">En attente de paiement</span>}
                    {p.status === 'paid' && <span className="text-blue-300">Paiement confirmé, génération CSV…</span>}
                    {p.status === 'fulfilled' && !expired && (
                      <span className="text-emerald-300">Prêt — {p.download_count ?? 0}/{p.max_downloads ?? 3} DL</span>
                    )}
                    {p.status === 'fulfilled' && expired && <span className="text-red-400">Expiré</span>}
                    {p.status === 'failed' && <span className="text-red-400">Échec — support contacté</span>}
                  </div>
                </div>
                {ready && !limit && (
                  <a
                    href={`/api/leads/download/${p.id}`}
                    className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold"
                  >
                    Télécharger CSV
                  </a>
                )}
                {ready && limit && (
                  <span className="text-xs text-white/40">Limite atteinte</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
