'use client'

import { useState } from 'react'
import CategoryFilter, { type FilterSelection } from '@/components/CategoryFilter'
import MapLoader from '@/components/MapLoader'

export default function MapPage() {
  const [selection, setSelection] = useState<FilterSelection>({ categories: [], subs: [] })

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <CategoryFilter onSelectionChange={setSelection} />
        <main className="flex-1 relative">
          <MapLoader activeCategories={selection.categories} activeSubs={selection.subs} />
        </main>
      </div>
    </div>
  )
}
