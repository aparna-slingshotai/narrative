import { createContext, useContext, useRef, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const TouchContext = createContext(null)

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const hitPoint = new THREE.Vector3()

export function TouchProvider({ children }) {
  const touchRef = useRef({
    active: false,
    world: new THREE.Vector3(),
    ndc: new THREE.Vector2(),
  })

  const handlePointer = useCallback((e) => {
    const rect = e.target.getBoundingClientRect()
    const x = (e.touches ? e.touches[0] : e).clientX
    const y = (e.touches ? e.touches[0] : e).clientY
    touchRef.current.ndc.set(
      ((x - rect.left) / rect.width) * 2 - 1,
      -((y - rect.top) / rect.height) * 2 + 1
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

export function useTouchWorldPosition() {
  const touchRef = useTouch()
  const { camera } = useThree()
  const worldPos = useRef(new THREE.Vector3())

  useFrame(() => {
    if (!touchRef.current.active) return
    raycaster.setFromCamera(touchRef.current.ndc, camera)
    raycaster.ray.intersectPlane(groundPlane, hitPoint)
    if (hitPoint) worldPos.current.copy(hitPoint)
  })

  return { worldPos, touchRef }
}
