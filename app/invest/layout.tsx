import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { isParcoursEnabled } from '@/lib/feature-flags'
import { createSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Investir — Feel The Gap',
  description: "Dossiers d'investissement curés : opportunités d'import/export à fort ROI, producteurs locaux, deal flow avec marges documentées, du ticket artisanal au tour B2B institutionnel.",
  openGraph: {
    title: 'Deal Flow Investisseurs — Feel The Gap',
    description: "Accès aux opportunités d'investissement dans l'économie réelle : gaps d'import, production locale, commerce international structuré.",
    type: 'website',
  },
}

export default async function InvestLayout({ children }: { children: React.ReactNode }) {
  // Waitlist stays reachable even when the parcours is gated.
  const hdrs = await headers()
  const pathname = hdrs.get('x-pathname') ?? ''
  if (pathname.startsWith('/invest/waitlist')) return <>{children}</>

  const enabled = await isParcoursEnabled('investisseur')
  if (enabled) return <>{children}</>

  let complete: number | null = null
  let threshold: number | null = null
  try {
    const sb = await createSupabaseServer()
    const [{ data: st }, { data: p }] = await Promise.all([
      sb.from('marketplace_state').select('dossiers_complete_count').eq('id', 1).maybeSingle(),
      sb.from('parcours_state').select('auto_enable_threshold').eq('role_kind', 'investisseur').maybeSingle(),
    ])
    complete = st?.dossiers_complete_count ?? 0
    threshold = p?.auto_enable_threshold ?? null
  } catch { /* ignore */ }
  const pct = threshold && complete != null ? Math.min(100, Math.round((complete / threshold) * 100)) : null

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="text-4xl mb-4">📈</div>
        <h1 className="text-3xl font-bold mb-3">Parcours Investisseur en préparation</h1>
        <p className="text-gray-400 mb-6">
          Nous ouvrons l'accès aux investisseurs dès qu'une masse critique de dossiers de levée sera
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
                style={{ width: `${pct}%`, background: '#60A5FA' }} />
            </div>
          </div>
        )}
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/" className="px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)' }}>
            Retour à l'accueil
          </Link>
          <Link href="/invest/waitlist"
            className="px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: '#60A5FA', color: '#07090F' }}>
            Rejoindre la liste d'attente →
          </Link>
        </div>
      </div>
    </div>
  )
}
