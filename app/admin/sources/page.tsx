'use client'

import { useState, useEffect } from 'react'
import { DATA_SOURCES, SOURCES_BY_CATEGORY, CATEGORY_LABELS, type DataSource, type SourceCategory } from '@/lib/data-sources-catalog'
import { supabase } from '@/lib/supabase'

const TYPE_CONFIG = {
  free:      { label: 'Gratuit',    color: '#34D399', bg: '#34D39920' },
  freemium:  { label: 'Freemium',   color: '#FBBF24', bg: '#FBBF2420' },
  paid:      { label: 'Payant',     color: '#F87171', bg: '#F8717120' },
}

const CATEGORY_ORDER: SourceCategory[] = ['trade_flows', 'macro', 'national_stats', 'agriculture', 'energy', 'consumer', 'financial']

export default function SourcesPage() {
  const [activeTab, setActiveTab] = useState<SourceCategory | 'all'>('all')
  const [enabled, setEnabled] = useState<Set<string>>(new Set())
  const [triggering, setTriggering] = useState<string | null>(null)
  const [lastRuns, setLastRuns] = useState<Record<string, string>>({})
  const [recordCounts, setRecordCounts] = useState<{ countries: number; trade_flows: number; opportunities: number }>({ countries: 0, trade_flows: 0, opportunities: 0 })

  // Load enabled state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ftg_enabled_sources')
      if (saved) {
        const parsed = JSON.parse(saved) as string[]
        setEnabled(new Set(parsed))
      } else {
        // Default: all free sources enabled
        setEnabled(new Set(DATA_SOURCES.filter(s => s.type === 'free').map(s => s.id)))
      }
    } catch {}
  }, [])

  // Load last run dates + DB counts
  useEffect(() => {
    supabase.from('agent_runs')
      .select('agent, started_at, records_inserted')
      .order('started_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const runs: Record<string, string> = {}
        for (const r of data ?? []) {
          if (!runs[r.agent]) runs[r.agent] = r.started_at
        }
        setLastRuns(runs)
      })

    Promise.all([
      supabase.from('countries').select('*', { count: 'exact', head: true }),
      supabase.from('trade_flows').select('*', { count: 'exact', head: true }),
      supabase.from('opportunities').select('*', { count: 'exact', head: true }),
    ]).then(([{ count: c }, { count: tf }, { count: o }]) => {
      setRecordCounts({ countries: c ?? 0, trade_flows: tf ?? 0, opportunities: o ?? 0 })
    })
  }, [])

  function toggleSource(id: string) {
    setEnabled(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      localStorage.setItem('ftg_enabled_sources', JSON.stringify(Array.from(next)))
      return next
    })
  }

  async function triggerCollection(sourceId: string) {
    setTriggering(sourceId)
    try {
      const res = await fetch(`/api/admin/collect?source=${sourceId}`, { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        alert(`✓ Collecte déclenchée pour ${sourceId}. Les données seront disponibles dans quelques minutes.`)
      } else {
        alert('Erreur: ' + (data.error ?? 'Unknown'))
      }
    } catch {
      alert('Erreur réseau')
    }
    setTriggering(null)
  }

  async function triggerFullCollection() {
    setTriggering('all')
    try {
      const res = await fetch('/api/admin/collect?source=all', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        alert('✓ Collecte complète déclenchée (toutes sources gratuites). Durée estimée : 5-10 minutes.')
      } else {
        alert('Erreur: ' + (data.error ?? 'Unknown'))
      }
    } catch {
      alert('Erreur réseau')
    }
    setTriggering(null)
  }

  async function triggerExhaustive(mode: 'full' | 'europe' | 'missing') {
    const label = { full: 'monde entier (190+ pays)', europe: 'Europe uniquement (47 pays)', missing: 'pays sans données uniquement' }
    if (!confirm(`Lancer la collecte exhaustive pour ${label[mode]} ?\n\nCela peut prendre 20-60 minutes. La tâche s'exécute en arrière-plan.`)) return
    setTriggering(`exhaustive_${mode}`)
    try {
      const res = await fetch('/api/admin/collect-exhaustive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, year: 2023 }),
      })
      const data = await res.json()
      if (data.ok) {
        alert(`✓ ${data.message}\n\nLes données apparaîtront progressivement sur la carte et les fiches pays. Consultez "Recent Data Runs" sur la page Overview pour suivre la progression.`)
      } else {
        alert('Erreur: ' + (data.error ?? 'Unknown'))
      }
    } catch {
      alert('Erreur réseau')
    }
    setTriggering(null)
  }

  const displayedSources = activeTab === 'all' ? DATA_SOURCES : (SOURCES_BY_CATEGORY[activeTab] ?? [])
  const freeSources = DATA_SOURCES.filter(s => s.type === 'free')
  const paidSources = DATA_SOURCES.filter(s => s.type === 'paid')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sources de données</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez les sources actives · {freeSources.length} gratuites, {paidSources.length} payantes</p>
        </div>
        <button
          onClick={triggerFullCollection}
          disabled={triggering !== null}
          className="px-4 py-2 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl text-sm hover:bg-[#E8C97A] transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {triggering === 'all' ? (
            <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75"/></svg> En cours…</>
          ) : '▶ Lancer collecte complète'}
        </button>
      </div>

      {/* DB Status */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pays en DB', value: recordCounts.countries, color: '#C9A84C', icon: '🌍' },
          { label: 'Flux commerciaux', value: recordCounts.trade_flows, color: '#60A5FA', icon: '📦' },
          { label: 'Opportunités', value: recordCounts.opportunities, color: '#34D399', icon: '💡' },
        ].map(s => (
          <div key={s.label} className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl">{s.icon}</span>
            <div>
              <div className="text-xl font-bold" style={{ color: s.color }}>{s.value.toLocaleString()}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Exhaustive collection panel */}
      <div className="bg-[#0D1117] border border-[#C9A84C]/20 rounded-xl p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/10 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-white mb-1">Agent de collecte exhaustive</h2>
            <p className="text-xs text-gray-400">
              Collecte en profondeur depuis toutes les sources gratuites (World Bank, FAO, WTO, Eurostat, CIA Factbook, OECD…) pour tous les pays du monde.
              S'exécute en arrière-plan, peut prendre 20-60 minutes pour la couverture complète.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => triggerExhaustive('missing')}
            disabled={triggering !== null}
            className="px-4 py-2 bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30 rounded-xl text-sm font-semibold hover:bg-[#34D399]/25 transition-colors disabled:opacity-50"
          >
            {triggering === 'exhaustive_missing' ? '⏳ En cours…' : '⚡ Pays manquants uniquement'}
          </button>
          <button
            onClick={() => triggerExhaustive('europe')}
            disabled={triggering !== null}
            className="px-4 py-2 bg-[#60A5FA]/15 text-[#60A5FA] border border-[#60A5FA]/30 rounded-xl text-sm font-semibold hover:bg-[#60A5FA]/25 transition-colors disabled:opacity-50"
          >
            {triggering === 'exhaustive_europe' ? '⏳ En cours…' : '🇪🇺 Europe complète (47 pays)'}
          </button>
          <button
            onClick={() => triggerExhaustive('full')}
            disabled={triggering !== null}
            className="px-4 py-2 bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/30 rounded-xl text-sm font-semibold hover:bg-[#C9A84C]/25 transition-colors disabled:opacity-50"
          >
            {triggering === 'exhaustive_full' ? '⏳ En cours…' : '🌍 Monde entier (190+ pays)'}
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-3">
          Les données apparaissent progressivement. Vérifiez l'avancement dans Overview → Recent Data Runs.
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeTab === 'all' ? 'bg-[#C9A84C] text-[#07090F]' : 'bg-white/5 text-gray-400 hover:text-white'}`}
        >
          Toutes ({DATA_SOURCES.length})
        </button>
        {CATEGORY_ORDER.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${activeTab === cat ? 'bg-[#C9A84C] text-[#07090F]' : 'bg-white/5 text-gray-400 hover:text-white'}`}
          >
            {CATEGORY_LABELS[cat].icon} {CATEGORY_LABELS[cat].label} ({SOURCES_BY_CATEGORY[cat].length})
          </button>
        ))}
      </div>

      {/* Sources list */}
      <div className="space-y-3">
        {displayedSources.map(source => (
          <SourceCard
            key={source.id}
            source={source}
            enabled={enabled.has(source.id)}
            onToggle={() => toggleSource(source.id)}
            onTrigger={() => triggerCollection(source.id)}
            triggering={triggering === source.id}
            lastRun={lastRuns[source.id] ?? lastRuns['free_collector'] ?? null}
          />
        ))}
      </div>
    </div>
  )
}

function SourceCard({
  source,
  enabled,
  onToggle,
  onTrigger,
  triggering,
  lastRun,
}: {
  source: DataSource
  enabled: boolean
  onToggle: () => void
  onTrigger: () => void
  triggering: boolean
  lastRun: string | null
}) {
  const typeCfg = TYPE_CONFIG[source.type]

  return (
    <div className={`bg-[#0D1117] border rounded-xl p-5 transition-colors ${enabled ? 'border-[rgba(201,168,76,.2)]' : 'border-white/5 opacity-60'}`}>
      <div className="flex items-start gap-4">
        {/* Toggle */}
        <button
          onClick={onToggle}
          className={`mt-0.5 w-10 h-5 rounded-full transition-colors shrink-0 relative ${enabled ? 'bg-[#C9A84C]' : 'bg-white/15'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-white text-sm">{source.name}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: typeCfg.bg, color: typeCfg.color }}>
              {typeCfg.label}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-gray-400">
              {source.coverage}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-gray-500">
              {source.update_frequency}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-2 leading-relaxed">{source.description}</p>

          {/* Data types */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {source.data_types.map(dt => (
              <span key={dt} className="px-2 py-0.5 bg-[#111827] rounded text-[10px] text-gray-500">{dt}</span>
            ))}
          </div>

          {source.notes && (
            <p className="text-[11px] text-[#FBBF24]/70 mb-2">ℹ️ {source.notes}</p>
          )}

          {lastRun && source.type === 'free' && (
            <p className="text-[10px] text-gray-600">
              Dernière collecte : {new Date(lastRun).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 shrink-0">
          {source.type === 'free' && (
            <button
              onClick={onTrigger}
              disabled={triggering || !enabled}
              className="px-3 py-1.5 bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30 rounded-lg text-xs font-semibold hover:bg-[#34D399]/25 transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              {triggering ? '⏳ En cours…' : '▶ Déclencher'}
            </button>
          )}
          {source.type === 'paid' && source.pricing_url && (
            <a
              href={source.pricing_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-[#F87171]/10 text-[#F87171] border border-[#F87171]/30 rounded-lg text-xs font-semibold hover:bg-[#F87171]/20 transition-colors whitespace-nowrap text-center"
            >
              Voir les tarifs ↗
            </a>
          )}
          {source.docs_url && (
            <a
              href={source.docs_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-white/5 text-gray-400 border border-white/10 rounded-lg text-xs hover:bg-white/10 transition-colors whitespace-nowrap text-center"
            >
              Documentation ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
