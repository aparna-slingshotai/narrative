import { useControls, folder, button } from 'leva'
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { useSceneStore } from '../state/sceneStore'
import { allNodeIds } from '../scene/path'

// Path editing helpers — mounted INSIDE Canvas (uses useThree).
// Mirrors walk-speed into store and provides a button that logs the
// current camera framing so you can paste it into src/scene/path.js.
export function usePathControls() {
  const { camera } = useThree()
  const setWalkSpeed = useSceneStore((s) => s.setWalkSpeed)
  const currentNodeId = useSceneStore((s) => s.currentNodeId)

  const { walkSpeed } = useControls('Path', {
    activeNode: {
      value: currentNodeId ?? allNodeIds[0],
      label: 'current',
      // read-only display via disabled `options` workaround — leva renders a
      // dropdown but the field is informational; selecting just calls the store
      options: allNodeIds.reduce((acc, id) => ({ ...acc, [id]: id }), {}),
      onChange: (id) => {
        // jumping nodes via dropdown isn't supported (it'd break the from→to
        // walk semantics) — just log so the user knows it's read-only-ish
        if (id !== useSceneStore.getState().currentNodeId) {
          // soft-jump: set as currentNodeId without animating
          useSceneStore.setState({ currentNodeId: id, fromNodeId: null, isWalking: false })
        }
      },
    },
    walkSpeed: { value: 1, min: 0.2, max: 3, step: 0.05, label: 'walk speed' },
    'log camera': button(() => {
      const p = camera.position
      const fwd = new Vector3()
      camera.getWorldDirection(fwd)
      const lookAt = {
        x: p.x + fwd.x * 4,
        y: p.y + fwd.y * 4,
        z: p.z + fwd.z * 4,
      }
      const fmt = (n) => Number(n.toFixed(3))
      console.log(
        '[path] paste into path.js node:\n' +
          JSON.stringify(
            {
              position: [fmt(p.x), fmt(p.y), fmt(p.z)],
              lookAt: [fmt(lookAt.x), fmt(lookAt.y), fmt(lookAt.z)],
            },
            null,
            2
          )
      )
    }),
  })

  useEffect(() => {
    setWalkSpeed(walkSpeed)
  }, [walkSpeed, setWalkSpeed])

  return { walkSpeed }
}

export function useFogControls() {
  return useControls('Atmosphere', {
    fogColor: { value: '#f4ebd9', label: 'fog tint' },
    fogNear: { value: 7, min: 1, max: 40, step: 0.5, label: 'fog near' },
    fogFar: { value: 20, min: 5, max: 60, step: 0.5, label: 'fog far' },
  })
}

export function useGrassControls() {
  return useControls('Grass', {
    gradient: folder({
      colorBase: { value: '#5a7838', label: 'base' },
      colorMid: { value: '#88a854', label: 'mid' },
      colorTip: { value: '#c8d68a', label: 'tip' },
      tintAmount: { value: 0.9, min: 0, max: 2, step: 0.05, label: 'tint variance' },
    }),
    touch: folder({
      touchRadius: { value: 1.4, min: 0.3, max: 6, step: 0.1, label: 'radius' },
      touchStrength: { value: 0.3, min: 0, max: 2, step: 0.02, label: 'strength' },
      touchHighlight: { value: 0.4, min: 0, max: 1.5, step: 0.05, label: 'highlight' },
      touchLerp: { value: 0.08, min: 0.01, max: 1, step: 0.01, label: 'response' },
    }),
  })
}

export function useWindControls() {
  return useControls('Wind', {
    speed: { value: 1.4, min: 0, max: 5, step: 0.1 },
    grassAmplitude: { value: 0.16, min: 0, max: 0.5, step: 0.005, label: 'grass sway' },
    treeAmplitude: { value: 0.06, min: 0, max: 0.3, step: 0.005, label: 'tree sway' },
    leafAmplitude: { value: 0.18, min: 0, max: 0.6, step: 0.005, label: 'leaf sway' },
  })
}

export function useTreeControls() {
  return useControls('Tree', {
    transform: folder({
      posX: { value: 0, min: -5, max: 5, step: 0.1, label: 'x' },
      posY: { value: -0.2, min: -2, max: 2, step: 0.05, label: 'y' },
      posZ: { value: -3, min: -10, max: 2, step: 0.1, label: 'z' },
      scale: { value: 0.8, min: 0.1, max: 3, step: 0.05 },
    }),
  })
}
