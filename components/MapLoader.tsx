'use client'

import dynamic from 'next/dynamic'

const WorldMap = dynamic(() => import('./WorldMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500">Loading world data…</p>
      </div>
    </div>
  ),
})

interface Props {
  activeCategories: string[]
  activeSubs: string[]
}

export default function MapLoader({ activeCategories, activeSubs }: Props) {
  return <WorldMap activeCategories={activeCategories} activeSubs={activeSubs} />
}
