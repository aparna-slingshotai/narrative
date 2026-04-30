import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { Leva } from 'leva'
import Scene from './components/Scene'
import { TouchProvider } from './hooks/useTouch'

export default function App() {
  return (
    <>
      <Leva collapsed titleBar={{ title: 'Scene Controls' }} />
      <TouchProvider>
        <Canvas
          camera={{ position: [0, 3, 7], fov: 40, near: 0.1, far: 50 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: false }}
          style={{ background: '#000' }}
        >
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>
      </TouchProvider>
    </>
  )
}
