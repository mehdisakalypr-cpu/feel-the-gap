import DossierDetail from '@/components/DossierDetail'

export default async function InvestDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <DossierDetail dossierId={id} accentColor="#60A5FA" baseHref="/invest/reports" />
    </div>
  )
}
