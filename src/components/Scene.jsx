import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import GrassField from './GrassField'
import Sky from './Sky'
import WillowTree from './WillowTree'
import CameraRig from './CameraRig'

export default function Scene() {
  const { scene } = useThree()

  useEffect(() => {
    scene.fog = new THREE.FogExp2(0xc8d8e8, 0.012)
  }, [scene])

  return (
    <>
      <CameraRig />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 3]} intensity={1.2} color="#ffe8c0" />
      <hemisphereLight args={['#87ceeb', '#3a5f0b', 0.4]} />

      <Sky />
      <WillowTree />
      <GrassField />

      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#29481a" roughness={1} />
      </mesh>
    </>
  )
}
