export const skyVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const skyFragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  // simplex-ish 2D noise
  vec3 mod289(vec3 x) { return x - floor(x / 289.0) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x / 289.0) * 289.0; }
  vec3 permute(vec3 x) { return mod289((x * 34.0 + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = x0.x > x0.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x_) - 0.5;
    vec3 ox = floor(x_ + 0.5);
    vec3 a0 = x_ - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    float t = vUv.y;

    // gradient sky
    vec3 horizon = vec3(0.95, 0.75, 0.55);
    vec3 mid = vec3(0.45, 0.65, 0.88);
    vec3 zenith = vec3(0.18, 0.30, 0.62);
    vec3 sky = mix(horizon, mid, smoothstep(0.0, 0.4, t));
    sky = mix(sky, zenith, smoothstep(0.4, 1.0, t));

    // drifting clouds
    vec2 cloudUv = vec2(vUv.x * 3.0 + uTime * 0.02, vUv.y * 1.5);
    float n = snoise(cloudUv) * 0.5 + 0.5;
    n *= snoise(cloudUv * 2.5 + 0.5) * 0.5 + 0.5;
    float cloudMask = smoothstep(0.3, 0.5, t) * smoothstep(0.95, 0.7, t);
    float cloud = smoothstep(0.35, 0.55, n) * cloudMask * 0.6;

    vec3 color = mix(sky, vec3(1.0), cloud);
    gl_FragColor = vec4(color, 1.0);
  }
`
