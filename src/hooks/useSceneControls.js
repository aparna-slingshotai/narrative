import { useControls, folder } from 'leva'

export function useGrassControls() {
  return useControls('Grass', {
    touchRadius: { value: 2.5, min: 0.3, max: 6, step: 0.1 },
    touchStrength: { value: 1.2, min: 0, max: 3, step: 0.05 },
    touchLerp: { value: 0.08, min: 0.01, max: 1, step: 0.01, label: 'response' },
  })
}

export function useWindControls() {
  return useControls('Wind', {
    speed: { value: 1.5, min: 0, max: 5, step: 0.1 },
    grassAmplitude: { value: 0.08, min: 0, max: 0.4, step: 0.005, label: 'grass sway' },
    treeAmplitude: { value: 0.04, min: 0, max: 0.3, step: 0.005, label: 'tree sway' },
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
