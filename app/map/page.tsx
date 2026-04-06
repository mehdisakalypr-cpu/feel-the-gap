import { Suspense } from 'react'
import Topbar from '@/components/Topbar'
import CategoryFilter from '@/components/CategoryFilter'
import dynamic from 'next/dynamic'

// Leaflet must be loaded client-side only
const WorldMap = dynamic(() => import('@/components/WorldMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500">Loading world data…</p>
      </div>
    </div>
  ),
})

export default function MapPage() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <CategoryFilter />
        <main className="flex-1 relative">
          <Suspense>
            <WorldMap />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
