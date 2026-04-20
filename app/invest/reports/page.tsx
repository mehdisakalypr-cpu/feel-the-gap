import type { Metadata } from 'next'
import DossierFeed from '@/components/DossierFeed'

export const metadata: Metadata = {
  title: 'Deal Flow Investissement — Feel The Gap',
  description: "Dossiers de levée de fonds qualifiés et scorés, prêts pour due diligence. Identités anonymisées jusqu'à souscription Invest Premium.",
  openGraph: {
    title: 'Deal Flow Investissement — Feel The Gap',
    description: "Dossiers de levée de fonds qualifiés et scorés, prêts pour due diligence.",
    type: 'website',
  },
}

export default function InvestReportsPage() {
  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <DossierFeed
        type="investissement"
        baseHref="/invest/reports"
        accentColor="#60A5FA"
        title="Deal flow · Investissement"
        subtitle="Dossiers de levée de fonds qualifiés et scorés, prêts pour due diligence. Les identités sont anonymisées jusqu'à souscription Invest Premium."
      />
    </div>
  )
}
