import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useControls, folder } from 'leva'
import {
  waterVertexShader,
  waterFragmentShader,
  bankFragmentShader,
} from '../shaders/water'
import { useFogControls } from '../hooks/useSceneControls'
import { RIVER_POINTS } from '../scene/river'

// Build a ribbon of given width following a CatmullRom curve through
// the centerline points.
function buildRibbonGeometry(centerPoints, width, segments = 90, uvTile = 6) {
  const curve = new THREE.CatmullRomCurve3(centerPoints, false, 'centripetal', 0.4)
  const verts = []
  const uvs = []
  const indices = []
  const tmpPerp = new THREE.Vector3()

  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const point = curve.getPoint(t)
    const tangent = curve.getTangent(t)
    // perpendicular in XZ plane (rotate tangent 90° around Y)
    tmpPerp.set(-tangent.z, 0, tangent.x).normalize()
    const half = width * 0.5
    verts.push(
      point.x + tmpPerp.x * half, point.y, point.z + tmpPerp.z * half,
      point.x - tmpPerp.x * half, point.y, point.z - tmpPerp.z * half
    )
    uvs.push(0, t * uvTile, 1, t * uvTile)
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2
    indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

export default function River() {
  const matRef = useRef()
  const bankRef = useRef()
  const fog = useFogControls()

  const ctrl = useControls('River', {
    enabled:    { value: true, label: 'enabled' },
    waterColor: { value: '#6a9bc8', label: 'water' },
    highlight:  { value: '#dceaf6', label: 'highlight' },
    bankColor:  { value: '#c79a7a', label: 'bank' },
    width:      { value: 1.6, min: 0.4, max: 5, step: 0.1 },
    bankWidth:  { value: 0.8, min: 0,   max: 3, step: 0.1, label: 'bank width' },
  })

  // rebuild geometry only when widths change
  const waterGeo = useMemo(
    () => buildRibbonGeometry(RIVER_POINTS, ctrl.width),
    [ctrl.width]
  )
  const bankGeo = useMemo(
    () => buildRibbonGeometry(RIVER_POINTS, ctrl.width + ctrl.bankWidth * 2, 90, 1),
    [ctrl.width, ctrl.bankWidth]
  )

  const waterUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWaterColor: { value: new THREE.Color(ctrl.waterColor) },
      uHighlight: { value: new THREE.Color(ctrl.highlight) },
      uFogColor: { value: new THREE.Color(fog.fogColor) },
      uFogNear: { value: fog.fogNear },
      uFogFar: { value: fog.fogFar },
    }),
    []
  )
  const bankUniforms = useMemo(
    () => ({
      uBankColor: { value: new THREE.Color(ctrl.bankColor) },
      uFogColor: { value: new THREE.Color(fog.fogColor) },
      uFogNear: { value: fog.fogNear },
      uFogFar: { value: fog.fogFar },
    }),
    []
  )

  useFrame((_, delta) => {
    if (matRef.current) {
      const u = matRef.current.uniforms
      u.uTime.value += delta
      u.uWaterColor.value.set(ctrl.waterColor)
      u.uHighlight.value.set(ctrl.highlight)
      u.uFogColor.value.set(fog.fogColor)
      u.uFogNear.value = fog.fogNear
      u.uFogFar.value = fog.fogFar
    }
    if (bankRef.current) {
      const u = bankRef.current.uniforms
      u.uBankColor.value.set(ctrl.bankColor)
      u.uFogColor.value.set(fog.fogColor)
      u.uFogNear.value = fog.fogNear
      u.uFogFar.value = fog.fogFar
    }
  })

  if (!ctrl.enabled) return null

  return (
    <>
      {/* bank sits slightly below water Y so water layers on top */}
      <mesh geometry={bankGeo} position={[0, -0.005, 0]} renderOrder={0}>
        <shaderMaterial
          ref={bankRef}
          vertexShader={waterVertexShader}
          fragmentShader={bankFragmentShader}
          uniforms={bankUniforms}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <mesh geometry={waterGeo} renderOrder={1}>
        <shaderMaterial
          ref={matRef}
          vertexShader={waterVertexShader}
          fragmentShader={waterFragmentShader}
          uniforms={waterUniforms}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
    </>
  )
}
