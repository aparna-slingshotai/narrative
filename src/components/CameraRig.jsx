import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useControls } from 'leva'
import { useSceneStore } from '../state/sceneStore'

// Camera position/lookAt are owned by PathWalker. CameraRig only owns:
//   - the OrbitControls toggle (for free-look during scene authoring)
//   - the FOV
export default function CameraRig() {
  const camera = useThree((s) => s.camera)
  const orbitRef = useRef()
  const setOrbitMode = useSceneStore((s) => s.setOrbitMode)

  const { orbitMode, fov } = useControls('Camera', {
    orbitMode: { value: false, label: 'orbit (drag)' },
    fov: { value: 71, min: 15, max: 120, step: 1 },
  })

  // mirror orbit toggle into the store so PathWalker can defer
  useEffect(() => {
    setOrbitMode(orbitMode)
  }, [orbitMode, setOrbitMode])

  useFrame(() => {
    if (camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  })

  return orbitMode ? (
    <OrbitControls
      ref={orbitRef}
      enablePan
      enableZoom
      enableRotate
      makeDefault
    />
  ) : null
}
