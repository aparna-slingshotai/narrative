import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { useControls, folder } from 'leva'
import { Watercolor } from './effects/WatercolorEffect'
import { Outline } from './effects/OutlineEffect'

export default function PostFx() {
  const ctrl = useControls('Post FX', {
    enabled: { value: true },
    bloom: folder({
      bloomIntensity: { value: 0.05, min: 0, max: 3, step: 0.05, label: 'intensity' },
      bloomThreshold: { value: 0.41, min: 0, max: 1, step: 0.01, label: 'threshold' },
    }),
    watercolor: folder({
      watercolorEnabled: { value: false, label: 'enabled' },
      blurRadius: { value: 1.6, min: 0, max: 6, step: 0.1, label: 'blur radius' },
      paperGrain: { value: 0.45, min: 0, max: 1, step: 0.01, label: 'paper grain' },
      edgeIntensity: { value: 0.8, min: 0, max: 2, step: 0.05, label: 'wet edge' },
      shadowStrength: { value: 0.25, min: 0, max: 1, step: 0.01, label: 'shadow' },
      shapeThreshold: { value: 0.05, min: 0, max: 0.5, step: 0.01, label: 'shape threshold' },
    }),
    outlines: folder({
      outlineEnabled: { value: false, label: 'enabled' },
      thickness: { value: 1.2, min: 0.4, max: 4, step: 0.1, label: 'thickness' },
      depthThreshold: { value: 0.04, min: 0, max: 0.5, step: 0.005, label: 'depth threshold' },
      outlineColor: { value: '#3a2818', label: 'color' },
      outlineIntensity: { value: 0.9, min: 0, max: 1, step: 0.01, label: 'intensity' },
    }),
  })

  if (!ctrl.enabled) return null

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={ctrl.bloomIntensity}
        luminanceThreshold={ctrl.bloomThreshold}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      {ctrl.watercolorEnabled ? (
        <Watercolor
          blurRadius={ctrl.blurRadius}
          paperGrain={ctrl.paperGrain}
          edgeIntensity={ctrl.edgeIntensity}
          shadowStrength={ctrl.shadowStrength}
          shapeThreshold={ctrl.shapeThreshold}
        />
      ) : null}
      {ctrl.outlineEnabled ? (
        <Outline
          thickness={ctrl.thickness}
          depthThreshold={ctrl.depthThreshold}
          color={ctrl.outlineColor}
          intensity={ctrl.outlineIntensity}
        />
      ) : null}
    </EffectComposer>
  )
}
