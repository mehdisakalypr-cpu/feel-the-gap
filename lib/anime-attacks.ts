/**
 * Multi-anime attack triggers per CA threshold.
 * Mix Saint Seiya · Naruto · DBZ · Jujutsu Kaisen · Bleach — progression ascendante.
 * Chaque franchissement de seuil → overlay banner + synth audio + pulse globe.
 */

export type AnimeAttack = {
  threshold: number
  name: string
  character: string
  anime: string
  color: string
  emoji: string
  tagline: string
}

export const ANIME_ATTACKS: AnimeAttack[] = [
  {
    threshold: 50,
    name: 'Pegasus Ryūseiken',
    character: 'Seiya — Chevalier de Pégase',
    anime: 'Saint Seiya',
    color: '#FACC15',
    emoji: '⭐',
    tagline: 'Météores de Pégase — à la vitesse de la lumière',
  },
  {
    threshold: 100,
    name: 'Rasengan',
    character: 'Naruto Uzumaki',
    anime: 'Naruto',
    color: '#60A5FA',
    emoji: '🌀',
    tagline: 'Spiraling Sphere',
  },
  {
    threshold: 500,
    name: 'Rōzan Shōryūha',
    character: 'Shiryū — Chevalier du Dragon',
    anime: 'Saint Seiya',
    color: '#10B981',
    emoji: '🐉',
    tagline: 'Colère du Dragon — des cascades de Rozan',
  },
  {
    threshold: 1_000,
    name: 'Makankōsappō',
    character: 'Piccolo',
    anime: 'Dragon Ball Z',
    color: '#A3E635',
    emoji: '☄️',
    tagline: 'Special Beam Cannon',
  },
  {
    threshold: 10_000,
    name: 'Kamehameha',
    character: 'Son Goku',
    anime: 'Dragon Ball Z',
    color: '#22D3EE',
    emoji: '💥',
    tagline: 'Turtle Destruction Wave',
  },
  {
    threshold: 100_000,
    name: 'Hollow Purple',
    character: 'Satoru Gojo',
    anime: 'Jujutsu Kaisen',
    color: '#A855F7',
    emoji: '🟣',
    tagline: 'Imaginary + Red + Blue — Infinity unleashed',
  },
  {
    threshold: 500_000,
    name: 'Senbonzakura Kageyoshi',
    character: 'Byakuya Kuchiki — Bankai',
    anime: 'Bleach',
    color: '#F472B6',
    emoji: '🌸',
    tagline: 'Thousand Cherry Blossoms, Vibrant Display',
  },
  {
    threshold: 1_000_000,
    name: 'Getsuga Tenshō',
    character: 'Ichigo Kurosaki',
    anime: 'Bleach',
    color: '#F3F4F6',
    emoji: '🌙',
    tagline: 'Piercing Moon Fang',
  },
]

/** Return the attack whose threshold is crossed by going from oldTotal → newTotal, or null. */
export function attackForCrossing(oldTotal: number, newTotal: number): AnimeAttack | null {
  if (newTotal <= oldTotal) return null
  for (const a of ANIME_ATTACKS) {
    if (oldTotal < a.threshold && newTotal >= a.threshold) return a
  }
  return null
}

/** WebAudio synth — distinct timbre per attack. */
export function playAttack(attack: AnimeAttack, audioCtx: AudioContext) {
  if (!audioCtx) return
  const now = audioCtx.currentTime
  const master = audioCtx.createGain()
  master.gain.value = 0.45
  master.connect(audioCtx.destination)

  const tail = (delay: number, freq: number, dur: number, type: OscillatorType, peak: number, freqEnd?: number) => {
    const o = audioCtx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, now + delay)
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, now + delay + dur)
    const g = audioCtx.createGain()
    g.gain.setValueAtTime(0.0001, now + delay)
    g.gain.exponentialRampToValueAtTime(peak, now + delay + 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur)
    o.connect(g).connect(master)
    o.start(now + delay); o.stop(now + delay + dur + 0.1)
  }

  switch (attack.name) {
    case 'Pegasus Ryūseiken': // rapid staccato meteor punches
      for (let i = 0; i < 10; i++) {
        tail(i * 0.05, 1400 - i * 60, 0.08, 'square', 0.35)
      }
      tail(0.55, 880, 0.4, 'triangle', 0.5)
      break
    case 'Rōzan Shōryūha': // rising dragon roar
      tail(0, 120, 1.1, 'sawtooth', 0.8, 520)
      tail(0.15, 180, 0.9, 'square', 0.4, 720)
      tail(0.7, 1100, 0.5, 'triangle', 0.55)
      break
    case 'Rasengan': // rotating whoosh rising
      tail(0, 220, 0.9, 'sawtooth', 0.55, 660)
      tail(0.05, 440, 0.7, 'triangle', 0.35, 880)
      tail(0.2, 1320, 0.25, 'sine', 0.4)
      break
    case 'Makankōsappō': // piercing beam — long rising tone
      tail(0, 180, 1.4, 'sawtooth', 0.6, 1800)
      tail(0.3, 60, 1.0, 'square', 0.35)
      tail(1.1, 2200, 0.35, 'sine', 0.5)
      break
    case 'Kamehameha': // charge + release
      for (let i = 0; i < 8; i++) {
        tail(i * 0.08, 110 + i * 20, 0.15, 'sine', 0.25)
      }
      tail(0.7, 90, 0.6, 'sawtooth', 0.9, 40)
      tail(0.9, 440, 0.7, 'triangle', 0.6, 880)
      break
    case 'Hollow Purple': // merged polyphonic blast
      tail(0, 160, 1.0, 'sawtooth', 0.55)
      tail(0.05, 220, 1.0, 'triangle', 0.5)
      tail(0.1, 90, 1.0, 'square', 0.4)
      tail(0.7, 550, 0.5, 'sine', 0.55)
      break
    case 'Senbonzakura Kageyoshi': // high-pitched sparkles + tail
      for (let i = 0; i < 16; i++) {
        tail(i * 0.04, 1600 + Math.random() * 1400, 0.18, 'sine', 0.22)
      }
      tail(0.2, 440, 0.8, 'triangle', 0.5)
      tail(0.8, 220, 1.0, 'sine', 0.6)
      break
    case 'Getsuga Tenshō': // slashing descending boom
      tail(0, 1400, 0.4, 'sawtooth', 0.85, 200)
      tail(0.12, 800, 0.5, 'triangle', 0.55)
      tail(0.25, 100, 0.9, 'sine', 0.95)
      tail(0.9, 55, 1.4, 'sawtooth', 0.7)
      break
    default:
      tail(0, 440, 0.5, 'sine', 0.4)
  }
}
