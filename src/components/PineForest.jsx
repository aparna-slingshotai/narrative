import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  pineVertexShader,
  pineFragmentShader,
  trunkVertexShader,
  trunkFragmentShader,
} from '../shaders/pine'
import { useWindControls, useFogControls } from '../hooks/useSceneControls'
import { useControls, folder } from 'leva'

// Single procedural pine: trunk + 4 stacked cones (Christmas-tree style).
// Sized by `scale`, colored by passed materials.
function Pine({ position, scale = 1, rotationY = 0, leanZ = 0, foliageMaterial, trunkMaterial }) {
  const trunkHeight = 1.2 * scale
  const trunkRadius = 0.06 * scale

  // 4 cone layers, each smaller than the one below
  const cones = []
  const layerCount = 4
  const baseY = trunkHeight * 0.55 * scale  // foliage starts partway up the trunk
  const layerSpacing = 0.55 * scale
  const baseRadius = 0.55 * scale
  for (let i = 0; i < layerCount; i++) {
    const t = i / (layerCount - 1)         // 0 at bottom, 1 at top
    const r = baseRadius * (1 - t * 0.6)    // taper inward
    const h = layerSpacing * (1.5 - t * 0.3)
    const y = baseY + i * layerSpacing
    cones.push({ y, r, h })
  }

  return (
    <group position={position} rotation={[leanZ * 0.3, rotationY, leanZ]}>
      {/* trunk */}
      <mesh position={[0, trunkHeight / 2, 0]} material={trunkMaterial}>
        <cylinderGeometry args={[trunkRadius * 0.7, trunkRadius, trunkHeight, 8]} />
      </mesh>
      {/* foliage cones */}
      {cones.map((c, i) => (
        <mesh key={i} position={[0, c.y, 0]} material={foliageMaterial}>
          <coneGeometry args={[c.r, c.h, 12]} />
        </mesh>
      ))}
    </group>
  )
}

// Layout: foreground hero pine, plus a scattered set behind / to the sides.
const TREES = [
  { id: 'hero',    position: [0,    0, -7],    scale: 1.4, rotationY: 0.2,   leanZ: 0.04, autumn: false },
  { id: 'left-1',  position: [-3,   0, -8],    scale: 1.0, rotationY: -0.4,  leanZ: 0.0,  autumn: false },
  { id: 'right-1', position: [3.2,  0, -8.5],  scale: 0.95, rotationY: 0.6,   leanZ: -0.03, autumn: false },
  { id: 'back-1',  position: [-1.6, 0, -11],   scale: 0.8, rotationY: 1.1,   leanZ: 0,    autumn: true },
  { id: 'back-2',  position: [2.4,  0, -11.5], scale: 0.7, rotationY: -0.3,  leanZ: 0,    autumn: false },
  { id: 'back-3',  position: [-4.5, 0, -12],   scale: 0.6, rotationY: 0.5,   leanZ: 0,    autumn: false },
  { id: 'back-4',  position: [4.8,  0, -12.5], scale: 0.65, rotationY: -0.7, leanZ: 0,    autumn: false },
]

export default function PineForest() {
  const wind = useWindControls()
  const fog = useFogControls()

  const colors = useControls('Pines', {
    foliage: folder({
      colorDark:  { value: '#3e6b3a', label: 'shadow' },
      colorMid:   { value: '#7a9a4d', label: 'mid' },
      colorLight: { value: '#a8c272', label: 'highlight' },
    }),
    autumnFoliage: folder({
      autumnDark:  { value: '#a17c2c', label: 'shadow' },
      autumnMid:   { value: '#d4a44a', label: 'mid' },
      autumnLight: { value: '#f0d182', label: 'highlight' },
    }),
    trunkColor: { value: '#a06848', label: 'trunk' },
  })

  // Two foliage materials (green + autumn) so we don't recreate per tree.
  const greenMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: pineVertexShader,
        fragmentShader: pineFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uWindAmp: { value: 0.04 },
          uWindSpeed: { value: 1.2 },
          uTrunkPos: { value: new THREE.Vector3() },
          uColorDark: { value: new THREE.Color('#3e6b3a') },
          uColorMid: { value: new THREE.Color('#7a9a4d') },
          uColorLight: { value: new THREE.Color('#a8c272') },
          uFogColor: { value: new THREE.Color('#f4ebd9') },
          uFogNear: { value: 8 },
          uFogFar: { value: 20 },
        },
      }),
    []
  )
  const autumnMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: pineVertexShader,
        fragmentShader: pineFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uWindAmp: { value: 0.04 },
          uWindSpeed: { value: 1.2 },
          uTrunkPos: { value: new THREE.Vector3() },
          uColorDark: { value: new THREE.Color('#a17c2c') },
          uColorMid: { value: new THREE.Color('#d4a44a') },
          uColorLight: { value: new THREE.Color('#f0d182') },
          uFogColor: { value: new THREE.Color('#f4ebd9') },
          uFogNear: { value: 8 },
          uFogFar: { value: 20 },
        },
      }),
    []
  )
  const trunkMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: trunkVertexShader,
        fragmentShader: trunkFragmentShader,
        uniforms: {
          uTrunkColor: { value: new THREE.Color('#a06848') },
          uFogColor: { value: new THREE.Color('#f4ebd9') },
          uFogNear: { value: 8 },
          uFogFar: { value: 20 },
        },
      }),
    []
  )

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    for (const m of [greenMaterial, autumnMaterial]) {
      m.uniforms.uTime.value = t
      m.uniforms.uWindAmp.value = wind.leafAmplitude ?? 0.05
      m.uniforms.uWindSpeed.value = wind.speed
      m.uniforms.uFogColor.value.set(fog.fogColor)
      m.uniforms.uFogNear.value = fog.fogNear
      m.uniforms.uFogFar.value = fog.fogFar
    }
    greenMaterial.uniforms.uColorDark.value.set(colors.colorDark)
    greenMaterial.uniforms.uColorMid.value.set(colors.colorMid)
    greenMaterial.uniforms.uColorLight.value.set(colors.colorLight)
    autumnMaterial.uniforms.uColorDark.value.set(colors.autumnDark)
    autumnMaterial.uniforms.uColorMid.value.set(colors.autumnMid)
    autumnMaterial.uniforms.uColorLight.value.set(colors.autumnLight)
    trunkMaterial.uniforms.uTrunkColor.value.set(colors.trunkColor)
    trunkMaterial.uniforms.uFogColor.value.set(fog.fogColor)
    trunkMaterial.uniforms.uFogNear.value = fog.fogNear
    trunkMaterial.uniforms.uFogFar.value = fog.fogFar
  })

  return (
    <>
      {TREES.map((t) => (
        <Pine
          key={t.id}
          position={t.position}
          scale={t.scale}
          rotationY={t.rotationY}
          leanZ={t.leanZ}
          foliageMaterial={t.autumn ? autumnMaterial : greenMaterial}
          trunkMaterial={trunkMaterial}
        />
      ))}
    </>
  )
}
