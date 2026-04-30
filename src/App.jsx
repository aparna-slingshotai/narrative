import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import * as THREE from 'three'
import { Leva } from 'leva'
import Scene from './components/Scene'
import PostFx from './components/PostFx'
import WhiteVignette from './components/WhiteVignette'
import TextOverlay from './components/TextOverlay'
import AmbientAudio from './components/AmbientAudio'
import PaperOverlay from './components/PaperOverlay'
import { TouchProvider } from './hooks/useTouch'

export default function App() {
  return (
    <>
      <Leva collapsed titleBar={{ title: 'Scene Controls' }} />
      <TouchProvider>
        <Canvas
          camera={{ position: [0, 3, 7], fov: 40, near: 0.1, far: 50 }}
          dpr={[1, 1.5]}
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
            <Scene />
            <PostFx />
          </Suspense>
        </Canvas>
        <PaperOverlay />
        <WhiteVignette />
        <TextOverlay />
      </TouchProvider>
      <AmbientAudio />
    </>
  )
}
