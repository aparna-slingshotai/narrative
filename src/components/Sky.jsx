import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useControls, folder } from 'leva'
import { skyVertexShader, skyFragmentShader } from '../shaders/sky'

export default function Sky() {
  const matRef = useRef()

  const { horizonColor, midColor, zenithColor, sunDirX, sunDirY, sunDirZ, sunColor, cloudDensity, cloudSpeed } = useControls('Sky', {
    gradient: folder({
      horizonColor: { value: '#fbe5c4', label: 'horizon' },
      midColor: { value: '#a8c8e8', label: 'mid' },
      zenithColor: { value: '#5b89c8', label: 'zenith' },
    }),
    sun: folder({
      sunDirX: { value: 0.3, min: -1, max: 1, step: 0.01, label: 'x' },
      sunDirY: { value: 0.4, min: 0, max: 1, step: 0.01, label: 'y' },
      sunDirZ: { value: -0.4, min: -1, max: 1, step: 0.01, label: 'z' },
      sunColor: { value: '#fff0d0', label: 'color' },
    }),
    clouds: folder({
      cloudDensity: { value: 0.5, min: 0, max: 1, step: 0.01, label: 'density' },
      cloudSpeed: { value: 1.0, min: 0, max: 5, step: 0.1, label: 'speed' },
    }),
  })

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uHorizon: { value: new THREE.Color() },
    uMid: { value: new THREE.Color() },
    uZenith: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3() },
    uSunColor: { value: new THREE.Color() },
    uCloudDensity: { value: 0.5 },
    uCloudSpeed: { value: 1 },
  }), [])

  useFrame((_, delta) => {
    if (!matRef.current) return
    const u = matRef.current.uniforms
    u.uTime.value += delta
    u.uHorizon.value.set(horizonColor)
    u.uMid.value.set(midColor)
    u.uZenith.value.set(zenithColor)
    u.uSunDir.value.set(sunDirX, sunDirY, sunDirZ).normalize()
    u.uSunColor.value.set(sunColor)
    u.uCloudDensity.value = cloudDensity
    u.uCloudSpeed.value = cloudSpeed
  })

  return (
    <mesh scale={20} renderOrder={-1}>
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
