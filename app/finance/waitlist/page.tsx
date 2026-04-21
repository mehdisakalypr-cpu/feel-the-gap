import type { Metadata } from 'next'
import WaitlistForm from '@/components/WaitlistForm'
import Link from 'next/link'

export const metadata: Metadata = {
  title: "Liste d'attente · Financeurs — Feel The Gap",
  description: "Recevez un accès prioritaire au catalogue de dossiers de financement dès son ouverture. Remise Founding Pioneer -30% à vie.",
}

export default function FinanceWaitlistPage() {
  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-xs text-gray-500 mb-4">
          <Link href="/finance" className="hover:text-gray-300">← Retour</Link>
        </div>
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold mb-4"
            style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#34D399' }}>
            🏦 Portail Financeurs
          </span>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Prenez place avant l'ouverture<br />
            <span style={{ background: 'linear-gradient(135deg,#34D399,#10B981)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
              du deal flow crédit.
            </span>
          </h1>
          <p className="text-gray-400 text-base max-w-xl mx-auto">
            Nous ouvrons le catalogue aux financeurs quand 50 dossiers qualifiés sont prêts.
            Les 50 premiers inscrits deviennent <strong className="text-[#C9A84C]">Founding Pioneers</strong> : -30 % à vie
            sur leur abonnement + accès prioritaire au pipeline.
          </p>
        </div>

        <WaitlistForm role="financeur" accentColor="#34D399" />
      </div>
    </div>
  )
}
