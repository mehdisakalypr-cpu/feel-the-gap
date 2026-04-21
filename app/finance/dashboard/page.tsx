import InvestorDashboard from '@/components/InvestorDashboard'

export const metadata = {
  title: 'Mon pipeline · Financeur — Feel The Gap',
  description: 'Suivi de vos offres de financement envoyées, quota, abonnement Finance.',
}

export default function FinanceDashboardPage() {
  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <InvestorDashboard role="financeur" accentColor="#34D399" catalogHref="/finance/reports" />
    </div>
  )
}
