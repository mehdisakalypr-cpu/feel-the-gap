import Topbar from '@/components/Topbar'
import CategoryFilter from '@/components/CategoryFilter'
import MapLoader from '@/components/MapLoader'

export default function MapPage() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <CategoryFilter />
        <main className="flex-1 relative">
          <MapLoader />
        </main>
      </div>
    </div>
  )
}
