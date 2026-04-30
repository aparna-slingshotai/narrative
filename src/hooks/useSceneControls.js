import { useControls, folder } from 'leva'

export function useFogControls() {
  return useControls('Atmosphere', {
    fogColor: { value: '#bfd8e8', label: 'fog tint' },
    fogNear: { value: 6, min: 1, max: 30, step: 0.5, label: 'fog near' },
    fogFar: { value: 18, min: 5, max: 50, step: 0.5, label: 'fog far' },
  })
}

export function useGrassControls() {
  return useControls('Grass', {
    gradient: folder({
      colorBase: { value: '#28490f', label: 'base' },
      colorMid: { value: '#436b1e', label: 'mid' },
      colorTip: { value: '#7ba33a', label: 'tip' },
      tintAmount: { value: 0.5, min: 0, max: 2, step: 0.05, label: 'tint variance' },
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
