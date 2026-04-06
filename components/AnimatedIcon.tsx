'use client'

import type { TradeCategory } from '@/types/database'

// Animated SVG icons by category/subcategory
// Used as Leaflet divIcon HTML content

export function getAnimatedIconHTML(
  category: TradeCategory | 'all',
  subcategory?: string,
  size = 36,
  score?: number | null,
): string {
  const s = size
  const half = s / 2
  const color = CATEGORY_COLORS[category] ?? '#C9A84C'
  const glow = score && score >= 85 ? `filter:drop-shadow(0 0 6px ${color})` : ''

  const svg = buildIconSVG(category, subcategory ?? '', s, color)

  return `<div style="width:${s}px;height:${s}px;${glow};cursor:pointer" class="ftg-marker-wrap">${svg}</div>`
}

function buildIconSVG(category: TradeCategory | 'all', sub: string, s: number, color: string): string {
  // Energy — oil pump or wind turbine
  if (category === 'energy') {
    if (sub === 'crude_oil' || sub === 'natural_gas') return oilPumpSVG(s, color)
    if (sub === 'renewables') return windTurbineSVG(s, color)
    return energyBoltSVG(s, color)
  }
  if (category === 'agriculture') {
    if (sub === 'cereals' || sub === 'oilseeds') return wheatSVG(s, color)
    if (sub === 'vegetables' || sub === 'fruits') return leafSVG(s, color)
    return tractorSVG(s, color)
  }
  if (category === 'materials') return gearSVG(s, color)
  if (category === 'manufactured') return factorySVG(s, color)
  if (category === 'resources') return waterDropSVG(s, color)
  return defaultPinSVG(s, color)
}

// ── SVG builders ─────────────────────────────────────────────────────────────

function oilPumpSVG(s: number, c: string): string {
  return `<svg width="${s}" height="${s}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    .pump-arm { transform-origin: 18px 14px; animation: pump 1.8s ease-in-out infinite; }
    @keyframes pump { 0%,100% { transform: rotate(-12deg); } 50% { transform: rotate(12deg); } }
  </style>
  <rect x="14" y="26" width="8" height="8" rx="1" fill="${c}" opacity=".8"/>
  <line x1="18" y1="26" x2="18" y2="20" stroke="${c}" stroke-width="2"/>
  <g class="pump-arm">
    <line x1="6" y1="14" x2="30" y2="14" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="6" cy="14" r="2.5" fill="${c}"/>
    <line x1="30" y1="14" x2="30" y2="8" stroke="${c}" stroke-width="2"/>
  </g>
  <line x1="6" y1="14" x2="6" y2="34" stroke="${c}" stroke-width="2" opacity=".5"/>
  <circle cx="18" cy="18" r="16" stroke="${c}" stroke-width="1.5" fill="${c}" fill-opacity=".08"/>
</svg>`
}

function windTurbineSVG(s: number, c: string): string {
  return `<svg width="${s}" height="${s}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    .blades { transform-origin: 18px 16px; animation: spin 3s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  </style>
  <line x1="18" y1="16" x2="18" y2="34" stroke="${c}" stroke-width="2.5"/>
  <g class="blades">
    <ellipse cx="18" cy="8" rx="2.5" ry="7" fill="${c}" transform="rotate(0 18 16)"/>
    <ellipse cx="18" cy="8" rx="2.5" ry="7" fill="${c}" transform="rotate(120 18 16)"/>
    <ellipse cx="18" cy="8" rx="2.5" ry="7" fill="${c}" transform="rotate(240 18 16)"/>
    <circle cx="18" cy="16" r="3" fill="${c}"/>
  </g>
  <circle cx="18" cy="18" r="16" stroke="${c}" stroke-width="1.5" fill="${c}" fill-opacity=".08"/>
</svg>`
}

function energyBoltSVG(s: number, c: string): string {
  return `<svg width="${s}" height="${s}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    .bolt { animation: flash 2s ease-in-out infinite; }
    @keyframes flash { 0%,100%{opacity:1} 50%{opacity:.4} }
  </style>
  <circle cx="18" cy="18" r="16" stroke="${c}" stroke-width="1.5" fill="${c}" fill-opacity=".08"/>
  <path class="bolt" d="M20 6L10 20h8l-2 10 12-16h-8z" fill="${c}"/>
</svg>`
}

function wheatSVG(s: number, c: string): string {
  return `<svg width="${s}" height="${s}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    .stalk { transform-origin: 18px 30px; animation: sway 2.5s ease-in-out infinite; }
    @keyframes sway { 0%,100%{transform:rotate(-5deg)} 50%{transform:rotate(5deg)} }
  </style>
  <circle cx="18" cy="18" r="16" stroke="${c}" stroke-width="1.5" fill="${c}" fill-opacity=".08"/>
  <g class="stalk">
    <line x1="18" y1="8" x2="18" y2="30" stroke="${c}" stroke-width="2"/>
    <ellipse cx="18" cy="10" rx="4" ry="6" fill="${c}" opacity=".9"/>
    <ellipse cx="14" cy="14" rx="3" ry="5" fill="${c}" opacity=".7" transform="rotate(-30 14 14)"/>
    <ellipse cx="22" cy="14" rx="3" ry="5" fill="${c}" opacity=".7" transform="rotate(30 22 14)"/>
    <ellipse cx="14" cy="20" rx="3" ry="5" fill="${c}" opacity=".6" transform="rotate(-30 14 20)"/>
    <ellipse cx="22" cy="20" rx="3" ry="5" fill="${c}" opacity=".6" transform="rotate(30 22 20)"/>
  </g>
</svg>`
}

function leafSVG(s: number, c: string): string {
  return `<svg width="${s}" height="${s}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    .leaf { transform-origin: 18px 24px; animation: grow 3s ease-in-out infinite; }
    @keyframes grow { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
  </style>
  <circle cx="18" cy="18" r="16" stroke="${c}" stroke-width="1.5" fill="${c}" fill-opacity=".08"/>
  <g class="leaf">
    <path d="M18 26 C10 20, 6 10, 18 6 C30 10, 26 20, 18 26Z" fill="${c}" opacity=".85"/>
    <line x1="18" y1="26" x2="18" y2="8" stroke="${c}" stroke-width="1" opacity=".5"/>
  </g>
</svg>`
}

function tractorSVG(s: number, c: string): string {
  return `<svg width="${s}" height="${s}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    .wheel { animation: roll 1.5s linear infinite; transform-origin: center; }
    .whl1 { transform-origin: 12px 24px; }
    .whl2 { transform-origin: 26px 24px; }
    @keyframes roll { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  </style>
  <circle cx="18" cy="18" r="16" stroke="${c}" stroke-width="1.5" fill="${c}" fill-opacity=".08"/>
  <rect x="10" y="14" width="16" height="8" rx="2" fill="${c}" opacity=".8"/>
  <rect x="22" y="10" width="6" height="6" rx="1" fill="${c}" opacity=".6"/>
  <circle class="wheel whl1" cx="12" cy="24" r="4" stroke="${c}" stroke-width="2" fill="none"/>
  <circle class="wheel whl2" cx="26" cy="24" r="3" stroke="${c}" stroke-width="2" fill="none"/>
</svg>`
}

function gearSVG(s: number, c: string): string {
  return `<svg width="${s}" height="${s}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    .gear { transform-origin: 18px 18px; animation: spin 4s linear infinite; }
    @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  </style>
  <circle cx="18" cy="18" r="16" stroke="${c}" stroke-width="1.5" fill="${c}" fill-opacity=".08"/>
  <g class="gear">
    <circle cx="18" cy="18" r="5" stroke="${c}" stroke-width="2" fill="none"/>
    ${[0,45,90,135,180,225,270,315].map(a=>`<rect x="17" y="8" width="2" height="4" rx="1" fill="${c}" transform="rotate(${a} 18 18)"/>`).join('')}
  </g>
</svg>`
}

function factorySVG(s: number, c: string): string {
  return `<svg width="${s}" height="${s}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    .smoke1 { animation: rise 2s ease-in-out infinite; transform-origin: 14px 12px; }
    .smoke2 { animation: rise 2s ease-in-out infinite .6s; transform-origin: 22px 10px; }
    @keyframes rise { 0%{opacity:0;transform:translateY(0) scale(.8)} 50%{opacity:.7} 100%{opacity:0;transform:translateY(-8px) scale(1.4)} }
  </style>
  <circle cx="18" cy="18" r="16" stroke="${c}" stroke-width="1.5" fill="${c}" fill-opacity=".08"/>
  <rect x="8" y="18" width="20" height="12" rx="1" fill="${c}" opacity=".8"/>
  <rect x="10" y="14" width="4" height="6" fill="${c}" opacity=".6"/>
  <rect x="17" y="12" width="4" height="8" fill="${c}" opacity=".6"/>
  <circle class="smoke1" cx="12" cy="12" r="2" fill="${c}" opacity=".5"/>
  <circle class="smoke2" cx="19" cy="10" r="2" fill="${c}" opacity=".5"/>
</svg>`
}

function waterDropSVG(s: number, c: string): string {
  return `<svg width="${s}" height="${s}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    .drop { animation: drip 1.8s ease-in-out infinite; transform-origin: 18px 8px; }
    @keyframes drip { 0%{transform:translateY(0);opacity:0} 30%{opacity:1} 100%{transform:translateY(16px);opacity:0} }
  </style>
  <circle cx="18" cy="18" r="16" stroke="${c}" stroke-width="1.5" fill="${c}" fill-opacity=".08"/>
  <path d="M18 26 C12 20, 10 14, 18 8 C26 14, 24 20, 18 26Z" fill="${c}" opacity=".85"/>
  <circle class="drop" cx="18" cy="8" r="1.5" fill="${c}"/>
</svg>`
}

function defaultPinSVG(s: number, c: string): string {
  return `<svg width="${s}" height="${s}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="18" cy="18" r="16" stroke="${c}" stroke-width="1.5" fill="${c}" fill-opacity=".12"/>
  <circle cx="18" cy="18" r="5" fill="${c}"/>
</svg>`
}

export const CATEGORY_COLORS: Record<string, string> = {
  agriculture:  '#22C55E',
  energy:       '#F59E0B',
  materials:    '#94A3B8',
  manufactured: '#60A5FA',
  resources:    '#38BDF8',
  all:          '#C9A84C',
}
