import type { Metadata } from 'next'
import WaitlistForm from '@/components/WaitlistForm'
import Link from 'next/link'

export const metadata: Metadata = {
  title: "Liste d'attente · Investisseurs — Feel The Gap",
  description: "Recevez un accès prioritaire au deal flow dès ouverture. Remise Founding Pioneer -30% à vie.",
}

export default function InvestWaitlistPage() {
  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-xs text-gray-500 mb-4">
          <Link href="/invest" className="hover:text-gray-300">← Retour</Link>
        </div>
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold mb-4"
            style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#60A5FA' }}>
            📈 Portail Investisseurs
          </span>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Prenez place avant l'ouverture<br />
            <span style={{ background: 'linear-gradient(135deg,#60A5FA,#A78BFA)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
              du deal flow.
            </span>
          </h1>
          <p className="text-gray-400 text-base max-w-xl mx-auto">
            Nous ouvrons le catalogue aux investisseurs quand 50 dossiers qualifiés sont prêts.
            Les 50 premiers inscrits deviennent <strong className="text-[#C9A84C]">Founding Pioneers</strong> : -30 % à vie
            sur leur abonnement + accès prioritaire au deal flow.
          </p>
        </div>

        <WaitlistForm role="investisseur" accentColor="#60A5FA" />
      </div>
    </div>
  )
}
