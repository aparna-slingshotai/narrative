import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { useControls, folder } from 'leva'
import { Painterly } from './effects/PainterlyEffect'

export default function PostFx() {
  const {
    enabled,
    bloomIntensity,
    bloomThreshold,
    painterlyEnabled,
    strokeStrength,
    strokeScale,
    posterize,
    grainAmount,
    edgeBleed,
  } = useControls('Post FX', {
    enabled: { value: true },
    bloom: folder({
      bloomIntensity: { value: 0.35, min: 0, max: 3, step: 0.05, label: 'intensity' },
      bloomThreshold: { value: 0.95, min: 0, max: 1, step: 0.01, label: 'threshold' },
    }),
    painterly: folder({
      painterlyEnabled: { value: true, label: 'enabled' },
      strokeStrength: { value: 0.55, min: 0, max: 1, step: 0.01, label: 'stroke strength' },
      strokeScale:    { value: 220,  min: 40, max: 600, step: 10, label: 'stroke scale' },
      posterize:      { value: 14,   min: 0, max: 32, step: 1, label: 'posterize levels' },
      grainAmount:    { value: 0.06, min: 0, max: 0.25, step: 0.005, label: 'shader grain' },
      edgeBleed:      { value: 0.6,  min: 0, max: 2, step: 0.05, label: 'edge bleed' },
    }),
  })

  if (!enabled) return null

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      {painterlyEnabled ? (
        <Painterly
          strokeStrength={strokeStrength}
          strokeScale={strokeScale}
          posterize={posterize}
          grainAmount={grainAmount}
          edgeBleed={edgeBleed}
        />
      ) : null}
    </EffectComposer>
  )
}
