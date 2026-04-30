import { useRef, useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useControls, folder } from 'leva'
import { useWindControls, useTreeControls, useFogControls } from '../hooks/useSceneControls'

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
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

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
    vec3 p = vec3(vWorldPos.x * 6.0, vWorldPos.y * 1.4, vWorldPos.z * 6.0);
    float n = fbm3(p);
    float grooves = smoothstep(0.35, 0.6, n);
    vec3 color = mix(uBarkDark, uBarkColor, grooves);

    vec3 lightDir = normalize(vec3(0.5, 0.8, 0.3));
    float ndl = max(dot(normalize(vNormal), lightDir), 0.0);
    color *= 0.55 + 0.55 * ndl;

    float dist = length(vWorldPos - cameraPosition);
    float fogAmt = smoothstep(uFogNear, uFogFar, dist);
    color = mix(color, uFogColor, fogAmt);

    gl_FragColor = vec4(color, 1.0);
  }
`

// Willow leaf shader: wind sway with smooth spatially-coherent color so
// adjacent strands look similar — avoids strobing when they sway across
// the same pixel.
const leafVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWindSpeed;
  uniform float uLeafAmplitude;
  uniform vec3 uTrunkPos;
  uniform vec3 uLeafDark;
  uniform vec3 uLeafMid;
  uniform vec3 uLeafLight;
  varying vec3 vWorldPos;
  varying vec3 vColor;

  void main() {
    vec3 pos = position;
    vec4 worldBase = modelMatrix * vec4(pos, 1.0);

    // height factor — drooping willow strands hang DOWN, lower parts move more
    float heightFactor = clamp(1.0 - (worldBase.y - uTrunkPos.y) / 4.0, 0.0, 1.0);
    float swayAmount = uLeafAmplitude * (0.4 + heightFactor * heightFactor * 1.2);

    // wind displacement
    float t = uTime * uWindSpeed;
    float swayPhase = worldBase.x * 0.8 + worldBase.z * 0.6;
    pos.x += sin(t + swayPhase) * swayAmount;
    pos.z += cos(t * 0.7 + swayPhase * 0.9) * swayAmount * 0.6;

    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;

    // SMOOTH color variation: continuous sin-based noise instead of fract(sin)
    // hash. Two octaves at different scales for organic feel without harshness.
    float seed = worldBase.x * 0.5 + worldBase.z * 0.4 + worldBase.y * 0.15;
    float n1 = 0.5 + 0.5 * sin(seed);
    float n2 = 0.5 + 0.5 * sin(seed * 2.3 + 1.7);
    float blend = n1 * 0.65 + n2 * 0.35;

    // 3-stop palette — smooth interpolation, no hard color jumps
    vec3 color = mix(uLeafDark, uLeafMid, smoothstep(0.0, 0.55, blend));
    color = mix(color, uLeafLight, smoothstep(0.55, 1.0, blend));

    // gentle canopy-height tint: top brighter, bottom slightly cooler
    float canopyT = clamp((worldBase.y - uTrunkPos.y + 2.0) * 0.12, 0.0, 1.0);
    color += vec3(0.04, 0.05, 0.02) * canopyT;

    vColor = color;

    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const leafFragmentShader = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec3 vWorldPos;
  varying vec3 vColor;
  void main() {
    vec3 color = vColor;
    float dist = length(vWorldPos - cameraPosition);
    float fogAmt = smoothstep(uFogNear, uFogFar, dist);
    color = mix(color, uFogColor, fogAmt);
    gl_FragColor = vec4(color, 1.0);
  }
`

export default function WillowTree() {
  const groupRef = useRef()
  const { scene } = useGLTF('/willow.glb')
  const wind = useWindControls()
  const tree = useTreeControls()
  const fog = useFogControls()
  const leafColors = useControls('Leaves', {
    leafDark: { value: '#34521a', label: 'dark' },
    leafMid: { value: '#4d702a', label: 'mid' },
    leafLight: { value: '#6f9239', label: 'light' },
  })

  const barkMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: barkVertexShader,
        fragmentShader: barkFragmentShader,
        uniforms: {
          uBarkColor: { value: new THREE.Color('#7a5638') },
          uBarkDark: { value: new THREE.Color('#3d2818') },
          uFogColor: { value: new THREE.Color('#bfd8e8') },
          uFogNear: { value: 8 },
          uFogFar: { value: 20 },
        },
      }),
    []
  )

  const leafMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: leafVertexShader,
        fragmentShader: leafFragmentShader,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uWindSpeed: { value: 1.4 },
          uLeafAmplitude: { value: 0.18 },
          uTrunkPos: { value: new THREE.Vector3(0, 4, -3) },
          uLeafDark: { value: new THREE.Color('#34521a') },
          uLeafMid: { value: new THREE.Color('#4d702a') },
          uLeafLight: { value: new THREE.Color('#6f9239') },
          uFogColor: { value: new THREE.Color('#bfd8e8') },
          uFogNear: { value: 8 },
          uFogFar: { value: 20 },
        },
      }),
    []
  )

  // partition meshes into trunk vs leaves based on original material color
  useEffect(() => {
    scene.traverse((obj) => {
      if (!obj.isMesh) return
      const mat = obj.material
      if (!mat) return
      const c = mat.color || new THREE.Color()
      const luminance = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b
      const isGreen = c.g > c.r * 1.15 && c.g > c.b * 1.15
      if (isGreen) {
        obj.material = leafMaterial
      } else if (luminance > 0.3) {
        obj.material = barkMaterial
      }
    })
  }, [scene, barkMaterial, leafMaterial])

  useFrame((state, delta) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime * wind.speed * 0.5
    groupRef.current.rotation.z = Math.sin(t) * wind.treeAmplitude
    groupRef.current.rotation.x = Math.cos(t * 0.7) * wind.treeAmplitude * 0.5
    groupRef.current.rotation.y = Math.sin(t * 0.3) * wind.treeAmplitude * 0.3

    leafMaterial.uniforms.uTime.value += delta
    leafMaterial.uniforms.uWindSpeed.value = wind.speed
    leafMaterial.uniforms.uLeafAmplitude.value = wind.leafAmplitude ?? 0.18
    leafMaterial.uniforms.uLeafDark.value.set(leafColors.leafDark)
    leafMaterial.uniforms.uLeafMid.value.set(leafColors.leafMid)
    leafMaterial.uniforms.uLeafLight.value.set(leafColors.leafLight)
    leafMaterial.uniforms.uFogColor.value.set(fog.fogColor)
    leafMaterial.uniforms.uFogNear.value = fog.fogNear
    leafMaterial.uniforms.uFogFar.value = fog.fogFar
    barkMaterial.uniforms.uFogColor.value.set(fog.fogColor)
    barkMaterial.uniforms.uFogNear.value = fog.fogNear
    barkMaterial.uniforms.uFogFar.value = fog.fogFar

    // update trunk world position so leaf shader knows where the tree centerline is
    leafMaterial.uniforms.uTrunkPos.value.set(tree.posX, tree.posY + 3, tree.posZ)
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
