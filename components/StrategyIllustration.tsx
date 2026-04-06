'use client'

import React from 'react'

// Animated SVG illustrations per strategy × category combination
// Each returns a self-contained <svg> with CSS animations

type Strategy = 'trade' | 'production' | 'training'
type Category = 'energy' | 'agriculture' | 'manufactured' | 'technology' | 'all'

// ── Color palettes per strategy ───────────────────────────────────────────────

const COLORS = {
  trade:      { primary: '#60A5FA', secondary: '#1E3A5F', accent: '#93C5FD' },
  production: { primary: '#22C55E', secondary: '#14532D', accent: '#86EFAC' },
  training:   { primary: '#C9A84C', secondary: '#451A03', accent: '#FDE68A' },
}

// ── Scene: Import & Sell (🚢) ─────────────────────────────────────────────────

function TradeScene({ category }: { category: Category }) {
  const c = COLORS.trade
  return (
    <svg viewBox="0 0 240 160" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <defs>
        <style>{`
          @keyframes sail { 0%,100%{transform:translateX(0)} 50%{transform:translateX(8px)} }
          @keyframes wave { 0%,100%{d:path('M0,120 Q30,112 60,120 Q90,128 120,120 Q150,112 180,120 Q210,128 240,120 L240,160 L0,160 Z')} 50%{d:path('M0,120 Q30,128 60,120 Q90,112 120,120 Q150,128 180,120 Q210,112 240,120 L240,160 L0,160 Z')} }
          @keyframes smoke { 0%{opacity:.7;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-20px) scale(1.4)} }
          @keyframes crane { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(-6deg)} }
          @keyframes container { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
          @keyframes bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(3px)} }
        `}</style>
        <linearGradient id="sky-t" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#07090F" />
          <stop offset="100%" stopColor={c.secondary} />
        </linearGradient>
        <linearGradient id="sea-t" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c.primary} stopOpacity=".4" />
          <stop offset="100%" stopColor={c.secondary} stopOpacity=".8" />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect width="240" height="160" fill="url(#sky-t)" />

      {/* Stars */}
      {[[20,15],[60,25],[120,10],[180,20],[210,12],[40,40],[160,35]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="1" fill="white" opacity={0.4 + (i%3)*0.2} />
      ))}

      {/* Sea */}
      <path d="M0,120 Q30,112 60,120 Q90,128 120,120 Q150,112 180,120 Q210,128 240,120 L240,160 L0,160 Z"
        fill="url(#sea-t)" style={{ animation: 'wave 3s ease-in-out infinite' }} />

      {/* Ship hull — bobbing */}
      <g style={{ animation: 'bob 3s ease-in-out infinite', transformOrigin: '120px 115px' }}>
        {/* Hull */}
        <path d="M55,118 L60,130 L180,130 L185,118 Z" fill={c.secondary} stroke={c.primary} strokeWidth="1.5" />
        {/* Deck */}
        <rect x="65" y="105" width="110" height="14" rx="2" fill="#0D1B2A" stroke={c.primary} strokeWidth="1" />
        {/* Containers */}
        {category === 'energy' ? (
          <g>
            <rect x="70" y="96" width="28" height="10" rx="1" fill={c.primary} opacity=".8" />
            <rect x="101" y="96" width="28" height="10" rx="1" fill={c.accent} opacity=".6" />
            <rect x="132" y="96" width="28" height="10" rx="1" fill={c.primary} opacity=".8" />
          </g>
        ) : (
          <g style={{ animation: 'container 2s ease-in-out infinite' }}>
            {[70,95,120,145].map((x, i) => (
              <rect key={i} x={x} y="96" width="20" height="10" rx="1"
                fill={i % 2 === 0 ? c.primary : c.accent} opacity=".8" />
            ))}
          </g>
        )}
        {/* Smokestack */}
        <rect x="155" y="85" width="8" height="20" rx="2" fill="#1E293B" />
        <ellipse cx="159" cy="85" rx="5" ry="3" fill="#374151" style={{ animation: 'smoke 1.5s ease-out infinite', transformOrigin: '159px 85px' }} />
        <ellipse cx="157" cy="79" rx="4" ry="2.5" fill="#4B5563" opacity=".5" style={{ animation: 'smoke 1.5s ease-out infinite 0.3s', transformOrigin: '157px 79px' }} />
      </g>

      {/* Dock crane */}
      <g style={{ animation: 'crane 4s ease-in-out infinite', transformOrigin: '200px 90px' }}>
        <line x1="200" y1="145" x2="200" y2="60" stroke={c.primary} strokeWidth="3" />
        <line x1="200" y1="65" x2="225" y2="65" stroke={c.primary} strokeWidth="2" />
        <line x1="215" y1="65" x2="215" y2="90" stroke={c.accent} strokeWidth="1.5" strokeDasharray="2,2" />
        <rect x="210" y="90" width="10" height="8" rx="1" fill={c.primary} opacity=".7" />
      </g>

      {/* City skyline (destination) */}
      {[[10,95,12,35],[28,90,10,40],[5,100,8,30]].map(([x,y,w,h],i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="1" fill="#0D1B2A" stroke={c.primary} strokeWidth=".5" opacity=".6" />
      ))}

      {/* Label */}
      <text x="120" y="152" textAnchor="middle" fill={c.accent} fontSize="8" fontFamily="Inter,sans-serif" fontWeight="600" letterSpacing="1">
        IMPORT &amp; DISTRIBUTE
      </text>
    </svg>
  )
}

// ── Scene: Produce Locally (🏭) ───────────────────────────────────────────────

function ProductionScene({ category }: { category: Category }) {
  const c = COLORS.production
  return (
    <svg viewBox="0 0 240 160" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <defs>
        <style>{`
          @keyframes turbine { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          @keyframes piston  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
          @keyframes grow    { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(1.05)} }
          @keyframes flicker { 0%,100%{opacity:.8} 50%{opacity:1} }
          @keyframes smk2    { 0%{opacity:.6;transform:translateY(0)} 100%{opacity:0;transform:translateY(-25px) translateX(5px)} }
        `}</style>
        <linearGradient id="sky-p" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#07090F" />
          <stop offset="100%" stopColor={c.secondary} />
        </linearGradient>
      </defs>

      <rect width="240" height="160" fill="url(#sky-p)" />

      {/* Stars */}
      {[[30,18],[80,12],[140,22],[195,8],[220,18],[55,35],[170,30]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="1" fill="white" opacity={0.3 + (i%3)*0.15} />
      ))}

      {/* Ground */}
      <rect x="0" y="135" width="240" height="25" fill="#0A1A0A" />

      {/* Factory building */}
      <g style={{ transformOrigin: '100px 100px' }}>
        {/* Main building */}
        <rect x="30" y="70" width="120" height="65" fill="#0D2010" stroke={c.primary} strokeWidth="1.5" />
        {/* Roof serrations */}
        {[30,50,70,90,110,130].map((x,i) => (
          <polygon key={i} points={`${x},70 ${x+10},55 ${x+20},70`}
            fill="#0A1A0A" stroke={c.primary} strokeWidth="1" />
        ))}
        {/* Windows — lit up */}
        {[[40,85],[65,85],[90,85],[115,85],[40,105],[65,105],[90,105],[115,105]].map(([x,y],i) => (
          <rect key={i} x={x} y={y} width="12" height="8" rx="1"
            fill={c.primary} opacity={i % 3 === 0 ? 1 : 0.4}
            style={{ animation: `flicker ${1 + i * 0.3}s ease-in-out infinite` }} />
        ))}
        {/* Smokestacks */}
        {[55,85,115].map((x,i) => (
          <g key={i}>
            <rect x={x} y="45" width="10" height="28" rx="2" fill="#1A2A1A" stroke={c.primary} strokeWidth=".5" />
            <ellipse cx={x+5} cy={45} rx="6" ry="3" fill="#2D3A2D"
              style={{ animation: `smk2 ${1.5 + i*0.4}s ease-out infinite ${i*0.3}s`, transformOrigin: `${x+5}px 45px` }} />
          </g>
        ))}
      </g>

      {/* Solar panels (energy category) or wheat field (agriculture) */}
      {category === 'energy' || category === 'all' ? (
        // Wind turbines
        <g>
          {[190,215].map((x,i) => (
            <g key={i}>
              <line x1={x} y1="135" x2={x} y2="80" stroke={c.accent} strokeWidth="2" />
              <g style={{ animation: `turbine ${3+i}s linear infinite`, transformOrigin: `${x}px 80px` }}>
                <line x1={x} y1="68" x2={x} y2="80" stroke={c.primary} strokeWidth="2.5" />
                <line x1={x-10} y1="86" x2={x} y2="80" stroke={c.primary} strokeWidth="2.5" />
                <line x1={x+10} y1="86" x2={x} y2="80" stroke={c.primary} strokeWidth="2.5" />
              </g>
              <circle cx={x} cy="80" r="3" fill={c.accent} />
            </g>
          ))}
        </g>
      ) : category === 'agriculture' ? (
        // Wheat rows
        <g>
          {[165,175,185,195,205,215,225].map((x,i) => (
            <g key={i} style={{ animation: `grow 2s ease-in-out infinite ${i*0.2}s`, transformOrigin: `${x}px 135px` }}>
              <line x1={x} y1="135" x2={x} y2="105" stroke={c.primary} strokeWidth="1.5" />
              <ellipse cx={x} cy="103" rx="3" ry="5" fill={c.accent} opacity=".8" />
              <line x1={x} y1="120" x2={x-5} y2="113" stroke={c.primary} strokeWidth="1" />
              <line x1={x} y1="115" x2={x+5} y2="108" stroke={c.primary} strokeWidth="1" />
            </g>
          ))}
        </g>
      ) : (
        // Solar array
        <g>
          {[165,185,205,225].map((x,i) => (
            <rect key={i} x={x-8} y="108" width="16" height="24" rx="1"
              fill={c.primary} opacity=".7" stroke={c.accent} strokeWidth=".5"
              transform={`rotate(-15 ${x} 120)`} />
          ))}
        </g>
      )}

      {/* Conveyor belt */}
      <rect x="30" y="133" width="120" height="4" rx="2" fill={c.primary} opacity=".3" />
      {[35,50,65,80,95,110,125,140].map((x,i) => (
        <rect key={i} x={x} y="131" width="6" height="6" rx="1" fill={c.primary} opacity=".5" />
      ))}

      <text x="120" y="152" textAnchor="middle" fill={c.accent} fontSize="8" fontFamily="Inter,sans-serif" fontWeight="600" letterSpacing="1">
        LOCAL PRODUCTION
      </text>
    </svg>
  )
}

// ── Scene: Train Locals (🤝) ──────────────────────────────────────────────────

function TrainingScene({ category }: { category: Category }) {
  const c = COLORS.training
  return (
    <svg viewBox="0 0 240 160" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <defs>
        <style>{`
          @keyframes write { 0%,100%{transform:translateX(0)} 50%{transform:translateX(4px)} }
          @keyframes nod   { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(5deg)} }
          @keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:1} }
          @keyframes think { 0%{r:3;opacity:1} 100%{r:7;opacity:0} }
          @keyframes hand  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        `}</style>
        <linearGradient id="sky-tr" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#07090F" />
          <stop offset="100%" stopColor={c.secondary} />
        </linearGradient>
        <linearGradient id="board" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1A1000" />
          <stop offset="100%" stopColor="#0D0800" />
        </linearGradient>
      </defs>

      <rect width="240" height="160" fill="url(#sky-tr)" />
      <rect x="0" y="130" width="240" height="30" fill="#1A1000" />

      {/* Classroom — walls */}
      <rect x="15" y="40" width="210" height="92" rx="2" fill="#0D0800" stroke={c.primary} strokeWidth="1.5" opacity=".8" />

      {/* Whiteboard */}
      <rect x="30" y="50" width="100" height="55" rx="2" fill="url(#board)" stroke={c.primary} strokeWidth="1.5" />
      {/* Board content — chart/diagram */}
      <line x1="38" y1="95" x2="38" y2="70" stroke={c.accent} strokeWidth=".8" opacity=".5" />
      <line x1="38" y1="95" x2="118" y2="95" stroke={c.accent} strokeWidth=".8" opacity=".5" />
      <polyline points="45,90 58,80 71,85 84,72 97,65 110,60" fill="none" stroke={c.primary} strokeWidth="2"
        style={{ animation: 'write 3s ease-in-out infinite' }} />
      {[45,58,71,84,97,110].map((x,i) => (
        <circle key={i} cx={x} cy={[90,80,85,72,65,60][i]} r="2" fill={c.accent} />
      ))}
      {/* Text lines on board */}
      {[57,63,69].map((y,i) => (
        <line key={i} x1="38" y1={y} x2={60+i*8} y2={y} stroke={c.accent} strokeWidth=".8" opacity=".4" />
      ))}

      {/* Trainer */}
      <g style={{ animation: 'nod 3s ease-in-out infinite', transformOrigin: '148px 80px' }}>
        {/* Head */}
        <circle cx="148" cy="72" r="10" fill="#D4A574" />
        {/* Body */}
        <path d="M138,82 L142,115 L154,115 L158,82 Z" fill={c.primary} opacity=".8" />
        {/* Arm pointing at board */}
        <line x1="138" y1="92" x2="130" y2="78" stroke="#D4A574" strokeWidth="4" strokeLinecap="round"
          style={{ animation: 'write 3s ease-in-out infinite' }} />
      </g>

      {/* Students — row */}
      {[175, 195, 215].map((x, i) => (
        <g key={i}>
          {/* Head */}
          <circle cx={x} cy="90" r="9"
            fill={['#D4A574','#6B4226','#C68642'][i]}
            style={{ animation: `nod ${2+i*0.5}s ease-in-out infinite ${i*0.3}s`, transformOrigin: `${x}px 90px` }} />
          {/* Body */}
          <path d={`M${x-9},99 L${x-7},120 L${x+7},120 L${x+9},99 Z`}
            fill={[c.primary, c.accent, c.primary][i]} opacity=".7" />
          {/* Hand raised */}
          {i === 1 && (
            <line x1={x} y1="99" x2={x+8} y2="82" stroke="#6B4226" strokeWidth="3" strokeLinecap="round"
              style={{ animation: 'hand 2s ease-in-out infinite' }} />
          )}
          {/* Thinking bubble */}
          {i === 0 && (
            <>
              <circle cx={x+12} cy={80} r="2" fill={c.accent} opacity=".5"
                style={{ animation: 'think 2s ease-out infinite', transformOrigin: `${x+12}px 80px` }} />
              <circle cx={x+16} cy={74} r="1.5" fill={c.accent} opacity=".4" />
            </>
          )}
        </g>
      ))}

      {/* Desks */}
      {[175, 195, 215].map((x,i) => (
        <rect key={i} x={x-12} y="120" width="24" height="4" rx="1" fill="#1A1000" stroke={c.primary} strokeWidth=".5" opacity=".6" />
      ))}

      {/* Certificate / diploma floating */}
      <g style={{ animation: 'pulse 2s ease-in-out infinite', transformOrigin: '50px 128px' }}>
        <rect x="32" y="122" width="36" height="24" rx="2" fill="#1A0E00" stroke={c.primary} strokeWidth="1" />
        <text x="50" y="133" textAnchor="middle" fill={c.accent} fontSize="6" fontWeight="700">CERTIF</text>
        <line x1="38" y1="138" x2="62" y2="138" stroke={c.primary} strokeWidth=".8" opacity=".5" />
        <line x1="38" y1="142" x2="55" y2="142" stroke={c.primary} strokeWidth=".8" opacity=".5" />
      </g>

      <text x="120" y="152" textAnchor="middle" fill={c.accent} fontSize="8" fontFamily="Inter,sans-serif" fontWeight="600" letterSpacing="1">
        TRAIN &amp; TRANSFER
      </text>
    </svg>
  )
}

// ── Public component ──────────────────────────────────────────────────────────

type Props = {
  strategy: Strategy
  category?: Category
  className?: string
}

export default function StrategyIllustration({ strategy, category = 'all', className = '' }: Props) {
  return (
    <div className={className} style={{ aspectRatio: '3/2', borderRadius: 8, overflow: 'hidden' }}>
      {strategy === 'trade'      && <TradeScene      category={category} />}
      {strategy === 'production' && <ProductionScene category={category} />}
      {strategy === 'training'   && <TrainingScene   category={category} />}
    </div>
  )
}
