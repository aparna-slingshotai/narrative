import { useControls } from 'leva'

// HTML overlay vignette that fades the screen edges to white.
// Done outside the WebGL context so we can mix in any color (the
// postprocessing Vignette effect can only darken).
export default function WhiteVignette() {
  const { enabled, intensity, falloff } = useControls('White Vignette', {
    enabled: { value: true },
    intensity: { value: 0.25, min: 0, max: 1, step: 0.01 },
    falloff: { value: 0.55, min: 0.1, max: 1, step: 0.01, label: 'inner radius' },
  })

  if (!enabled || intensity === 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, rgba(255,255,255,0) ${falloff * 100}%, rgba(255,255,255,${intensity}) 100%)`,
        zIndex: 1,
      }}
    />
  )
}
