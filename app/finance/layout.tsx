import type { Metadata } from 'next'
import Link from 'next/link'
import { isParcoursEnabled } from '@/lib/feature-flags'
import { createSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Financeurs — Feel The Gap',
  description: "Portail financeurs : deal flow qualifié, dossiers de crédit structurés, pipeline de suivi.",
  openGraph: {
    title: 'Portail Financeurs — Feel The Gap',
    description: "Sourcez des dossiers de crédit sur des marchés en tension, avec scoring et due diligence facilitée.",
    type: 'website',
  },
}

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const enabled = await isParcoursEnabled('financeur')
  if (enabled) return <>{children}</>

  // Read marketplace state to expose the unlock progress (transparency).
  let complete: number | null = null
  let threshold: number | null = null
  try {
    const sb = await createSupabaseServer()
    const [{ data: st }, { data: p }] = await Promise.all([
      sb.from('marketplace_state').select('dossiers_complete_count').eq('id', 1).maybeSingle(),
      sb.from('parcours_state').select('auto_enable_threshold').eq('role_kind', 'financeur').maybeSingle(),
    ])
    complete = st?.dossiers_complete_count ?? 0
    threshold = p?.auto_enable_threshold ?? null
  } catch { /* ignore */ }
  const pct = threshold && complete != null ? Math.min(100, Math.round((complete / threshold) * 100)) : null

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="text-4xl mb-4">🏦</div>
        <h1 className="text-3xl font-bold mb-3">Parcours Financeur en préparation</h1>
        <p className="text-gray-400 mb-6">
          Nous ouvrons l'accès aux financeurs dès qu'une masse critique de dossiers de crédit sera
          disponible sur la plateforme. Inscrivez-vous pour être notifié à l'ouverture.
        </p>
        {threshold && complete != null && pct != null && (
          <div className="mb-6">
            <div className="text-xs text-gray-500 mb-2">
              {complete}/{threshold} dossiers complets ({pct}%)
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="h-full rounded-full"
                style={{ width: `${pct}%`, background: '#34D399' }} />
            </div>
          </div>
        )}
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/" className="px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)' }}>
            Retour à l'accueil
          </Link>
          <Link href="/finance/waitlist"
            className="px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: '#34D399', color: '#07090F' }}>
            Rejoindre la liste d'attente →
          </Link>
        </div>
      </div>
    </div>
  )
}
