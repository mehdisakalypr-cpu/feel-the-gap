/**
 * Globe audio — Bankai intro (dramatic) + ka-ching per sale + mute persistence.
 *
 * If /public/sounds/bankai.mp3 exists it'll be used; otherwise we synthesize
 * a dramatic whoosh+tone via WebAudio so the feature works out of the box.
 * Drop an .mp3 at public/sounds/bankai.mp3 to override.
 */

const MUTE_KEY = 'cc_globe_mute'

export function isMuted(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(MUTE_KEY) === '1'
}

export function setMuted(m: boolean) {
  if (typeof window === 'undefined') return
  localStorage.setItem(MUTE_KEY, m ? '1' : '0')
  window.dispatchEvent(new CustomEvent('cc:mute-changed', { detail: m }))
}

let audioCtx: AudioContext | null = null
function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!C) return null
    audioCtx = new C()
  }
  return audioCtx
}

/** Bankai-style dramatic intro: descending whoosh + reverb tone (~1.2s). */
export function playBankai() {
  if (isMuted()) return
  const a = ctx()
  if (!a) return

  // Try the uploaded file first (if user dropped it in public/sounds/bankai.mp3)
  try {
    const audio = new Audio('/sounds/bankai.mp3')
    audio.volume = 0.85
    audio.play().then(() => {/* used file */}).catch(() => synthBankai(a))
  } catch {
    synthBankai(a)
  }
}

function synthBankai(a: AudioContext) {
  const now = a.currentTime
  const master = a.createGain()
  master.gain.value = 0.35
  master.connect(a.destination)

  // Layer 1 — descending whoosh (sawtooth 600Hz → 60Hz over 1.0s)
  const osc1 = a.createOscillator()
  osc1.type = 'sawtooth'
  osc1.frequency.setValueAtTime(600, now)
  osc1.frequency.exponentialRampToValueAtTime(60, now + 1.0)
  const g1 = a.createGain()
  g1.gain.setValueAtTime(0.0001, now)
  g1.gain.exponentialRampToValueAtTime(0.8, now + 0.12)
  g1.gain.exponentialRampToValueAtTime(0.0001, now + 1.2)
  osc1.connect(g1).connect(master)
  osc1.start(now); osc1.stop(now + 1.3)

  // Layer 2 — deep boom (sine 80Hz fade)
  const osc2 = a.createOscillator()
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(80, now + 0.6)
  osc2.frequency.exponentialRampToValueAtTime(40, now + 1.2)
  const g2 = a.createGain()
  g2.gain.setValueAtTime(0.0001, now + 0.6)
  g2.gain.exponentialRampToValueAtTime(0.9, now + 0.75)
  g2.gain.exponentialRampToValueAtTime(0.0001, now + 1.4)
  osc2.connect(g2).connect(master)
  osc2.start(now + 0.6); osc2.stop(now + 1.5)

  // Layer 3 — dramatic bright tone on release (440+880)
  const osc3 = a.createOscillator()
  osc3.type = 'triangle'
  osc3.frequency.setValueAtTime(440, now + 1.0)
  const g3 = a.createGain()
  g3.gain.setValueAtTime(0.0001, now + 1.0)
  g3.gain.exponentialRampToValueAtTime(0.5, now + 1.05)
  g3.gain.exponentialRampToValueAtTime(0.0001, now + 1.8)
  osc3.connect(g3).connect(master)
  osc3.start(now + 1.0); osc3.stop(now + 1.9)
}

/** Cash-register ka-ching on each new payment: 2-tone bright metallic ping (~300ms). */
export function playKaChing(amountEur?: number) {
  if (isMuted()) return
  const a = ctx()
  if (!a) return
  const now = a.currentTime
  const volume = Math.min(0.5, 0.25 + (amountEur ? Math.log10(Math.max(1, amountEur)) * 0.08 : 0))

  const master = a.createGain()
  master.gain.value = volume
  master.connect(a.destination)

  // First ping — 1760Hz
  const o1 = a.createOscillator()
  o1.type = 'sine'; o1.frequency.value = 1760
  const g1 = a.createGain()
  g1.gain.setValueAtTime(0.0001, now)
  g1.gain.exponentialRampToValueAtTime(0.9, now + 0.01)
  g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)
  o1.connect(g1).connect(master)
  o1.start(now); o1.stop(now + 0.2)

  // Second ping — 2640Hz (perfect 5th)
  const o2 = a.createOscillator()
  o2.type = 'sine'; o2.frequency.value = 2640
  const g2 = a.createGain()
  g2.gain.setValueAtTime(0.0001, now + 0.07)
  g2.gain.exponentialRampToValueAtTime(0.6, now + 0.08)
  g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
  o2.connect(g2).connect(master)
  o2.start(now + 0.07); o2.stop(now + 0.35)
}
