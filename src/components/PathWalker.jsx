import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useSceneStore } from '../state/sceneStore'
import { path } from '../scene/path'
import { useTouch, dropVirtualTrailPoint } from '../hooks/useTouch'

// easings (kept inline — easier than a separate file for so few lines)
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

// 0→1→0 over [0,1] for fade-in/fade-out of bob/footsteps near segment boundaries
const triangle01 = (t) => 1 - Math.abs(2 * t - 1)

const tmpFrom = new THREE.Vector3()
const tmpTo = new THREE.Vector3()
const tmpPos = new THREE.Vector3()
const tmpLookFrom = new THREE.Vector3()
const tmpLookTo = new THREE.Vector3()
const tmpLook = new THREE.Vector3()
const tmpFoot = new THREE.Vector3()

function resolveNode(id, overrides) {
  const node = path.nodes[id]
  if (!node) return null
  const ov = overrides[id] || {}
  return {
    ...node,
    position: ov.position ?? node.position,
    lookAt: ov.lookAt ?? node.lookAt,
  }
}

export default function PathWalker() {
  const { camera, clock } = useThree()
  const touchRef = useTouch()
  const lastFootSampleTime = useRef(0)
  const lastFootPos = useRef(new THREE.Vector3(NaN, 0, NaN))

  // Boot the path on first mount
  useEffect(() => {
    useSceneStore.getState().bootstrap(path.start)
  }, [])

  useFrame(() => {
    const s = useSceneStore.getState()
    if (s.orbitMode) return // OrbitControls drives the camera while orbit is on

    const currentNode = resolveNode(s.currentNodeId, s.overrides)
    if (!currentNode) return

    const now = performance.now() / 1000
    const clockNow = clock.elapsedTime // for time-of-day style effects (bob freq)

    if (s.isWalking && s.fromNodeId) {
      const fromNode = resolveNode(s.fromNodeId, s.overrides)
      if (!fromNode) return

      const duration = Math.max(0.2, s.walkDuration / Math.max(0.1, s.walkSpeed))
      const raw = (now - s.walkStartTime) / duration
      const t = Math.min(Math.max(raw, 0), 1)
      const e = easeInOutCubic(t)

      tmpFrom.fromArray(fromNode.position)
      tmpTo.fromArray(currentNode.position)
      tmpPos.lerpVectors(tmpFrom, tmpTo, e)

      tmpLookFrom.fromArray(fromNode.lookAt)
      tmpLookTo.fromArray(currentNode.lookAt)
      tmpLook.lerpVectors(tmpLookFrom, tmpLookTo, e)

      // subtle head-bob: triangular envelope fades in/out at endpoints
      const env = triangle01(t)
      const bobAmp = 0.045 * env
      const stepFreq = 6.5
      tmpPos.y += Math.sin(clockNow * stepFreq) * bobAmp
      tmpLook.x += Math.sin(clockNow * stepFreq * 0.5 + 1.0) * 0.08 * env
      tmpLook.y += Math.cos(clockNow * stepFreq * 0.5) * 0.04 * env

      camera.position.copy(tmpPos)
      camera.lookAt(tmpLook)

      // drop a virtual trail point under the player's "feet" so grass bends
      // around the footprint as the camera moves through the field
      tmpFoot.set(tmpPos.x, 0, tmpPos.z)
      const dist = lastFootPos.current.distanceTo(tmpFoot)
      if (
        Number.isNaN(lastFootPos.current.x) ||
        dist > 0.1 ||
        clockNow - lastFootSampleTime.current > 0.08
      ) {
        if (touchRef && touchRef.current) {
          dropVirtualTrailPoint(touchRef, tmpFoot)
        }
        lastFootPos.current.copy(tmpFoot)
        lastFootSampleTime.current = clockNow
      }

      if (raw >= 1) {
        s.arrive()
      }
    } else {
      // idle — snap to current node so leva edits show live
      tmpPos.fromArray(currentNode.position)
      tmpLook.fromArray(currentNode.lookAt)

      // Optional idlePan: sweep the lookAt around the chosen axis so the
      // camera glides slowly while the user reads. Used by the river-pan
      // ending. Sinusoidal so it eases at endpoints — no jolts.
      const pan = currentNode.idlePan
      if (pan) {
        const amp = pan.amplitudeRad ?? 0.2
        const period = pan.periodSec ?? 14
        const phase = (clockNow / period) * Math.PI * 2
        const offset = Math.sin(phase) * amp
        const dx = tmpLook.x - tmpPos.x
        const dy = tmpLook.y - tmpPos.y
        const dz = tmpLook.z - tmpPos.z
        if (pan.axis === 'y' || !pan.axis) {
          const c = Math.cos(offset), s2 = Math.sin(offset)
          tmpLook.set(
            tmpPos.x + c * dx + s2 * dz,
            tmpLook.y,
            tmpPos.z - s2 * dx + c * dz
          )
        } else if (pan.axis === 'x') {
          const c = Math.cos(offset), s2 = Math.sin(offset)
          tmpLook.set(
            tmpLook.x,
            tmpPos.y + c * dy - s2 * dz,
            tmpPos.z + s2 * dy + c * dz
          )
        }
      }

      camera.position.copy(tmpPos)
      camera.lookAt(tmpLook)
    }
  })

  return null
}
