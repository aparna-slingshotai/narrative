import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { useControls, folder } from 'leva'

export default function PostFx() {
  const { enabled, bloomIntensity, bloomThreshold, vignetteAmount, chromaOffset } = useControls('Post FX', {
    enabled: { value: true },
    bloom: folder({
      bloomIntensity: { value: 0.4, min: 0, max: 3, step: 0.05, label: 'intensity' },
      bloomThreshold: { value: 0.95, min: 0, max: 1, step: 0.01, label: 'threshold' },
    }),
    vignetteAmount: { value: 0.3, min: 0, max: 1, step: 0.01, label: 'vignette' },
    chromaOffset: { value: 0.0008, min: 0, max: 0.005, step: 0.0001, label: 'chroma' },
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
      <ChromaticAberration offset={[chromaOffset, chromaOffset]} blendFunction={BlendFunction.NORMAL} />
      <Vignette eskil={false} offset={0.3} darkness={vignetteAmount} />
    </EffectComposer>
  )
}
