import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { grassVertexShader, grassFragmentShader, TRAIL_SIZE } from '../shaders/grass'
import { useTouchTrail, TRAIL_LENGTH } from '../hooks/useTouch'
import { useGrassControls, useWindControls, useFogControls } from '../hooks/useSceneControls'

const BLADE_COUNT = 14000
const FIELD_WIDTH = 9
const FIELD_DEPTH = 11
const BLADE_SEGMENTS = 6

// Tall thin paint-stroke blade — narrow base, sharp tapered tip,
// gentle baked S-curve.
function createBladeGeometry() {
  const geo = new THREE.BufferGeometry()

  const verts = []
  const uvs = []
  const indices = []

  const baseWidth = 0.012   // thinner base
  const tipWidth = 0.0
  const height = 0.55       // taller blade

  for (let i = 0; i <= BLADE_SEGMENTS; i++) {
    const t = i / BLADE_SEGMENTS
    // sharper taper toward tip
    const w = THREE.MathUtils.lerp(baseWidth, tipWidth, Math.pow(t, 1.4))
    const y = t * height
    const z = Math.sin(t * Math.PI * 0.5) * 0.05
    verts.push(-w, y, z)
    verts.push(w, y, z)
    uvs.push(0, t, 1, t)
  }

  for (let i = 0; i < BLADE_SEGMENTS; i++) {
    const a = i * 2
    indices.push(a, a + 1, a + 2)
    indices.push(a + 2, a + 1, a + 3)
  }

  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

export default function GrassField() {
  const meshRef = useRef()
  const touchRef = useTouchTrail({ sampleInterval: 0.04, minDistance: 0.08 })
  const grass = useGrassControls()
  const wind = useWindControls()
  const fog = useFogControls()

  const { geometry, uniforms } = useMemo(() => {
    const geo = createBladeGeometry()

    const offsets = new Float32Array(BLADE_COUNT * 3)
    const scales = new Float32Array(BLADE_COUNT)
    const phases = new Float32Array(BLADE_COUNT)
    const rotations = new Float32Array(BLADE_COUNT)
    const tints = new Float32Array(BLADE_COUNT)

    for (let i = 0; i < BLADE_COUNT; i++) {
      const r = Math.random()
      offsets[i * 3] = (Math.random() - 0.5) * FIELD_WIDTH
      offsets[i * 3 + 1] = 0
      offsets[i * 3 + 2] = (1 - r * r) * -FIELD_DEPTH + 2.5
      // wider scale variety: lots of mid-height + occasional tall stalks
      const tall = Math.random() < 0.08 ? 1.6 : 1.0
      scales[i] = (0.45 + Math.random() * 0.7) * tall
      phases[i] = Math.random() * Math.PI * 2
      rotations[i] = Math.random() * Math.PI * 2
      tints[i] = (Math.random() - 0.5) * 2
    }

    geo.setAttribute('offset', new THREE.InstancedBufferAttribute(offsets, 3))
    geo.setAttribute('scale', new THREE.InstancedBufferAttribute(scales, 1))
    geo.setAttribute('phase', new THREE.InstancedBufferAttribute(phases, 1))
    geo.setAttribute('rotation', new THREE.InstancedBufferAttribute(rotations, 1))
    geo.setAttribute('tint', new THREE.InstancedBufferAttribute(tints, 1))

    const trail = []
    for (let i = 0; i < TRAIL_SIZE; i++) trail.push(new THREE.Vector4(0, 0, 0, 999))

    const uniforms = {
      uTime: { value: 0 },
      uTrail: { value: trail },
      uTouchRadius: { value: 1.5 },
      uTouchStrength: { value: 0.3 },
      uTouchHighlight: { value: 0.35 },
      uWindSpeed: { value: 1.5 },
      uWindAmplitude: { value: 0.05 },
      uFogColor: { value: new THREE.Color('#bfd8e8') },
      uFogNear: { value: 8 },
      uFogFar: { value: 20 },
    }

    return { geometry: geo, uniforms }
  }, [])

  useFrame((_, delta) => {
    uniforms.uTime.value += delta
    uniforms.uTouchRadius.value = grass.touchRadius
    uniforms.uTouchStrength.value = grass.touchStrength
    uniforms.uTouchHighlight.value = grass.touchHighlight ?? 0.35
    uniforms.uWindSpeed.value = wind.speed
    uniforms.uWindAmplitude.value = wind.grassAmplitude
    uniforms.uFogColor.value.set(fog.fogColor)
    uniforms.uFogNear.value = fog.fogNear
    uniforms.uFogFar.value = fog.fogFar

    const data = touchRef.current
    const trailUniform = uniforms.uTrail.value
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const slot = data.trail[i]
      trailUniform[i].set(slot.pos.x, slot.pos.y, slot.pos.z, slot.age)
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
