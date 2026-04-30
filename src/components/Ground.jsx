import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const groundVertexShader = /* glsl */ `
  uniform float uHillHeight;
  uniform float uHillScale;
  varying vec3 vWorldPos;
  varying float vElevation;

  // 2D pseudo-noise (smooth, cheap)
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise2(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise2(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 pos = position;
    // base hill: rise toward the back (away from camera) so horizon is a slope
    float backRise = smoothstep(-2.0, -22.0, pos.y) * uHillHeight * 1.5; // pos.y is depth before rotation
    // gentle rolling noise across the meadow
    float roll = fbm(pos.xy * uHillScale) * uHillHeight * 0.5;
    pos.z = backRise + roll;

    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;
    vElevation = pos.z;

    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const groundFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uShadowColor;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

  varying vec3 vWorldPos;
  varying float vElevation;

  void main() {
    // shade darker in valleys, brighter on hilltops
    float shade = smoothstep(-0.2, 0.6, vElevation);
    vec3 color = mix(uShadowColor, uColor, shade);

    // distance fog so back of meadow blends into sky
    float dist = length(vWorldPos - cameraPosition);
    float fogAmt = smoothstep(uFogNear, uFogFar, dist);
    color = mix(color, uFogColor, fogAmt);

    gl_FragColor = vec4(color, 1.0);
  }
`

export default function Ground({ color = '#3a6b1f', fogColor = '#bcd8ec', fogNear = 6, fogFar = 18 }) {
  const matRef = useRef()

  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(color) },
    uShadowColor: { value: new THREE.Color('#1f3d12') },
    uFogColor: { value: new THREE.Color(fogColor) },
    uFogNear: { value: fogNear },
    uFogFar: { value: fogFar },
    uHillHeight: { value: 0.5 },
    uHillScale: { value: 0.18 },
  }), [])

  useFrame(() => {
    if (!matRef.current) return
    const u = matRef.current.uniforms
    u.uColor.value.set(color)
    u.uFogColor.value.set(fogColor)
    u.uFogNear.value = fogNear
    u.uFogFar.value = fogFar
  })

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
      <planeGeometry args={[60, 60, 80, 80]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={groundVertexShader}
        fragmentShader={groundFragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  )
}
