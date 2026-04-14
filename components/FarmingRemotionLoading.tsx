/**
 * FarmingRemotionLoading — remplace le spinner standard pendant /api/opportunity-scanner.
 * Loop Remotion 6s montrant les 4 agents séquentiels SCOUT → ENRICH → SCORE → MATCH.
 */
'use client'

import { Player } from '@remotion/player'
import { FarmingLoadingScan, FARMING_LOADING_DURATION } from '@/remotion/compositions/FarmingLoadingScan'

export default function FarmingRemotionLoading() {
  return (
    <div className="rounded-2xl overflow-hidden border border-[rgba(201,168,76,.15)] bg-black">
      <Player
        component={FarmingLoadingScan}
        durationInFrames={FARMING_LOADING_DURATION}
        fps={30}
        compositionWidth={1200}
        compositionHeight={540}
        style={{ width: '100%', aspectRatio: '1200/540' }}
        autoPlay
        loop
        controls={false}
      />
    </div>
  )
}
