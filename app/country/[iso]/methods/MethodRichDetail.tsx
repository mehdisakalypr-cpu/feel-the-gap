'use client'

/**
 * MethodRichDetail — Production 3.0 v2 (Shaka 2026-04-21)
 *
 * Rendu riche du détail d'une méthode de production sélectionnée :
 * - process_steps_json : étapes ordonnées du process
 * - diagrams_json : flux structurés (flow/ascii)
 * - comparison_table_json : tableau comparatif vs autres méthodes
 * - graph_data_json : graphique Recharts (bar/line/pie)
 * - pros_cons_json : forces/faiblesses
 *
 * YouTube reste en complément via method_media (video).
 *
 * Sécurité : pas de SVG inline (XSS risk). Les diagrammes sont structurés
 * JSON (nodes/edges) rendus côté client, ou ascii pre-formatté (text only).
 */

import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// ── Types JSONB ────────────────────────────────────────────────────────────

export type ProcessStep = {
  order: number
  title: string
  description_md: string
  duration?: string
  icon?: string
}

export type DiagramFlow = {
  id: string
  title: string
  type: 'flow' | 'ascii'
  ascii?: string
  nodes?: { id: string; label: string }[]
  edges?: { from: string; to: string; label?: string }[]
}

export type ComparisonTable = {
  headers: string[]
  rows: string[][]
}

export type GraphData = {
  type: 'bar' | 'line' | 'pie' | 'radar'
  xKey?: string
  series: { name: string; dataKey: string; color?: string }[]
  data: Record<string, string | number>[]
}

export type ProsCons = {
  pros: string[]
  cons: string[]
}

// ── Sub-renderers ──────────────────────────────────────────────────────────

function ProcessStepsRenderer({ steps }: { steps: ProcessStep[] }) {
  if (!steps.length) return null
  return (
    <div className="space-y-3 md:col-span-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">Étapes du process</div>
      <ol className="relative border-l border-[rgba(201,168,76,.25)] ml-2 space-y-4">
        {steps.map(s => (
          <li key={s.order} className="pl-5 relative">
            <span className="absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-[#C9A84C] text-[#07090F] text-[10px] font-bold flex items-center justify-center">
              {s.order}
            </span>
            <div className="flex items-baseline gap-2">
              {s.icon && <span className="text-sm">{s.icon}</span>}
              <span className="font-semibold text-white text-sm">{s.title}</span>
              {s.duration && (
                <span className="text-[10px] text-gray-500 font-mono">· {s.duration}</span>
              )}
            </div>
            <div className="text-xs text-gray-300 mt-1 whitespace-pre-line leading-relaxed">
              {s.description_md}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function DiagramRenderer({ diagram }: { diagram: DiagramFlow }) {
  if (diagram.type === 'ascii' && diagram.ascii) {
    return (
      <pre className="bg-white/5 border border-white/10 rounded-xl p-3 text-[11px] text-gray-300 font-mono overflow-x-auto whitespace-pre">
        {diagram.ascii}
      </pre>
    )
  }
  if (diagram.type === 'flow' && diagram.nodes) {
    const edges = diagram.edges ?? []
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-3">
        <div className="flex items-center flex-wrap gap-2">
          {diagram.nodes.map((n, i) => {
            const outgoing = edges.find(e => e.from === n.id)
            return (
              <span key={n.id} className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1.5 bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded text-white font-medium">
                  {n.label}
                </span>
                {i < diagram.nodes!.length - 1 && (
                  <span className="text-[#C9A84C] flex flex-col items-center">
                    <span>→</span>
                    {outgoing?.label && (
                      <span className="text-[9px] text-gray-500 -mt-0.5">{outgoing.label}</span>
                    )}
                  </span>
                )}
              </span>
            )
          })}
        </div>
      </div>
    )
  }
  return null
}

function DiagramsRenderer({ diagrams }: { diagrams: DiagramFlow[] }) {
  if (!diagrams.length) return null
  return (
    <div className="space-y-3 md:col-span-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">Schémas</div>
      <div className="space-y-3">
        {diagrams.map(d => (
          <div key={d.id}>
            <div className="text-xs text-gray-400 font-medium mb-1.5">{d.title}</div>
            <DiagramRenderer diagram={d} />
          </div>
        ))}
      </div>
    </div>
  )
}

function ComparisonTableRenderer({ table }: { table: ComparisonTable }) {
  if (!table.headers?.length || !table.rows?.length) return null
  return (
    <div className="space-y-2 md:col-span-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">Comparaison vs autres méthodes</div>
      <div className="overflow-x-auto bg-white/5 border border-white/10 rounded-xl">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-[#C9A84C]/5">
              {table.headers.map((h, i) => (
                <th
                  key={i}
                  className={`px-3 py-2 text-left font-semibold uppercase tracking-wide text-[10px] ${
                    i === 1 ? 'text-[#C9A84C]' : 'text-gray-400'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {table.rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-white/[.02]">
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className={`px-3 py-2 ${
                      cIdx === 0 ? 'text-gray-400 font-medium' : cIdx === 1 ? 'text-white font-semibold' : 'text-gray-300'
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GraphRenderer({ graph }: { graph: GraphData }) {
  if (!graph.series?.length || !graph.data?.length) return null

  const chart = (() => {
    if (graph.type === 'bar') {
      return (
        <BarChart data={graph.data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,.05)" />
          <XAxis dataKey={graph.xKey} stroke="#6b7280" fontSize={10} />
          <YAxis stroke="#6b7280" fontSize={10} />
          <Tooltip contentStyle={{ background: '#0D1117', border: '1px solid rgba(201,168,76,.25)', borderRadius: 8, fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {graph.series.map(s => (
            <Bar key={s.dataKey} dataKey={s.dataKey} fill={s.color ?? '#C9A84C'} name={s.name} />
          ))}
        </BarChart>
      )
    }
    if (graph.type === 'line') {
      return (
        <LineChart data={graph.data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,.05)" />
          <XAxis dataKey={graph.xKey} stroke="#6b7280" fontSize={10} />
          <YAxis stroke="#6b7280" fontSize={10} />
          <Tooltip contentStyle={{ background: '#0D1117', border: '1px solid rgba(201,168,76,.25)', borderRadius: 8, fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {graph.series.map(s => (
            <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} stroke={s.color ?? '#C9A84C'} name={s.name} strokeWidth={2} />
          ))}
        </LineChart>
      )
    }
    if (graph.type === 'pie') {
      const s = graph.series[0]
      const colors = ['#C9A84C', '#60A5FA', '#34D399', '#A78BFA', '#F472B6']
      return (
        <PieChart>
          <Pie
            data={graph.data}
            dataKey={s.dataKey}
            nameKey={graph.xKey ?? 'name'}
            outerRadius={80}
            label={{ fontSize: 10 }}
          >
            {graph.data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: '#0D1117', border: '1px solid rgba(201,168,76,.25)', borderRadius: 8, fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
        </PieChart>
      )
    }
    return null
  })()

  if (!chart) return null

  return (
    <div className="space-y-2 md:col-span-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">Données chiffrées</div>
      <div className="bg-white/5 border border-white/10 rounded-xl p-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          {chart}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ProsConsRenderer({ prosCons }: { prosCons: ProsCons }) {
  const { pros, cons } = prosCons
  if (!pros?.length && !cons?.length) return null
  return (
    <div className="space-y-2 md:col-span-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">Forces / Faiblesses</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {pros?.length > 0 && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
            <div className="text-[10px] uppercase font-semibold text-emerald-400 mb-2">✓ Forces</div>
            <ul className="space-y-1.5">
              {pros.map((p, i) => (
                <li key={i} className="text-xs text-gray-300 flex gap-2">
                  <span className="text-emerald-400 shrink-0">▪</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {cons?.length > 0 && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
            <div className="text-[10px] uppercase font-semibold text-red-400 mb-2">✕ Faiblesses</div>
            <ul className="space-y-1.5">
              {cons.map((c, i) => (
                <li key={i} className="text-xs text-gray-300 flex gap-2">
                  <span className="text-red-400 shrink-0">▪</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────

export function MethodRichSections({
  processSteps,
  diagrams,
  comparisonTable,
  graphData,
  prosCons,
}: {
  processSteps?: ProcessStep[]
  diagrams?: DiagramFlow[]
  comparisonTable?: ComparisonTable
  graphData?: GraphData
  prosCons?: ProsCons
}) {
  return (
    <>
      {processSteps && processSteps.length > 0 && <ProcessStepsRenderer steps={processSteps} />}
      {prosCons && (prosCons.pros?.length > 0 || prosCons.cons?.length > 0) && <ProsConsRenderer prosCons={prosCons} />}
      {comparisonTable && comparisonTable.rows?.length > 0 && <ComparisonTableRenderer table={comparisonTable} />}
      {graphData && graphData.data?.length > 0 && <GraphRenderer graph={graphData} />}
      {diagrams && diagrams.length > 0 && <DiagramsRenderer diagrams={diagrams} />}
    </>
  )
}
