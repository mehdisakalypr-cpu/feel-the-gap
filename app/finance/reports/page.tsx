import DossierFeed from '@/components/DossierFeed'

export default function FinanceReportsPage() {
  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <DossierFeed
        type="financement"
        baseHref="/finance/reports"
        accentColor="#34D399"
        title="Deal flow · Financement"
        subtitle="Dossiers de demande de crédit qualifiés et scorés, prêts pour analyse. Les identités sont anonymisées jusqu'à souscription Finance Premium."
      />
    </div>
  )
}
