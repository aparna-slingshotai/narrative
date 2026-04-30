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

// Painted-water look: layered horizontal brush strokes of varying length,
// scrolling at different speeds. Edges fade into the bank with a sketchy
// noise mask so the boundary reads as paint, not a rectangle.
export const waterFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uWaterColor;
  uniform vec3 uHighlight;
  uniform vec3 uShadow;
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
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.05; a *= 0.5; }
    return v;
  }

  void main() {
    // base — slightly darker in the middle so the river has shape
    float center = 1.0 - abs(vUv.x - 0.5) * 2.0;
    vec3 color = mix(uWaterColor, uShadow, center * 0.35);

    // long painterly strokes scrolling downstream
    float u1 = vUv.y * 4.0 - uTime * 0.18;
    float strokes = fbm(vec2(vUv.x * 5.0, u1));
    color = mix(color, uHighlight, smoothstep(0.55, 0.85, strokes) * 0.55);

    // medium ripple lines
    float u2 = vUv.y * 14.0 - uTime * 0.45;
    float ripples = sin(u2 + sin(vUv.x * 7.0) * 1.6) * 0.5 + 0.5;
    ripples *= smoothstep(0.55, 0.8, vnoise(vec2(vUv.x * 9.0, u2 * 0.9)));
    color = mix(color, uHighlight, ripples * 0.55);

    // sharp short highlights — brushy "sparkles"
    float u3 = vUv.y * 60.0 + uTime * 1.4;
    float sparkle = sin(u3 + vUv.x * 18.0) * 0.5 + 0.5;
    sparkle *= smoothstep(0.92, 1.0, vnoise(vec2(vUv.x * 22.0, u3 * 0.5)));
    color = mix(color, vec3(1.0), sparkle * 0.45);

    // soft side fade to bank (no hard rectangle edge)
    float bankFade = abs(vUv.x - 0.5) * 2.0;
    float bankNoise = vnoise(vec2(vUv.y * 18.0, vUv.x * 8.0)) * 0.18;
    float fade = smoothstep(0.95 - bankNoise, 0.65 - bankNoise, bankFade);
    color = mix(uWaterColor * 0.55, color, fade);

    float dist = length(vWorldPos - cameraPosition);
    float fog = smoothstep(uFogNear, uFogFar, dist);
    color = mix(color, uFogColor, fog);

    gl_FragColor = vec4(color, 1.0);
  }
`

// Bank shader — painterly cream/coral with visible directional brush
// strokes and an irregular outer edge that blends into the meadow grass.
export const bankFragmentShader = /* glsl */ `
  uniform vec3 uBankColor;
  uniform vec3 uBankWarm;
  uniform vec3 uGrassTint;
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
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.05; a *= 0.5; }
    return v;
  }

  void main() {
    // base mixes warm coral and cool cream based on noise
    float warmth = fbm(vec2(vUv.y * 3.0, vUv.x * 5.0));
    vec3 color = mix(uBankColor, uBankWarm, warmth);

    // directional brush strokes along the bank length (uv.y axis)
    float strokes = sin(vUv.y * 26.0 + sin(vUv.x * 4.0) * 1.5);
    strokes = smoothstep(0.55, 0.95, strokes);
    strokes *= smoothstep(0.5, 0.8, vnoise(vec2(vUv.x * 12.0, vUv.y * 22.0)));
    color *= 0.88 + strokes * 0.18;

    // dispersed sketchy specks
    float specks = step(0.92, hash(floor(vWorldPos.xz * 28.0)));
    color *= 1.0 - specks * 0.12;

    // outer edge — irregular, paint-bleeds into grass tint
    float edge = abs(vUv.x - 0.5) * 2.0; // 0 at centerline, 1 at outer rim
    float edgeNoise = fbm(vec2(vUv.y * 8.0, vUv.x * 4.0)) * 0.25;
    float meld = smoothstep(0.55 + edgeNoise, 0.95 + edgeNoise, edge);
    color = mix(color, uGrassTint, meld);

    float dist = length(vWorldPos - cameraPosition);
    float fog = smoothstep(uFogNear, uFogFar, dist);
    color = mix(color, uFogColor, fog);
    gl_FragColor = vec4(color, 1.0);
  }
`
