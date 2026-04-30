// Flat-shaded illustrative material for pine foliage. Uses banded shading
// (toon-like, only 2-3 stops) and a sketch-noise overlay so cones read
// as drawn rather than rendered.
export const pineVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWindAmp;
  uniform float uWindSpeed;
  uniform vec3 uTrunkPos;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vHeightFactor;

  void main() {
    vec3 pos = position;
    vec4 worldBase = modelMatrix * vec4(pos, 1.0);

    // sway: stronger at the top of the tree
    float h = clamp((worldBase.y - uTrunkPos.y) / 4.0, 0.0, 1.0);
    float t = uTime * uWindSpeed;
    float phase = worldBase.x * 0.5 + worldBase.z * 0.4;
    pos.x += sin(t + phase) * uWindAmp * h * h;
    pos.z += cos(t * 0.8 + phase * 0.7) * uWindAmp * 0.6 * h * h;

    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;
    vNormal = normalize(normalMatrix * normal);
    vHeightFactor = h;

    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

export const pineFragmentShader = /* glsl */ `
  uniform vec3 uColorDark;
  uniform vec3 uColorMid;
  uniform vec3 uColorLight;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vHeightFactor;

  // tiny hash for sketchy noise
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    // banded toon shading from a soft directional key
    vec3 light = normalize(vec3(0.4, 0.9, 0.3));
    float ndl = dot(normalize(vNormal), light) * 0.5 + 0.5;
    float band = step(0.55, ndl); // hard 2-stop shading

    vec3 color = mix(uColorDark, uColorMid, band);
    color = mix(color, uColorLight, step(0.78, ndl));

    // height tint — top slightly lighter (sun catching the cone tip)
    color = mix(color, uColorLight, vHeightFactor * 0.18);

    // sketchy texture overlay
    vec2 uv = floor(vWorldPos.xy * 80.0);
    float sketch = hash(uv);
    color *= 0.93 + sketch * 0.10;

    // distance fog → blends into sky
    float dist = length(vWorldPos - cameraPosition);
    float fog = smoothstep(uFogNear, uFogFar, dist);
    color = mix(color, uFogColor, fog);

    gl_FragColor = vec4(color, 1.0);
  }
`

// Trunk: simple flat brown with sketch noise
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
    vec3 color = mix(uTrunkColor * 0.75, uTrunkColor, smoothstep(0.4, 0.8, ndl));

    // vertical sketch hatching
    vec2 uv = floor(vec2(vWorldPos.x * 60.0, vWorldPos.y * 8.0));
    color *= 0.92 + hash(uv) * 0.12;

    float dist = length(vWorldPos - cameraPosition);
    float fog = smoothstep(uFogNear, uFogFar, dist);
    color = mix(color, uFogColor, fog);

    gl_FragColor = vec4(color, 1.0);
  }
`
