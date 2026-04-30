export const waterVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

// Sketchy painted water: a base blue with hand-drawn ripple dashes
// scrolling along the river length, plus a soft edge fade so the
// water blends into the bank rather than ending at a hard line.
export const waterFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uWaterColor;
  uniform vec3 uHighlight;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

  varying vec2 vUv;
  varying vec3 vWorldPos;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }

  void main() {
    // base color, slightly deeper toward the centerline
    float center = 1.0 - abs(vUv.x - 0.5) * 2.0;
    vec3 color = mix(uWaterColor * 1.10, uWaterColor * 0.85, center);

    // primary scribble dashes — short horizontal marks scrolling downstream
    float u = vUv.y * 18.0 - uTime * 0.4;
    float v = vUv.x * 6.0;
    float dash = sin(u + sin(v * 1.3) * 1.6);
    dash = smoothstep(0.85, 1.0, dash);
    dash *= smoothstep(0.6, 0.85, vnoise(vec2(v * 0.8, u * 0.6)));

    // secondary jitter — finer ripples
    float fine = sin(vUv.y * 50.0 + uTime * 1.6 + vUv.x * 3.0);
    fine = smoothstep(0.92, 1.0, fine);
    fine *= smoothstep(0.7, 0.9, vnoise(vec2(vUv.x * 14.0, vUv.y * 22.0 - uTime * 0.5)));

    color = mix(color, uHighlight, max(dash * 0.7, fine * 0.45));

    // soft side fade to blend into bank
    float edgeFade = smoothstep(0.95, 0.7, abs(vUv.x - 0.5) * 2.0);
    color = mix(uWaterColor * 0.7, color, edgeFade);

    // fog so distant river fades into sky
    float dist = length(vWorldPos - cameraPosition);
    float fog = smoothstep(uFogNear, uFogFar, dist);
    color = mix(color, uFogColor, fog);

    gl_FragColor = vec4(color, 1.0);
  }
`

// Bank shader: sandy/coral stripe just outside the water. Same per-fragment
// fog so it blends with the meadow.
export const bankFragmentShader = /* glsl */ `
  uniform vec3 uBankColor;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec3 color = uBankColor;
    // sketchy noise overlay
    color *= 0.93 + hash(floor(vWorldPos.xz * 30.0)) * 0.12;
    // soft outer edge alpha-equivalent (since we're opaque, mix to fog color at edges)
    float edge = smoothstep(0.0, 0.25, abs(vUv.x - 0.5) * 2.0);
    color = mix(color, uFogColor, edge * 0.4);
    float dist = length(vWorldPos - cameraPosition);
    float fog = smoothstep(uFogNear, uFogFar, dist);
    color = mix(color, uFogColor, fog);
    gl_FragColor = vec4(color, 1.0);
  }
`
