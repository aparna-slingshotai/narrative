import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  frondVertexShader,
  frondFragmentShader,
  trunkVertexShader,
  trunkFragmentShader,
} from '../shaders/pine'
import { useWindControls, useFogControls } from '../hooks/useSceneControls'
import { useControls, folder } from 'leva'

const FRONDS_PER_TREE = 280
const FROND_LAYERS = 10

// A single tapered, drooping needle frond. Lies along +X axis with the
// tip drooping down -Y, so when an instance is rotated around Y the
// frond points outward and down from the trunk.
function createFrondGeometry() {
  const geo = new THREE.BufferGeometry()
  const verts = []
  const uvs = []
  const indices = []
  const segments = 7
  const length = 1.7         // longer
  const baseWidth = 0.20      // wider
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    // softer taper so most of the frond stays full-width, only the tip narrows
    const w = baseWidth * (1 - Math.pow(t, 2.4))
    const x = t * length
    // deeper droop with mild S-curve
    const y = -Math.pow(t, 1.8) * 0.55
    verts.push(x, y, -w)
    verts.push(x, y, w)
    uvs.push(t, 0)
    uvs.push(t, 1)
  }
  for (let i = 0; i < segments; i++) {
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

const baseFrondGeometry = createFrondGeometry()

// Generate per-instance matrices in distinct vertical layers so the tree
// reads as tiered branches (like a fir) rather than a uniform cloud.
// Bottom layers = many wider drooping fronds. Top = fewer smaller ones.
// All fronds tilt downward to droop.
function generateFrondMatrices(treeHeight, count, layers) {
  const matrices = []
  const tmpPos = new THREE.Vector3()
  const tmpQuat = new THREE.Quaternion()
  const tmpScale = new THREE.Vector3()
  const tmpEuler = new THREE.Euler()

  // distribute total count across layers — more fronds at the bottom
  const layerCounts = []
  let totalWeight = 0
  for (let l = 0; l < layers; l++) {
    const w = 1 + (layers - l - 1) * 0.5 // bottom layers get larger weight
    layerCounts.push(w)
    totalWeight += w
  }
  for (let l = 0; l < layers; l++) {
    layerCounts[l] = Math.round((layerCounts[l] / totalWeight) * count)
  }

  for (let l = 0; l < layers; l++) {
    const layerT = l / (layers - 1) // 0 at bottom, 1 at top
    const baseHeight = (0.16 + layerT * 0.84) * treeHeight
    const heightJitter = 0.06 * treeHeight
    // bottom layers significantly larger; taper toward the top
    const baseSize = 1.25 - layerT * 0.85 // 1.25..0.4
    const inLayer = layerCounts[l]
    for (let i = 0; i < inLayer; i++) {
      const angle = (i / inLayer) * Math.PI * 2 + Math.random() * 0.7
      const h = baseHeight + (Math.random() - 0.5) * heightJitter
      const tilt = -0.30 - Math.random() * 0.30 - layerT * -0.05
      const scale = baseSize * (0.85 + Math.random() * 0.4)
      const radius = 0.025 + Math.random() * 0.04

      tmpPos.set(Math.cos(angle) * radius, h, Math.sin(angle) * radius)
      tmpEuler.set(0, angle, tilt, 'YXZ')
      tmpQuat.setFromEuler(tmpEuler)
      tmpScale.set(scale, scale, scale)

      matrices.push(new THREE.Matrix4().compose(tmpPos, tmpQuat, tmpScale))
    }
  }
  return matrices
}

function Pine({ position, scale, rotationY, leanZ, foliageMaterial, trunkMaterial, swayPhase, swayAmp }) {
  const groupRef = useRef()
  const meshRef = useRef()

  const trunkHeight = 4.5 * scale
  const trunkBottomR = 0.05 * scale
  const trunkTopR = 0.022 * scale

  const frondMatrices = useMemo(
    () => generateFrondMatrices(trunkHeight, FRONDS_PER_TREE, FROND_LAYERS),
    [trunkHeight]
  )

  // apply per-instance matrices once on mount
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < frondMatrices.length; i++) {
      mesh.setMatrixAt(i, frondMatrices[i])
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [frondMatrices])

  // gentle per-tree sway via group rotation
  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime * 0.6 + swayPhase
    groupRef.current.rotation.z = leanZ + Math.sin(t) * swayAmp
    groupRef.current.rotation.x = Math.cos(t * 0.7) * swayAmp * 0.4
  })

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, leanZ]}>
      <mesh position={[0, trunkHeight / 2, 0]} material={trunkMaterial}>
        <cylinderGeometry args={[trunkTopR, trunkBottomR, trunkHeight, 8]} />
      </mesh>
      <instancedMesh
        ref={meshRef}
        args={[baseFrondGeometry, foliageMaterial, frondMatrices.length]}
        frustumCulled={false}
      />
    </group>
  )
}

// Layout — taller, thinner trees pushed further back so the new
// drooping silhouette has room to breathe.
const TREES = [
  { id: 'hero',    position: [0,    0, -8],    scale: 1.3, rotationY: 0.2,   leanZ: 0.03,  autumn: false, swayPhase: 0,    swayAmp: 0.012 },
  { id: 'left-1',  position: [-3.4, 0, -9.5],  scale: 0.95, rotationY: -0.4,  leanZ: 0.0,   autumn: false, swayPhase: 1.7,  swayAmp: 0.014 },
  { id: 'right-1', position: [3.6,  0, -10],   scale: 0.9, rotationY: 0.6,   leanZ: -0.02, autumn: false, swayPhase: 3.1,  swayAmp: 0.013 },
  { id: 'back-1',  position: [-1.6, 0, -13],   scale: 0.75, rotationY: 1.1,   leanZ: 0,    autumn: true,  swayPhase: 0.8,  swayAmp: 0.010 },
  { id: 'back-2',  position: [2.4,  0, -13.5], scale: 0.65, rotationY: -0.3,  leanZ: 0,    autumn: false, swayPhase: 2.4,  swayAmp: 0.011 },
  { id: 'back-3',  position: [-4.7, 0, -14],   scale: 0.55, rotationY: 0.5,   leanZ: 0,    autumn: false, swayPhase: 4.0,  swayAmp: 0.010 },
  { id: 'back-4',  position: [4.9,  0, -14.5], scale: 0.6,  rotationY: -0.7,  leanZ: 0,    autumn: false, swayPhase: 5.2,  swayAmp: 0.012 },
]

export default function PineForest() {
  const wind = useWindControls()
  const fog = useFogControls()

  const colors = useControls('Pines', {
    foliage: folder({
      colorDark:  { value: '#3e6b3a', label: 'shadow' },
      colorMid:   { value: '#7a9a4d', label: 'mid' },
      colorLight: { value: '#b8cf85', label: 'highlight' },
    }),
    autumnFoliage: folder({
      autumnDark:  { value: '#a17c2c', label: 'shadow' },
      autumnMid:   { value: '#d4a44a', label: 'mid' },
      autumnLight: { value: '#f0d182', label: 'highlight' },
    }),
    trunkColor: { value: '#9a6242', label: 'trunk' },
  })

  const greenMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: frondVertexShader,
        fragmentShader: frondFragmentShader,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uWindAmp: { value: 0.04 },
          uWindSpeed: { value: 1.2 },
          uColorDark: { value: new THREE.Color('#3e6b3a') },
          uColorMid: { value: new THREE.Color('#7a9a4d') },
          uColorLight: { value: new THREE.Color('#b8cf85') },
          uFogColor: { value: new THREE.Color('#f4ebd9') },
          uFogNear: { value: 8 },
          uFogFar: { value: 22 },
        },
      }),
    []
  )
  const autumnMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: frondVertexShader,
        fragmentShader: frondFragmentShader,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uWindAmp: { value: 0.04 },
          uWindSpeed: { value: 1.2 },
          uColorDark: { value: new THREE.Color('#a17c2c') },
          uColorMid: { value: new THREE.Color('#d4a44a') },
          uColorLight: { value: new THREE.Color('#f0d182') },
          uFogColor: { value: new THREE.Color('#f4ebd9') },
          uFogNear: { value: 8 },
          uFogFar: { value: 22 },
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
          uTrunkColor: { value: new THREE.Color('#9a6242') },
          uFogColor: { value: new THREE.Color('#f4ebd9') },
          uFogNear: { value: 8 },
          uFogFar: { value: 22 },
        },
      }),
    []
  )

  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (const m of [greenMaterial, autumnMaterial]) {
      m.uniforms.uTime.value = t
      m.uniforms.uWindAmp.value = wind.leafAmplitude ?? 0.04
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
          swayPhase={t.swayPhase}
          swayAmp={t.swayAmp}
          foliageMaterial={t.autumn ? autumnMaterial : greenMaterial}
          trunkMaterial={trunkMaterial}
        />
      ))}
    </>
  )
}
