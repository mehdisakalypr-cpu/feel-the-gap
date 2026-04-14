import { Composition } from 'remotion'
import { MapLightsUp, MAP_LIGHTS_UP_DURATION_FRAMES } from './compositions/MapLightsUp'

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
    </>
  )
}
