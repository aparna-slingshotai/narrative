import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useMemo } from 'react'

// Compute the alpha-bbox of a loaded texture in pixel space, then derive
// uvOffset + uvScale so a shader can sample only the active stroke and
// not the huge transparent padding Procreate adds around its previews.
function computeAlphaBBox(image) {
  const cv = document.createElement('canvas')
  cv.width = image.width
  cv.height = image.height
  const ctx = cv.getContext('2d')
  ctx.drawImage(image, 0, 0)
  const data = ctx.getImageData(0, 0, image.width, image.height).data
  let minX = image.width, minY = image.height, maxX = 0, maxY = 0
  let found = false
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const a = data[(y * image.width + x) * 4 + 3]
      if (a > 12) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
        found = true
      }
    }
  }
  if (!found) return { offset: [0, 0], scale: [1, 1], aspect: 1 }
  // small padding so the brush edges don't get clipped at the very last pixel
  const pad = 2
  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  maxX = Math.min(image.width - 1, maxX + pad)
  maxY = Math.min(image.height - 1, maxY + pad)
  const w = maxX - minX + 1
  const h = maxY - minY + 1
  return {
    // UV: y is flipped because three.js textures use bottom-left origin by default
    offset: [minX / image.width, 1.0 - (maxY + 1) / image.height],
    scale: [w / image.width, h / image.height],
    aspect: w / h,
  }
}

export function useBrushes() {
  const [pelion, lovely] = useTexture(['/brushes/pelion.png', '/brushes/lovely.png'])

  return useMemo(() => {
    const out = {}
    for (const [name, t] of [['pelion', pelion], ['lovely', lovely]]) {
      t.wrapS = THREE.ClampToEdgeWrapping
      t.wrapT = THREE.ClampToEdgeWrapping
      t.minFilter = THREE.LinearFilter
      t.magFilter = THREE.LinearFilter
      t.generateMipmaps = false
      t.colorSpace = THREE.NoColorSpace
      t.needsUpdate = true
      const bbox = t.image ? computeAlphaBBox(t.image) : { offset: [0, 0], scale: [1, 1], aspect: 1 }
      out[name] = { texture: t, ...bbox }
    }
    return out
  }, [pelion, lovely])
}
