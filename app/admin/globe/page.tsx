import GlobeClient from './GlobeClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'BANKAI — Revenue Globe' }

export default function Page() {
  // Admin gate hérité de app/admin/layout.tsx. Pré-filtré FTG par défaut.
  return <GlobeClient initialSite="ftg" />
}
