import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useControls, folder } from 'leva'

export default function CameraRig() {
  const camera = useThree((s) => s.camera)
  const orbitRef = useRef()

  const { orbitMode, posX, posY, posZ, targetX, targetY, targetZ, fov } = useControls('Camera', {
    orbitMode: { value: false, label: 'Orbit (drag)' },
    fov: { value: 40, min: 15, max: 90, step: 1 },
    position: folder({
      posX: { value: 0, min: -10, max: 10, step: 0.1, label: 'x' },
      posY: { value: 3, min: 0, max: 10, step: 0.1, label: 'y' },
      posZ: { value: 7, min: 0.5, max: 20, step: 0.1, label: 'z' },
    }),
    target: folder({
      targetX: { value: 0, min: -5, max: 5, step: 0.1, label: 'x' },
      targetY: { value: 1.8, min: -2, max: 8, step: 0.1, label: 'y' },
      targetZ: { value: -3, min: -10, max: 5, step: 0.1, label: 'z' },
    }),
  })

  useFrame(() => {
    if (camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    if (!orbitMode) {
      camera.position.set(posX, posY, posZ)
      camera.lookAt(targetX, targetY, targetZ)
    }
  })

  // Reset OrbitControls target when sliders change while in orbit mode
  useEffect(() => {
    if (orbitMode && orbitRef.current) {
      orbitRef.current.target.set(targetX, targetY, targetZ)
      orbitRef.current.update()
    }
  }, [orbitMode, targetX, targetY, targetZ])

  return orbitMode ? (
    <OrbitControls
      ref={orbitRef}
      target={[targetX, targetY, targetZ]}
      enablePan
      enableZoom
      enableRotate
      makeDefault
    />
  ) : null
}
