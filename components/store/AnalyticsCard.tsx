'use client'

export interface DayBucket {
  day: string // YYYY-MM-DD
  value_cents: number
}

export function AnalyticsCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0D1117] p-5">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  )
}

export function RevenueChart({ data, accent = '#C9A84C' }: { data: DayBucket[]; accent?: string }) {
  const W = 720, H = 160, padX = 4, padY = 8
  const innerW = W - padX * 2
  const innerH = H - padY * 2
  const max = Math.max(1, ...data.map(d => d.value_cents))
  const barW = innerW / Math.max(1, data.length) - 2

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" className="block">
        <line x1={0} y1={H - padY} x2={W} y2={H - padY} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
        {data.map((d, i) => {
          const h = (d.value_cents / max) * innerH
          const x = padX + i * (innerW / data.length)
          const y = H - padY - h
          return (
            <g key={d.day}>
              <rect x={x + 1} y={y} width={Math.max(2, barW)} height={Math.max(0.5, h)} fill={accent} opacity={d.value_cents ? 0.9 : 0.15} rx={1} />
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-gray-500">
        <span>{data[0]?.day}</span>
        <span>{data[Math.floor(data.length / 2)]?.day}</span>
        <span>{data[data.length - 1]?.day}</span>
      </div>
    </div>
  )
}
