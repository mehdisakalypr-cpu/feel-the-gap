/**
 * FarmingRemotionHero — wrapper client-only autour de @remotion/player pour
 * embarquer FarmingHero en autoPlay+loop sans spoil la bundle server-side.
 */
'use client'

import { Player } from '@remotion/player'
import { FarmingHero, FARMING_HERO_DURATION } from '@/remotion/compositions/FarmingHero'

export default function FarmingRemotionHero() {
  return (
    <div className="rounded-2xl overflow-hidden border border-[rgba(201,168,76,.15)] bg-black mb-6">
      <Player
        component={FarmingHero}
        durationInFrames={FARMING_HERO_DURATION}
        fps={30}
        compositionWidth={1600}
        compositionHeight={600}
        style={{ width: '100%', aspectRatio: '1600/600' }}
        autoPlay
        loop
        controls={false}
      />
    </div>
  )
}
