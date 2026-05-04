// SVG charts pour rapport-exemple FTG · zero deps.

const W = 720;
const H = 280;

export function MonthlyFlowChart({
  data,
}: {
  data: { month: string; volume_usd_m: number; yoy_pct: number; tariff_eu_pct: number }[];
}) {
  const PAD = { top: 20, right: 50, bottom: 36, left: 56 };
  if (!data.length) return null;
  const maxY = Math.max(...data.map((d) => d.volume_usd_m)) * 1.1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const xScale = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const yScale = (v: number) => PAD.top + innerH - (v / maxY) * innerH;
  const line = data.map((d, i) => `${xScale(i)},${yScale(d.volume_usd_m)}`).join(" ");
  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={{ fontSize: 13, color: "#cfd2dc", marginBottom: 8, fontWeight: 600 }}>
        Volume mensuel HS-9018 IN→FR · USD millions (12 derniers mois)
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", background: "rgba(255,255,255,.02)", borderRadius: 8 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH * (1 - t)} y2={PAD.top + innerH * (1 - t)} stroke="rgba(255,255,255,.06)" strokeDasharray="3 4" />
            <text x={PAD.left - 8} y={PAD.top + innerH * (1 - t) + 4} textAnchor="end" fontSize={10} fill="#94a3b8">${(maxY * t).toFixed(0)}M</text>
          </g>
        ))}
        {data.map((d, i) => (
          <rect key={i} x={xScale(i) - 12} y={yScale(d.volume_usd_m)} width={22} height={H - PAD.bottom - yScale(d.volume_usd_m)} fill="#C9A84C" fillOpacity={0.6} rx={3} />
        ))}
        <polyline points={line} stroke="#C9A84C" strokeWidth={2.4} fill="none" />
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="rgba(255,255,255,.18)" />
        {data.map((d, i) => i % 2 === 0 && (
          <text key={i} x={xScale(i)} y={H - PAD.bottom + 16} textAnchor="middle" fontSize={9} fill="#94a3b8">{d.month}</text>
        ))}
      </svg>
    </figure>
  );
}

export function TariffEventsTimeline({
  events,
}: {
  events: { date: string; title: string; desc: string; impact: string; risk: string }[];
}) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 0, position: "relative" }}>
      {events.map((e, i) => {
        const planned = e.date.includes("planned");
        const color = e.risk === "P1" ? "#fbbf24" : e.risk === "P2" ? "#A78BFA" : "#ef4444";
        return (
          <li key={i} style={{ display: "grid", gridTemplateColumns: "140px 22px 1fr", gap: 14, paddingBottom: i === events.length - 1 ? 0 : 18, position: "relative" }}>
            <div style={{ fontSize: 11, color: planned ? "#fbbf24" : color, fontWeight: 700, paddingTop: 2 }}>{e.date}</div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 6, top: 4, width: 10, height: 10, background: color, borderRadius: "50%" }} />
              {i !== events.length - 1 && <span style={{ position: "absolute", left: 10, top: 14, bottom: -6, width: 1, background: "rgba(255,255,255,.12)" }} />}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{e.title} <span style={{ fontSize: 10, color, marginLeft: 6, padding: "1px 6px", border: `1px solid ${color}40`, borderRadius: 4 }}>{e.risk}</span></div>
              <div style={{ fontSize: 12, color: "#cfd2dc", marginBottom: 4, lineHeight: 1.55 }}>{e.desc}</div>
              <div style={{ fontSize: 11, color: "#fbbf24", lineHeight: 1.5 }}>📌 Impact : {e.impact}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function OpportunityRadar({
  axes,
}: {
  axes: { axis: string; score: number; weight_pct: number }[];
}) {
  const W2 = 420;
  const H2 = 380;
  const cx = W2 / 2;
  const cy = H2 / 2 - 4;
  const radius = 130;
  const points = axes.map((a, i) => {
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    return { angle, x: cx + Math.cos(angle) * radius * (a.score / 100), y: cy + Math.sin(angle) * radius * (a.score / 100), labelX: cx + Math.cos(angle) * (radius + 24), labelY: cy + Math.sin(angle) * (radius + 24), score: a.score, axis: a.axis };
  });
  const polyPoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const totalScore = axes.reduce((sum, a) => sum + (a.score * a.weight_pct) / 100, 0);
  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={{ fontSize: 13, color: "#cfd2dc", marginBottom: 8, fontWeight: 600 }}>
        Score d&apos;opportunité FTG · 7 axes · pondéré
      </figcaption>
      <svg viewBox={`0 0 ${W2} ${H2}`} style={{ width: "100%", height: "auto", background: "rgba(255,255,255,.02)", borderRadius: 8 }}>
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <polygon
            key={r}
            points={axes.map((_, i) => {
              const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
              return `${cx + Math.cos(angle) * radius * r},${cy + Math.sin(angle) * radius * r}`;
            }).join(" ")}
            fill="none"
            stroke="rgba(255,255,255,.07)"
          />
        ))}
        {points.map((p, i) => (
          <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(p.angle) * radius} y2={cy + Math.sin(p.angle) * radius} stroke="rgba(255,255,255,.08)" />
        ))}
        <polygon points={polyPoints} fill="#C9A84C" fillOpacity={0.18} stroke="#C9A84C" strokeWidth={2} />
        {points.map((p) => (
          <circle key={p.axis} cx={p.x} cy={p.y} r={4} fill="#C9A84C" stroke="#0D1117" strokeWidth={1.5} />
        ))}
        {points.map((p) => (
          <text key={p.axis + "-l"} x={p.labelX} y={p.labelY + 4} textAnchor={p.angle > -Math.PI / 2 + 0.1 && p.angle < Math.PI / 2 - 0.1 ? "start" : p.angle > Math.PI / 2 + 0.1 || p.angle < -Math.PI / 2 - 0.1 ? "end" : "middle"} fontSize={10} fill="#cfd2dc">{p.axis}</text>
        ))}
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize={28} fill="#C9A84C" fontWeight={900}>{totalScore.toFixed(0)}</text>
        <text x={cx} y={cy + 26} textAnchor="middle" fontSize={11} fill="#94a3b8">/100</text>
      </svg>
    </figure>
  );
}
