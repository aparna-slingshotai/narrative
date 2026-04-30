import { useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useWindControls, useTreeControls } from '../hooks/useSceneControls'

export default function WillowTree() {
  const groupRef = useRef()
  const { scene } = useGLTF('/willow.glb')
  const wind = useWindControls()
  const tree = useTreeControls()

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime * wind.speed * 0.5
    groupRef.current.rotation.z = Math.sin(t) * wind.treeAmplitude
    groupRef.current.rotation.x = Math.cos(t * 0.7) * wind.treeAmplitude * 0.5
    groupRef.current.rotation.y = Math.sin(t * 0.3) * wind.treeAmplitude * 0.3
  })

  return (
    <group
      ref={groupRef}
      position={[tree.posX, tree.posY, tree.posZ]}
      scale={tree.scale}
    >
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload('/willow.glb')
