import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { useControls, folder } from 'leva'

export default function PostFx() {
  const { enabled, bloomIntensity, bloomThreshold } = useControls('Post FX', {
    enabled: { value: true },
    bloom: folder({
      bloomIntensity: { value: 0.35, min: 0, max: 3, step: 0.05, label: 'intensity' },
      bloomThreshold: { value: 0.95, min: 0, max: 1, step: 0.01, label: 'threshold' },
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
    </EffectComposer>
  )
}
