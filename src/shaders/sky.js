export const skyVertexShader = /* glsl */ `
  varying vec3 vWorldDir;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(worldPos.xyz - cameraPosition);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Illustrative sky: warm cream paper background with hand-drawn-looking
// blue scribble clouds. No gradient, no realistic FBM blobs — instead,
// thin horizontal scribbles concentrated in upper/mid sky.
export const skyFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uPaperColor;
  uniform vec3 uScribbleColor;
  uniform float uCloudDensity;
  uniform float uCloudSpeed;

  varying vec3 vWorldDir;

  // smooth value noise
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
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
    vec3 dir = normalize(vWorldDir);
    float t = clamp(dir.y * 2.5, 0.0, 1.0); // 0=horizon, 1=zenith

    // base paper color, slightly cooler at the very top
    vec3 color = mix(uPaperColor, uPaperColor * vec3(0.97, 0.98, 1.02), t);

    // hand-drawn scribbles: stretched horizontal sin waves at multiple scales
    // gives them a sketchy directional feel rather than blob clouds
    float u = atan(dir.x, dir.z) * 4.0 + uTime * uCloudSpeed * 0.05;
    float v = dir.y * 8.0;

    // primary scribble layer
    float s1 = sin(v * 6.0 + sin(u * 1.5) * 1.4) * 0.5 + 0.5;
    s1 *= smoothstep(0.55, 0.7, vnoise(vec2(u * 0.6, v * 0.5)));
    // secondary jitter — short scratchy marks
    float s2 = sin(v * 14.0 + u * 2.3) * 0.5 + 0.5;
    s2 *= smoothstep(0.62, 0.78, vnoise(vec2(u * 1.3 + 5.0, v * 1.1)));
    float scribble = max(s1 * 0.8, s2 * 0.5);

    // mask scribbles to upper/mid sky, fading toward horizon
    float mask = smoothstep(0.05, 0.4, t) * smoothstep(1.05, 0.55, t);
    scribble *= mask * uCloudDensity;

    color = mix(color, uScribbleColor, scribble);

    gl_FragColor = vec4(color, 1.0);
  }
`
