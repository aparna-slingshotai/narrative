import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { useControls, folder } from 'leva'
import { Painterly } from './effects/PainterlyEffect'

export default function PostFx() {
  const {
    enabled,
    bloomIntensity,
    bloomThreshold,
    watercolorEnabled,
    washStrength,
    washRadius,
    wetEdge,
    pigment,
    posterize,
    grainAmount,
  } = useControls('Post FX', {
    enabled: { value: true },
    bloom: folder({
      bloomIntensity: { value: 0.05, min: 0, max: 3, step: 0.05, label: 'intensity' },
      bloomThreshold: { value: 0.41, min: 0, max: 1, step: 0.01, label: 'threshold' },
    }),
    watercolor: folder({
      watercolorEnabled: { value: true, label: 'enabled' },
      washStrength: { value: 0.00, min: 0, max: 1, step: 0.01, label: 'wash strength' },
      washRadius:   { value: 0.5,  min: 0.5, max: 12, step: 0.1, label: 'wash radius (px)' },
      wetEdge:      { value: 0.00, min: 0, max: 6, step: 0.05, label: 'wet edge' },
      pigment:      { value: 0.00, min: 0, max: 0.5, step: 0.005, label: 'pigment variance' },
      posterize:    { value: 32,   min: 0, max: 32, step: 1, label: 'posterize levels' },
      grainAmount:  { value: 0.21, min: 0, max: 0.25, step: 0.005, label: 'shader grain' },
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
      {watercolorEnabled ? (
        <Painterly
          washStrength={washStrength}
          washRadius={washRadius}
          wetEdge={wetEdge}
          pigment={pigment}
          posterize={posterize}
          grainAmount={grainAmount}
        />
      ) : null}
    </EffectComposer>
  )
}
