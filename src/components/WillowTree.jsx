import { useRef, useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useWindControls, useTreeControls } from '../hooks/useSceneControls'

const barkVertexShader = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const barkFragmentShader = /* glsl */ `
  uniform vec3 uBarkColor;
  uniform vec3 uBarkDark;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  // 3D pseudo-noise for bark grooves
  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float noise3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }
  float fbm3(vec3 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise3(p); p *= 2.1; a *= 0.5; }
    return v;
  }

  void main() {
    // vertical grooves emphasized — sample stretched on Y axis
    vec3 p = vec3(vWorldPos.x * 6.0, vWorldPos.y * 1.4, vWorldPos.z * 6.0);
    float n = fbm3(p);
    float grooves = smoothstep(0.35, 0.6, n);
    vec3 color = mix(uBarkDark, uBarkColor, grooves);

    // soft directional lighting (warm key from upper-right)
    vec3 lightDir = normalize(vec3(0.5, 0.8, 0.3));
    float ndl = max(dot(normalize(vNormal), lightDir), 0.0);
    color *= 0.55 + 0.55 * ndl;

    gl_FragColor = vec4(color, 1.0);
  }
`

export default function WillowTree() {
  const groupRef = useRef()
  const { scene } = useGLTF('/willow.glb')
  const wind = useWindControls()
  const tree = useTreeControls()

  const barkMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: barkVertexShader,
        fragmentShader: barkFragmentShader,
        uniforms: {
          uBarkColor: { value: new THREE.Color('#7a5638') },
          uBarkDark: { value: new THREE.Color('#3d2818') },
        },
      }),
    []
  )

  // Heuristic: meshes whose original material color is light/grey are the
  // trunk/branches; everything else (greenish/leafy) keeps its existing
  // material. Apply bark material to trunk-likes once on load.
  useEffect(() => {
    scene.traverse((obj) => {
      if (!obj.isMesh) return
      const mat = obj.material
      if (!mat) return
      const c = mat.color || new THREE.Color()
      const luminance = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b
      const isGreen = c.g > c.r * 1.15 && c.g > c.b * 1.15
      // anything not clearly green and reasonably light = trunk material
      if (!isGreen && luminance > 0.3) {
        obj.material = barkMaterial
      }
    })
  }, [scene, barkMaterial])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime * wind.speed * 0.5
    groupRef.current.rotation.z = Math.sin(t) * wind.treeAmplitude
    groupRef.current.rotation.x = Math.cos(t * 0.7) * wind.treeAmplitude * 0.5
    groupRef.current.rotation.y = Math.sin(t * 0.3) * wind.treeAmplitude * 0.3
  })

  return (
    <group
      ref={groupRef}
      position={[tree.posX, tree.posY, tree.posZ]}
      scale={tree.scale}
    >
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload('/willow.glb')
