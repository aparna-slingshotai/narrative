// Frond shader — color gradient along the frond length (uv.x: 0 at root,
// 1 at tip), plus a sketchy noise overlay so the painted brush quality
// reads even at a distance.
export const frondVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWindAmp;
  uniform float uWindSpeed;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vTint;

  // small per-instance pseudo-random based on the instanced model column
  float instanceSeed() {
    // instanceMatrix[3] holds translation — use it as a per-instance hash
    vec3 t = vec3(instanceMatrix[3].x, instanceMatrix[3].y, instanceMatrix[3].z);
    return fract(sin(dot(t, vec3(12.9, 78.2, 37.7))) * 43758.5);
  }

  void main() {
    vec3 pos = position;

    // tremble at the tip — local Y wobble proportional to uv.x^2
    float seed = instanceSeed();
    float t = uTime * uWindSpeed + seed * 6.28;
    float tipFactor = pow(uv.x, 2.0);
    pos.y += sin(t * 1.4) * uWindAmp * tipFactor * 0.6;
    pos.z += cos(t * 1.1 + 0.7) * uWindAmp * tipFactor * 0.4;

    vec4 wp = modelMatrix * instanceMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;
    vUv = uv;
    vTint = seed * 2.0 - 1.0; // -1..1 per-frond color jitter

    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

export const frondFragmentShader = /* glsl */ `
  uniform sampler2D uBrush;
  uniform float uHasBrush;
  uniform float uAlphaThreshold;
  uniform vec3 uColorDark;
  uniform vec3 uColorMid;
  uniform vec3 uColorLight;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vTint;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    // sample painted brush stamp at vUv; the alpha+luminance now act as
    // a TEXTURE on the full frond (no discard), so the foliage stays
    // solid but reads as brush-painted instead of clean vector.
    vec4 stamp = vec4(1.0);
    if (uHasBrush > 0.5) {
      stamp = texture2D(uBrush, vUv);
    }

    // along the frond: dark at root, mid in middle, light near tip
    vec3 color = mix(uColorDark, uColorMid, smoothstep(0.0, 0.55, vUv.x));
    color = mix(color, uColorLight, smoothstep(0.55, 1.0, vUv.x));

    color.r += vTint * 0.05;
    color.g += vTint * 0.04;
    color.b -= vTint * 0.03;

    vec2 nUv = floor(vWorldPos.xy * 70.0);
    color *= 0.93 + hash(nUv) * 0.10;

    if (uHasBrush > 0.5) {
      // brush adds value variation: where the stamp has paint, brighten;
      // where it's empty, slightly darken. Frond stays fully visible
      // but with painted-stroke quality across its surface.
      float painted = stamp.a; // 0 = no stroke, 1 = fully painted
      color *= mix(0.78, 1.18, painted);
      // mix in stroke color (multiplicative tint) for hand-painted variation
      color = mix(color, color * stamp.rgb * 2.0, painted * 0.35);
    }

    float dist = length(vWorldPos - cameraPosition);
    float fog = smoothstep(uFogNear, uFogFar, dist);
    color = mix(color, uFogColor, fog);

    gl_FragColor = vec4(color, 1.0);
  }
`

// Trunk: thin cylinder with vertical sketch hatching
export const trunkVertexShader = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

export const trunkFragmentShader = /* glsl */ `
  uniform vec3 uTrunkColor;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec3 light = normalize(vec3(0.5, 0.8, 0.3));
    float ndl = dot(normalize(vNormal), light) * 0.5 + 0.5;
    vec3 color = mix(uTrunkColor * 0.7, uTrunkColor, smoothstep(0.4, 0.85, ndl));

    // vertical sketch hatching
    vec2 uv = floor(vec2(vWorldPos.x * 60.0, vWorldPos.y * 8.0));
    color *= 0.9 + hash(uv) * 0.14;

    float dist = length(vWorldPos - cameraPosition);
    float fog = smoothstep(uFogNear, uFogFar, dist);
    color = mix(color, uFogColor, fog);

    gl_FragColor = vec4(color, 1.0);
  }
`
