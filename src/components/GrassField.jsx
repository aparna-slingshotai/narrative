import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { grassVertexShader, grassFragmentShader, TRAIL_SIZE, MAX_RIVER_POINTS } from '../shaders/grass'
import { useTouchTrail, TRAIL_LENGTH } from '../hooks/useTouch'
import { useGrassControls, useWindControls, useFogControls } from '../hooks/useSceneControls'
import { RIVER_POINTS, RIVER_WIDTH } from '../scene/river'
import { useScenePaint } from '../scene/paintAssets'

const BLADE_COUNT = 32000
// Tile size — wraps around the camera each frame so the visible area
// always has dense grass, regardless of where the camera is.
const FIELD_WIDTH = 18
const FIELD_DEPTH = 18
const BLADE_SEGMENTS = 6

function createBladeGeometry() {
  const geo = new THREE.BufferGeometry()
  const verts = []
  const uvs = []
  const indices = []

  const baseWidth = 0.012
  const tipWidth = 0.0
  const height = 1.0 // unit height — instance scale handles actual size

  for (let i = 0; i <= BLADE_SEGMENTS; i++) {
    const t = i / BLADE_SEGMENTS
    const w = THREE.MathUtils.lerp(baseWidth, tipWidth, Math.pow(t, 1.4))
    const y = t * height
    const z = Math.sin(t * Math.PI * 0.5) * 0.12
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

function sampleHeight() {
  const r = Math.random()
  if (r < 0.5) return 0.18 + Math.random() * 0.18
  if (r < 0.78) return 0.36 + Math.random() * 0.22
  if (r < 0.93) return 0.58 + Math.random() * 0.30
  return 0.88 + Math.random() * 0.55
}

// Pad RIVER_POINTS to fixed shader array size; extra slots duplicate the
// last point so any wrap-around segment is degenerate.
function buildRiverUniformArray() {
  const out = []
  const last = RIVER_POINTS[RIVER_POINTS.length - 1]
  for (let i = 0; i < MAX_RIVER_POINTS; i++) {
    out.push((RIVER_POINTS[i] || last).clone())
  }
  return out
}

export default function GrassField() {
  const meshRef = useRef()
  const touchRef = useTouchTrail({ sampleInterval: 0.04, minDistance: 0.08 })
  const grass = useGrassControls()
  const wind = useWindControls()
  const fog = useFogControls()
  const painted = useScenePaint()

  const { geometry, uniforms } = useMemo(() => {
    const geo = createBladeGeometry()

    const offsets = new Float32Array(BLADE_COUNT * 3)
    const heights = new Float32Array(BLADE_COUNT)
    const widths = new Float32Array(BLADE_COUNT)
    const phases = new Float32Array(BLADE_COUNT)
    const rotations = new Float32Array(BLADE_COUNT)
    const leans = new Float32Array(BLADE_COUNT)
    const tints = new Float32Array(BLADE_COUNT)

    // Uniform distribution within a tile centered on origin. The shader
    // wraps each blade around the camera at render time, so the tile
    // floats with the player and river exclusion happens per-frame.
    for (let i = 0; i < BLADE_COUNT; i++) {
      offsets[i * 3] = (Math.random() - 0.5) * FIELD_WIDTH
      offsets[i * 3 + 1] = 0
      offsets[i * 3 + 2] = (Math.random() - 0.5) * FIELD_DEPTH
      heights[i] = sampleHeight()
      widths[i] = 0.7 + Math.random() * 0.9
      phases[i] = Math.random() * Math.PI * 2
      rotations[i] = Math.random() * Math.PI * 2
      leans[i] = (Math.random() - 0.5) * 0.5
      tints[i] = (Math.random() - 0.5) * 2
    }

    geo.setAttribute('offset', new THREE.InstancedBufferAttribute(offsets, 3))
    geo.setAttribute('heightScale', new THREE.InstancedBufferAttribute(heights, 1))
    geo.setAttribute('widthScale', new THREE.InstancedBufferAttribute(widths, 1))
    geo.setAttribute('phase', new THREE.InstancedBufferAttribute(phases, 1))
    geo.setAttribute('rotation', new THREE.InstancedBufferAttribute(rotations, 1))
    geo.setAttribute('lean', new THREE.InstancedBufferAttribute(leans, 1))
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
      uColorBase: { value: new THREE.Color('#28490f') },
      uColorMid: { value: new THREE.Color('#436b1e') },
      uColorTip: { value: new THREE.Color('#7ba33a') },
      uTintAmount: { value: 0.4 },
      uFogColor: { value: new THREE.Color('#bfd8e8') },
      uFogNear: { value: 8 },
      uFogFar: { value: 20 },
      uFieldOffset: { value: new THREE.Vector2(0, 0) },
      uFieldSize: { value: new THREE.Vector2(FIELD_WIDTH, FIELD_DEPTH) },
      uRiverPoints: { value: buildRiverUniformArray() },
      uRiverPointsCount: { value: RIVER_POINTS.length },
      uRiverExclusionRadius: { value: RIVER_WIDTH * 0.42 },
      uBrush: { value: null },
      uHasBrush: { value: 0 },
    }

    return { geometry: geo, uniforms }
  }, [])

  useFrame((state, delta) => {
    uniforms.uTime.value += delta
    uniforms.uTouchRadius.value = grass.touchRadius
    uniforms.uTouchStrength.value = grass.touchStrength
    uniforms.uTouchHighlight.value = grass.touchHighlight ?? 0.35
    uniforms.uWindSpeed.value = wind.speed
    uniforms.uWindAmplitude.value = wind.grassAmplitude
    uniforms.uColorBase.value.set(grass.colorBase)
    uniforms.uColorMid.value.set(grass.colorMid)
    uniforms.uColorTip.value.set(grass.colorTip)
    uniforms.uTintAmount.value = grass.tintAmount
    uniforms.uFogColor.value.set(fog.fogColor)
    uniforms.uFogNear.value = fog.fogNear
    uniforms.uFogFar.value = fog.fogFar

    // Camera-following: re-center the grass tile on the camera each frame
    uniforms.uFieldOffset.value.set(state.camera.position.x, state.camera.position.z)

    if (painted?.grass && uniforms.uBrush.value !== painted.grass) {
      uniforms.uBrush.value = painted.grass
      uniforms.uHasBrush.value = 1
    }

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
