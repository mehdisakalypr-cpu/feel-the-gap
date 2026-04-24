import type { Metadata } from 'next'
import WaitlistForm from '@/components/WaitlistForm'
import Link from 'next/link'

export const metadata: Metadata = {
  title: "Liste d'attente · Influenceurs — Feel The Gap",
  description: "Recevez un accès prioritaire au catalogue d'offres affiliées dès son ouverture. Remise Founding Pioneer -30% à vie.",
}

export default function InfluencerWaitlistPage() {
  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-xs text-gray-500 mb-4">
          <Link href="/" className="hover:text-gray-300">← Retour</Link>
        </div>
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold mb-4"
            style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', color: '#A78BFA' }}>
            🎤 Portail Influenceurs
          </span>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Prenez place avant l&apos;ouverture<br />
            <span style={{ background: 'linear-gradient(135deg,#A78BFA,#C9A84C)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
              du catalogue d&apos;offres.
            </span>
          </h1>
          <p className="text-gray-400 text-base max-w-xl mx-auto">
            Nous ouvrons le catalogue aux influenceurs quand 50 offres qualifiées sont prêtes.
            Les 50 premiers inscrits deviennent <strong className="text-[#C9A84C]">Founding Pioneers</strong> : -30 % à vie
            sur leur commission plateforme + accès prioritaire au catalogue.
          </p>
        </div>

        <WaitlistForm role="influenceur" accentColor="#A78BFA" />
      </div>
    </div>
  )
}
