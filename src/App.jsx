import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import * as THREE from 'three'
import { Leva } from 'leva'
import ShaderLandscape from './components/ShaderLandscape'
import CameraRig from './components/CameraRig'
import PathWalker from './components/PathWalker'
import WhiteVignette from './components/WhiteVignette'
import TextOverlay from './components/TextOverlay'
import AmbientAudio from './components/AmbientAudio'
import PaperOverlay from './components/PaperOverlay'
import Birds from './components/Birds'
import Bees from './components/Bees'
import { TouchProvider } from './hooks/useTouch'

export default function App() {
  return (
    <>
      <Leva collapsed titleBar={{ title: 'Scene Controls' }} />
      <TouchProvider>
        <Canvas
          camera={{ position: [0, 3, 7], fov: 40, near: 0.1, far: 50 }}
          dpr={1}
          gl={{
            antialias: true,
            alpha: false,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          style={{ background: '#000' }}
        >
          <Suspense fallback={null}>
            <CameraRig />
            <PathWalker />
            <ShaderLandscape />
          </Suspense>
        </Canvas>
        {/* Diagnostic bisect: DOM overlays disabled to isolate "breathing".
            Re-enable one at a time once the source is found.
        <PaperOverlay />
        <WhiteVignette />
        <Birds />
        <Bees />
        */}
        <TextOverlay />
      </TouchProvider>
      <AmbientAudio />
    </>
  )
}
