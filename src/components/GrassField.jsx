import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { grassVertexShader, grassFragmentShader } from '../shaders/grass'
import { useTouchWorldPosition } from '../hooks/useTouch'
import { useGrassControls, useWindControls } from '../hooks/useSceneControls'

const BLADE_COUNT = 3500
const FIELD_WIDTH = 7
const FIELD_DEPTH = 8

function createBladeGeometry() {
  const geo = new THREE.BufferGeometry()
  const verts = new Float32Array([
    -0.015, 0, 0,
     0.015, 0, 0,
    -0.008, 0.15, 0,
     0.008, 0.15, 0,
     0.0, 0.3, 0,
  ])
  const indices = [0, 1, 2, 2, 1, 3, 2, 3, 4]
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  geo.setIndex(indices)
  return geo
}

export default function GrassField() {
  const meshRef = useRef()
  const { worldPos, touchRef } = useTouchWorldPosition()
  const grass = useGrassControls()
  const wind = useWindControls()

  const { geometry, uniforms } = useMemo(() => {
    const geo = createBladeGeometry()

    const offsets = new Float32Array(BLADE_COUNT * 3)
    const scales = new Float32Array(BLADE_COUNT)
    const phases = new Float32Array(BLADE_COUNT)

    for (let i = 0; i < BLADE_COUNT; i++) {
      offsets[i * 3] = (Math.random() - 0.5) * FIELD_WIDTH
      offsets[i * 3 + 1] = 0
      offsets[i * 3 + 2] = Math.random() * -FIELD_DEPTH + 3
      scales[i] = 0.4 + Math.random() * 0.5
      phases[i] = Math.random() * Math.PI * 2
    }

    geo.setAttribute('offset', new THREE.InstancedBufferAttribute(offsets, 3))
    geo.setAttribute('scale', new THREE.InstancedBufferAttribute(scales, 1))
    geo.setAttribute('phase', new THREE.InstancedBufferAttribute(phases, 1))

    const uniforms = {
      uTime: { value: 0 },
      uTouchPos: { value: new THREE.Vector3() },
      uTouchActive: { value: 0 },
      uTouchRadius: { value: 2.5 },
      uTouchStrength: { value: 1.2 },
      uWindSpeed: { value: 1.5 },
      uWindAmplitude: { value: 0.08 },
    }

    return { geometry: geo, uniforms }
  }, [])

  useFrame((_, delta) => {
    uniforms.uTime.value += delta
    uniforms.uTouchRadius.value = grass.touchRadius
    uniforms.uTouchStrength.value = grass.touchStrength
    uniforms.uWindSpeed.value = wind.speed
    uniforms.uWindAmplitude.value = wind.grassAmplitude

    const active = touchRef.current.active ? 1 : 0
    uniforms.uTouchActive.value = THREE.MathUtils.lerp(
      uniforms.uTouchActive.value,
      active,
      grass.touchLerp
    )
    if (touchRef.current.active) {
      uniforms.uTouchPos.value.lerp(worldPos.current, Math.min(grass.touchLerp * 1.5, 1))
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[geometry, null, BLADE_COUNT]} frustumCulled={false}>
      <shaderMaterial
        vertexShader={grassVertexShader}
        fragmentShader={grassFragmentShader}
        uniforms={uniforms}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  )
}
