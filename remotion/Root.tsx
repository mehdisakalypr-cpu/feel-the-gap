import { Composition } from 'remotion'
import { MapLightsUp, MAP_LIGHTS_UP_DURATION_FRAMES } from './compositions/MapLightsUp'
import { FarmingHero, FARMING_HERO_DURATION } from './compositions/FarmingHero'
import { FarmingLoadingScan, FARMING_LOADING_DURATION } from './compositions/FarmingLoadingScan'

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MapLightsUp"
        component={MapLightsUp}
        durationInFrames={MAP_LIGHTS_UP_DURATION_FRAMES}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          countriesCount: 198,
          opportunitiesCount: 19800,
          tagline: 'Chaque pays cache des gisements invisibles. On les révèle.',
        }}
      />
      <Composition
        id="FarmingHero"
        component={FarmingHero}
        durationInFrames={FARMING_HERO_DURATION}
        fps={30}
        width={1600}
        height={600}
      />
      <Composition
        id="FarmingLoadingScan"
        component={FarmingLoadingScan}
        durationInFrames={FARMING_LOADING_DURATION}
        fps={30}
        width={1200}
        height={540}
      />
    </>
  )
}
