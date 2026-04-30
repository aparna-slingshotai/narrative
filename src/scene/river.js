import * as THREE from 'three'

// Shared river path data — used by both River.jsx (rendering) and
// GrassField.jsx (carving a no-grass channel). Path threads through
// the foreground with extra bends, then meanders past the trees.
export const RIVER_POINTS = [
  new THREE.Vector3(-7,   0.08,   6),
  new THREE.Vector3(-3,   0.08,   3.2),
  new THREE.Vector3(-1,   0.08,   0.5),
  new THREE.Vector3( 1.5, 0.08,  -2),
  new THREE.Vector3( 0.5, 0.08,  -3.5),    // extra bend back-left
  new THREE.Vector3( 2.0, 0.08,  -5),       // and back right
  new THREE.Vector3( 3.5, 0.08,  -6.5),
  new THREE.Vector3( 4.0, 0.08,  -8.5),
  new THREE.Vector3( 2.0, 0.08, -11),
  new THREE.Vector3(-0.5, 0.08, -14),
  new THREE.Vector3(-3.5, 0.08, -16.5),
  new THREE.Vector3(-6,   0.08, -19),
]

export const RIVER_WIDTH = 1.6
export const RIVER_BANK_WIDTH = 0.8

// Returns the squared distance from `(x, z)` to the closest segment of
// the river centerline. Used by GrassField to skip blades inside the
// channel without an expensive curve sample.
export function distanceToRiverSq(x, z) {
  let best = Infinity
  for (let i = 0; i < RIVER_POINTS.length - 1; i++) {
    const ax = RIVER_POINTS[i].x
    const az = RIVER_POINTS[i].z
    const bx = RIVER_POINTS[i + 1].x
    const bz = RIVER_POINTS[i + 1].z
    const dx = bx - ax
    const dz = bz - az
    const segLenSq = dx * dx + dz * dz
    if (segLenSq < 1e-6) continue
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / segLenSq))
    const px = ax + t * dx
    const pz = az + t * dz
    const ddx = x - px
    const ddz = z - pz
    const d = ddx * ddx + ddz * ddz
    if (d < best) best = d
  }
  return best
}
