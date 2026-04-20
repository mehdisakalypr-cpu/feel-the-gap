import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Investir — Feel The Gap',
  description: "Dossiers d'investissement curés : opportunités d'import/export à fort ROI, producteurs locaux, deal flow avec marges documentées, du ticket artisanal au tour B2B institutionnel.",
  openGraph: {
    title: 'Deal Flow Investisseurs — Feel The Gap',
    description: "Accès aux opportunités d'investissement dans l'économie réelle : gaps d'import, production locale, commerce international structuré.",
    type: 'website',
  },
}

export default function InvestLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
