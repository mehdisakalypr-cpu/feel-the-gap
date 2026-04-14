'use client'

import { Player } from '@remotion/player'
import { MapLightsUp, MAP_LIGHTS_UP_DURATION_FRAMES } from '@/remotion/compositions/MapLightsUp'

export default function VideoPlayer() {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-black">
      <Player
        component={MapLightsUp}
        durationInFrames={MAP_LIGHTS_UP_DURATION_FRAMES}
        fps={30}
        compositionWidth={1920}
        compositionHeight={1080}
        style={{ width: '100%', aspectRatio: '16/9' }}
        controls
        loop
        inputProps={{
          countriesCount: 198,
          opportunitiesCount: 19800,
          tagline: 'Chaque pays cache des gisements invisibles. On les révèle.',
        }}
      />
      <div className="px-4 py-3 border-t border-white/10 text-[11px] text-gray-400 flex gap-4">
        <span><b className="text-white">MapLightsUp</b> · 30s · 1920×1080 · 30fps</span>
        <span className="ml-auto text-gray-600">npm run video:render → out/map-lights-up.mp4</span>
      </div>
    </div>
  )
}
