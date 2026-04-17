// `JourneyContextProvider` keeps the journey store (active product + iso)
// in sync with `?product=&iso=` across every step of the journey — the
// reports page feeds the store with `selectedProducts` from checked opps.
import JourneyContextProvider from '@/components/JourneyContextProvider'

export default function ReportIsoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <JourneyContextProvider>{children}</JourneyContextProvider>
}
