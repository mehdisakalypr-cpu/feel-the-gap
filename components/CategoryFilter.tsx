'use client'

import { useState } from 'react'
import type { TradeCategory } from '@/types/database'

const CATEGORIES: { id: TradeCategory | 'all'; label: string; icon: string; color: string }[] = [
  { id: 'all',          label: 'All',         icon: '🌐', color: '#C9A84C' },
  { id: 'agriculture',  label: 'Agriculture', icon: '🌾', color: '#22C55E' },
  { id: 'energy',       label: 'Energy',      icon: '⚡', color: '#F59E0B' },
  { id: 'materials',    label: 'Materials',   icon: '🪨', color: '#94A3B8' },
  { id: 'manufactured', label: 'Industrial',  icon: '🏭', color: '#60A5FA' },
  { id: 'resources',    label: 'Resources',   icon: '💧', color: '#38BDF8' },
]

const SUBCATEGORIES: Record<string, { id: string; label: string }[]> = {
  agriculture:  [
    { id: 'cereals',     label: 'Cereals' },
    { id: 'vegetables',  label: 'Vegetables' },
    { id: 'fruits',      label: 'Fruits' },
    { id: 'meat',        label: 'Meat' },
    { id: 'seafood',     label: 'Seafood' },
    { id: 'dairy',       label: 'Dairy' },
    { id: 'oilseeds',    label: 'Oilseeds' },
    { id: 'sugar',       label: 'Sugar' },
  ],
  energy: [
    { id: 'crude_oil',    label: 'Crude Oil' },
    { id: 'natural_gas',  label: 'Natural Gas' },
    { id: 'electricity',  label: 'Electricity' },
    { id: 'coal',         label: 'Coal' },
    { id: 'renewables',   label: 'Renewables' },
  ],
  materials: [
    { id: 'iron_steel',   label: 'Iron & Steel' },
    { id: 'copper',       label: 'Copper' },
    { id: 'aluminium',    label: 'Aluminium' },
    { id: 'timber',       label: 'Timber' },
    { id: 'chemicals',    label: 'Chemicals' },
    { id: 'fertilizers',  label: 'Fertilizers' },
  ],
  manufactured: [
    { id: 'electronics',  label: 'Electronics' },
    { id: 'machinery',    label: 'Machinery' },
    { id: 'textiles',     label: 'Textiles' },
    { id: 'pharma',       label: 'Pharma' },
    { id: 'vehicles',     label: 'Vehicles' },
  ],
  resources: [
    { id: 'water',        label: 'Water' },
    { id: 'ag_inputs',    label: 'Ag Inputs' },
    { id: 'seeds',        label: 'Seeds' },
  ],
}

interface Props {
  onCategoryChange?: (cat: TradeCategory | 'all', sub?: string) => void
}

export default function CategoryFilter({ onCategoryChange }: Props) {
  const [active, setActive] = useState<TradeCategory | 'all'>('all')
  const [activeSub, setActiveSub] = useState<string | null>(null)

  function select(cat: TradeCategory | 'all') {
    setActive(cat)
    setActiveSub(null)
    onCategoryChange?.(cat)
  }

  function selectSub(sub: string) {
    const next = activeSub === sub ? null : sub
    setActiveSub(next)
    onCategoryChange?.(active, next ?? undefined)
  }

  const subs = active !== 'all' ? SUBCATEGORIES[active] ?? [] : []
  const activeColor = CATEGORIES.find(c => c.id === active)?.color ?? '#C9A84C'

  return (
    <aside className="w-52 flex flex-col border-r border-[rgba(201,168,76,.1)] bg-[#0D1117] shrink-0 overflow-y-auto">
      <div className="p-3 border-b border-[rgba(201,168,76,.1)]">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Category</p>
        <div className="space-y-0.5">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => select(cat.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all text-left ${
                active === cat.id
                  ? 'text-white font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              style={active === cat.id ? { background: cat.color + '1A', color: cat.color } : {}}
            >
              <span className="text-base leading-none">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {subs.length > 0 && (
        <div className="p-3">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Filter</p>
          <div className="space-y-0.5">
            {subs.map(s => (
              <button
                key={s.id}
                onClick={() => selectSub(s.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-all text-left ${
                  activeSub === s.id ? 'font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                style={activeSub === s.id ? { color: activeColor, background: activeColor + '1A' } : {}}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0`}
                  style={{ background: activeSub === s.id ? activeColor : '#374151' }} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-auto p-3 border-t border-[rgba(201,168,76,.1)]">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Trade Balance</p>
        <div className="space-y-1 text-xs text-gray-400">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#22C55E]"/><span>Surplus</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#EF4444]"/><span>Deficit</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#6B7280]"/><span>No data</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#C9A84C]"/><span>Opportunity</span></div>
        </div>
      </div>
    </aside>
  )
}
