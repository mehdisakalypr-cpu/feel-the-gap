import InvestorDashboard from '@/components/InvestorDashboard'

export const metadata = {
  title: 'Mon pipeline · Investisseur — Feel The Gap',
  description: 'Suivi de vos propositions d\'investissement, quota, abonnement Invest.',
}

export default function InvestDashboardPage() {
  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <InvestorDashboard role="investisseur" accentColor="#60A5FA" catalogHref="/invest/reports" />
    </div>
  )
}
