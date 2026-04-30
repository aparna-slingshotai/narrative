export const skyVertexShader = /* glsl */ `
  varying vec3 vWorldDir;

  void main() {
    // direction from camera to vertex (used as sample direction)
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(worldPos.xyz - cameraPosition);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const skyFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uHorizon;
  uniform vec3 uMid;
  uniform vec3 uZenith;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uCloudDensity;
  uniform float uCloudSpeed;

  varying vec3 vWorldDir;

  // ---- noise ----
  vec3 mod289_3(vec3 x) { return x - floor(x / 289.0) * 289.0; }
  vec4 mod289_4(vec4 x) { return x - floor(x / 289.0) * 289.0; }
  vec4 permute(vec4 x) { return mod289_4((x * 34.0 + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise3(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289_3(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0 / 7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  // fractional brownian motion — sums octaves for cloud detail
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * snoise3(p);
      p *= 2.05;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    // expand vertical range — most viewing angles look near horizon, so we
    // compress the gradient so mid/zenith colors are visible at low elevations
    float t = clamp(dir.y * 3.0, 0.0, 1.0);

    // 3-stop sky gradient
    vec3 sky = mix(uHorizon, uMid, smoothstep(0.0, 0.4, t));
    sky = mix(sky, uZenith, smoothstep(0.4, 1.0, t));

    // sun glow added near sun direction
    float sun = max(dot(dir, normalize(uSunDir)), 0.0);
    sky += uSunColor * pow(sun, 8.0) * 0.4;
    sky += uSunColor * pow(sun, 64.0) * 1.5;

    // FBM clouds — sample 3D noise on a flattened sphere
    vec3 cloudP = vec3(dir.x, dir.y * 2.0, dir.z) * 3.0 + vec3(uTime * uCloudSpeed * 0.05, 0.0, 0.0);
    float n = fbm(cloudP);
    n = n * 0.5 + 0.5;
    // visible band peaks at mid-sky (t around 0.4-0.6)
    float cloudMask = smoothstep(0.15, 0.5, t) * smoothstep(1.05, 0.6, t);
    float cloud = smoothstep(0.55 - uCloudDensity * 0.3, 0.72, n) * cloudMask;
    // tinted clouds — bright top, slightly purple/grey bottoms
    vec3 cloudColor = mix(vec3(0.85, 0.78, 0.85), vec3(1.0, 0.97, 0.92), n);

    vec3 color = mix(sky, cloudColor, cloud);
    gl_FragColor = vec4(color, 1.0);
  }
`
