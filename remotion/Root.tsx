import { Composition } from 'remotion'
import { MapLightsUp, MAP_LIGHTS_UP_DURATION_FRAMES } from './compositions/MapLightsUp'
import { FarmingHero, FARMING_HERO_DURATION } from './compositions/FarmingHero'
import { FarmingLoadingScan, FARMING_LOADING_DURATION } from './compositions/FarmingLoadingScan'
import { MarketplaceMatchReveal, MARKETPLACE_MATCH_REVEAL_DURATION } from './compositions/MarketplaceMatchReveal'
import { Parcours7Steps, PARCOURS_7_STEPS_DURATION } from './compositions/Parcours7Steps'
import { OpportunitySpotlight, OPPORTUNITY_SPOTLIGHT_DURATION } from './compositions/OpportunitySpotlight'
import { PlansReveal, PLANS_REVEAL_DURATION } from './compositions/PlansReveal'
import { SovereignPitch, SOVEREIGN_PITCH_DURATION } from './compositions/SovereignPitch'

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
      <Composition
        id="OpportunitySpotlight"
        component={OpportunitySpotlight}
        durationInFrames={OPPORTUNITY_SPOTLIGHT_DURATION}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          flag: '🇲🇦',
          country: 'Maroc',
          product: "Huile d'olive bio",
          gapValueEur: 12_800_000,
          score: 87,
          tagline: 'Importez ce que le pays ne produit plus.',
        }}
      />
      <Composition
        id="PlansReveal"
        component={PlansReveal}
        durationInFrames={PLANS_REVEAL_DURATION}
        fps={30}
        width={1080}
        height={1080}
      />
      <Composition
        id="SovereignPitch"
        component={SovereignPitch}
        durationInFrames={SOVEREIGN_PITCH_DURATION}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          countryIso: 'SEN',
          countryNameFr: 'Sénégal',
          flag: '🇸🇳',
          gapImportEur: 2_400_000_000,
          jobsLostAnnual: 85_000,
          fxOutflowPctGdp: 7.2,
          projectedJobs36m: 12_500,
          projectedFxSavingsEur: 180_000_000,
          partnerHints: ['Ministère du Commerce', 'ADEPME', 'Chambre de Commerce de Dakar'],
          ctaUrl: 'feelthegap.world/gov/SEN',
        }}
      />
    </>
  )
}
