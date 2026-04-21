'use client'

import { useState } from 'react'
import CategoryFilter, { type FilterSelection } from '@/components/CategoryFilter'
import MapLoader from '@/components/MapLoader'
import MapCountrySearch from '@/components/MapCountrySearch'

export default function MapPage() {
  const [selection, setSelection] = useState<FilterSelection>({ categories: [], subs: [] })

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden isolate">
      <div className="flex flex-1 overflow-hidden">
        <CategoryFilter onSelectionChange={setSelection} />
        <main className="flex-1 relative">
          <MapCountrySearch />
          <MapLoader activeCategories={selection.categories} activeSubs={selection.subs} />
        </main>
      </div>
    </div>
  )
}
