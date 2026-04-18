import { Composition } from 'remotion'
import { MapLightsUp, MAP_LIGHTS_UP_DURATION_FRAMES } from './compositions/MapLightsUp'
import { FarmingHero, FARMING_HERO_DURATION } from './compositions/FarmingHero'
import { FarmingLoadingScan, FARMING_LOADING_DURATION } from './compositions/FarmingLoadingScan'
import { MarketplaceMatchReveal, MARKETPLACE_MATCH_REVEAL_DURATION } from './compositions/MarketplaceMatchReveal'
import { Parcours7Steps, PARCOURS_7_STEPS_DURATION } from './compositions/Parcours7Steps'

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
      <Composition
        id="MarketplaceMatchReveal"
        component={MarketplaceMatchReveal}
        durationInFrames={MARKETPLACE_MATCH_REVEAL_DURATION}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          totalMatches: 24,
          totalGmvEur: 195005,
          totalCommissionEur: 4875,
        }}
      />
      <Composition
        id="Parcours7Steps"
        component={Parcours7Steps}
        durationInFrames={PARCOURS_7_STEPS_DURATION}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  )
}
