import { createContext, useContext, useRef, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const TouchContext = createContext(null)

const raycaster = new THREE.Raycaster()
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const hitPoint = new THREE.Vector3()

export const TRAIL_LENGTH = 16

function makeTrail() {
  const arr = []
  for (let i = 0; i < TRAIL_LENGTH; i++) {
    arr.push({ pos: new THREE.Vector3(), age: 999 })
  }
  return arr
}

export function TouchProvider({ children }) {
  const touchRef = useRef({
    active: false,
    ndc: new THREE.Vector2(),
    lastWorld: new THREE.Vector3(),
    lastSampleTime: 0,
    trail: makeTrail(),
    head: 0, // index of next slot to write
  })

  const handlePointer = useCallback((e) => {
    const rect = e.target.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    touchRef.current.ndc.set(
      ((src.clientX - rect.left) / rect.width) * 2 - 1,
      -((src.clientY - rect.top) / rect.height) * 2 + 1
    )
    touchRef.current.active = true
  }, [])

  const handleEnd = useCallback(() => {
    touchRef.current.active = false
  }, [])

  return (
    <TouchContext.Provider value={touchRef}>
      <div
        onPointerDown={handlePointer}
        onPointerMove={handlePointer}
        onPointerUp={handleEnd}
        onPointerCancel={handleEnd}
        style={{ width: '100%', height: '100%' }}
      >
        {children}
      </div>
    </TouchContext.Provider>
  )
}

export function useTouch() {
  return useContext(TouchContext)
}

// Updates trail each frame; returns ref to mutable trail data.
// `sampleInterval` (sec) controls how often a new trail point is dropped.
// `minDistance` controls minimum world distance before dropping a new point.
export function useTouchTrail({ sampleInterval = 0.05, minDistance = 0.1 } = {}) {
  const touchRef = useTouch()
  const { camera } = useThree()
  const tmpWorld = useRef(new THREE.Vector3())

  useFrame((state, delta) => {
    const data = touchRef.current

    // age every trail point
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      data.trail[i].age += delta
    }

    if (!data.active) return

    // raycast current pointer to ground
    raycaster.setFromCamera(data.ndc, camera)
    if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return
    tmpWorld.current.copy(hitPoint)

    const now = state.clock.elapsedTime
    const dist = tmpWorld.current.distanceTo(data.lastWorld)

    // drop a new point if we've moved enough OR enough time has passed
    if (dist > minDistance || now - data.lastSampleTime > sampleInterval * 4) {
      const slot = data.trail[data.head]
      slot.pos.copy(tmpWorld.current)
      slot.age = 0
      data.head = (data.head + 1) % TRAIL_LENGTH
      data.lastWorld.copy(tmpWorld.current)
      data.lastSampleTime = now
    }
  })

  return touchRef
}
