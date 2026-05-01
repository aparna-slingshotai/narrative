import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useControls, folder } from 'leva'
import { skyVertexShader, skyFragmentShader } from '../shaders/sky'

export default function Sky() {
  const matRef = useRef()

  const { paperColor, scribbleColor, cloudDensity, cloudSpeed } = useControls('Sky', {
    paperColor:    { value: '#f4ebd9', label: 'paper' },
    scribbleColor: { value: '#9bb8d4', label: 'scribbles' },
    clouds: folder({
      cloudDensity: { value: 0.65, min: 0, max: 1, step: 0.01, label: 'density' },
      cloudSpeed:   { value: 0.6,  min: 0, max: 5, step: 0.1, label: 'speed' },
    }),
  })

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPaperColor: { value: new THREE.Color() },
    uScribbleColor: { value: new THREE.Color() },
    uCloudDensity: { value: 0.65 },
    uCloudSpeed: { value: 0.6 },
  }), [])

  useFrame((_, delta) => {
    if (!matRef.current) return
    const u = matRef.current.uniforms
    u.uTime.value += delta
    u.uPaperColor.value.set(paperColor)
    u.uScribbleColor.value.set(scribbleColor)
    u.uCloudDensity.value = cloudDensity
    u.uCloudSpeed.value = cloudSpeed
  })

  return (
    <mesh scale={20} renderOrder={-1} userData-materialId={6}>
      <sphereGeometry args={[1, 48, 24]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={skyVertexShader}
        fragmentShader={skyFragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  )
}
