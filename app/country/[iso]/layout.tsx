// CountrySidebar removed — JourneySidebar is the canonical menu now.
// Pages under /country/[iso]/* render JourneySidebar themselves when needed.
export default function CountryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
