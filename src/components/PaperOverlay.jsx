import { useControls } from 'leva'

// SVG-based paper grain overlay. Sits above the canvas and below the
// text overlay; pointer-events disabled so touch passthrough is unaffected.
//
// Two layers blend on top of the scene:
//   1. SVG turbulence noise — tiny grain
//   2. Subtle warm tint that desaturates the scene a touch
const noiseSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <filter id="n">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>
    <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.35  0 0 0 0.7 0"/>
  </filter>
  <rect width="100%" height="100%" filter="url(#n)"/>
</svg>`

const noiseUrl = `url("data:image/svg+xml;utf8,${encodeURIComponent(noiseSvg)}")`

export default function PaperOverlay() {
  const { enabled, grain, warmth } = useControls('Paper Grain', {
    enabled: { value: true, label: 'enabled' },
    grain:   { value: 0.22, min: 0, max: 0.6, step: 0.01, label: 'grain' },
    warmth:  { value: 0.12, min: 0, max: 0.4, step: 0.01, label: 'warm tint' },
  })

  if (!enabled) return null

  return (
    <>
      {/* warm tint pass — sits below the noise */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
          background: `rgba(220, 195, 140, ${warmth})`,
          mixBlendMode: 'multiply',
        }}
      />
      {/* grain pass */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
          backgroundImage: noiseUrl,
          backgroundSize: '200px 200px',
          opacity: grain,
          mixBlendMode: 'multiply',
        }}
      />
    </>
  )
}
