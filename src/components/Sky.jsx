import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { skyVertexShader, skyFragmentShader } from '../shaders/sky'

export default function Sky() {
  const matRef = useRef()

  useFrame((_, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += delta
  })

  return (
    <mesh position={[0, 6, -15]} scale={[50, 20, 1]}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={skyVertexShader}
        fragmentShader={skyFragmentShader}
        uniforms={{ uTime: { value: 0 } }}
        side={THREE.FrontSide}
        depthWrite={false}
      />
    </mesh>
  )
}
