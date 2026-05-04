import { useMemo, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useControls } from 'leva'

// Two-pass watercolor landscape — Buffer A (SDF raymarch) → Image (compositor).
// Replaces the React Three Fiber scene + PostFx with a single full-screen shader
// pair, equivalent to running the McfGW2 Shadertoy port inside the app.
//
// Pass 1 writes (matID, diffuse, specular, shadow) to a render target.
// Pass 2 samples that buffer and runs the McfGW2 paintLayer compositor.

const COMMON_GLSL = /* glsl */ `
  #define MAT_SKY     0.0
  #define MAT_GROUND  1.0
  #define MAT_TRUNK   2.0
  #define MAT_FOLIAGE 3.0
  #define MAT_WATER   4.0
  #define MAT_BANK    5.0
  #define MAT_BIRCH   6.0

  #define TREE_COUNT 12
  #define BIRCH_COUNT 4
  #define BUSH_COUNT 14
  #define RIVER_COUNT 12

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float cc = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(cc, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.05; a *= 0.5; }
    return v;
  }
`

const BUFFER_A_FRAG = /* glsl */ `
  precision highp float;
  uniform vec2 iResolution;
  uniform float iTime;
  uniform vec3 uCamPos;
  uniform mat3 uCamMat;
  uniform float uFocal;

  ${COMMON_GLSL}

  const vec3 LIGHT_DIR = vec3(0.81649658, 0.40824829, -0.40824829); // normalize(2,1,-1)

  vec3 TREES[TREE_COUNT];
  vec3 BIRCHES[BIRCH_COUNT];
  vec3 BUSHES[BUSH_COUNT];
  vec2 RIVER[RIVER_COUNT];
  void initData() {
    // Pines — original 7 plus 5 more spread across visible quadrants so
    // every camera angle frames foliage instead of bare horizon.
    TREES[0]  = vec3(  0.0,  -8.0, 1.30);
    TREES[1]  = vec3( -3.4,  -9.5, 0.95);
    TREES[2]  = vec3(  3.6, -10.0, 0.90);
    TREES[3]  = vec3( -1.6, -13.0, 0.75);
    TREES[4]  = vec3(  2.4, -13.5, 0.65);
    TREES[5]  = vec3( -4.7, -14.0, 0.55);
    TREES[7]  = vec3(  4.9, -14.5, 0.60);
    TREES[7]  = vec3( -7.5,  -6.0, 0.85); // left foreground
    TREES[8]  = vec3(  7.0,  -4.5, 0.80); // right foreground
    TREES[9]  = vec3( -9.0, -11.0, 0.70); // far left
    TREES[10] = vec3(  9.0, -12.0, 0.75); // far right
    TREES[11] = vec3( -2.0, -19.0, 0.55); // deep back
    // Birches — pale, taller, narrower. Placed mid-distance among pines.
    BIRCHES[0] = vec3(-2.5,  -6.0, 0.90);
    BIRCHES[1] = vec3( 2.0,  -7.0, 0.85);
    BIRCHES[2] = vec3(-5.5, -11.0, 0.80);
    BIRCHES[3] = vec3( 5.5, -11.5, 0.80);
    // Bushes — low fbm-perturbed clumps along the bank and meadow gaps.
    BUSHES[0]  = vec3(-2.0, -2.5, 0.45);
    BUSHES[1]  = vec3( 1.8, -3.0, 0.40);
    BUSHES[2]  = vec3(-3.5, -5.0, 0.50);
    BUSHES[3]  = vec3( 4.0, -6.5, 0.45);
    BUSHES[4]  = vec3(-6.0, -7.5, 0.55);
    BUSHES[5]  = vec3( 6.5, -8.5, 0.50);
    BUSHES[7]  = vec3( 0.5, -5.5, 0.35);
    BUSHES[7]  = vec3(-1.0, -10.0, 0.45);
    BUSHES[8]  = vec3( 3.0, -11.0, 0.45);
    BUSHES[9]  = vec3(-4.5, -3.5, 0.35);
    BUSHES[10] = vec3( 5.5, -2.5, 0.40);
    BUSHES[11] = vec3(-8.0, -4.0, 0.50);
    BUSHES[12] = vec3( 8.5, -6.0, 0.50);
    BUSHES[13] = vec3( 0.0, -16.0, 0.55);
    RIVER[0]  = vec2(-7.0,   6.0);
    RIVER[1]  = vec2(-3.0,   3.2);
    RIVER[2]  = vec2(-1.0,   0.5);
    RIVER[3]  = vec2( 1.5,  -2.0);
    RIVER[4]  = vec2( 0.5,  -3.5);
    RIVER[5]  = vec2( 2.0,  -5.0);
    RIVER[7]  = vec2( 3.5,  -6.5);
    RIVER[7]  = vec2( 4.0,  -8.5);
    RIVER[8]  = vec2( 2.0, -11.0);
    RIVER[9]  = vec2(-0.5, -14.0);
    RIVER[10] = vec2(-3.5, -16.5);
    RIVER[11] = vec2(-6.0, -19.0);
  }
  const float RIVER_WIDTH = 1.5;
  const float BANK_WIDTH  = 0.18;

  float sdCappedCylinder(vec3 p, float r, float h) {
    vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
  }
  float sdEllipsoid(vec3 p, vec3 r) {
    float k0 = length(p / r);
    float k1 = length(p / (r * r));
    return k0 * (k0 - 1.0) / k1;
  }

  vec2 minSdf(vec2 d, float dn, float id) {
    if (dn < d.x) return vec2(dn, id);
    return d;
  }
  float distToRiverXZ(vec2 p) {
    float best = 1e3;
    for (int i = 0; i < RIVER_COUNT - 1; i++) {
      vec2 a = RIVER[i], b = RIVER[i + 1];
      vec2 pa = p - a, ba = b - a;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
      best = min(best, length(pa - ba * h));
    }
    return best;
  }
  float groundHeight(vec2 xz) {
    // Subtle hill roll only — no aggressive back-rise, so the horizon
    // line stays clear and the sky remains visible behind the trees.
    return fbm(xz * 0.18) * 0.35 - 0.2;
  }
  vec2 sdPine(vec3 p, vec3 t) {
    vec3 q = vec3(p.x - t.x, p.y, p.z - t.y);
    float s = t.z;
    // Capped-cylinder bound — proper SDF that accounts for vertical extent
    // too, so rays going UP near a tree don't accumulate false hits at
    // the iteration limit. matID 99 is a sentinel; raycastScene treats
    // any d.y > 90 as a miss instead of rendering it as foliage.
    vec2 bbXZ = vec2(length(q.xz), 0.0) - vec2(1.6 * s, 0.0);
    float bbY = max(q.y - 5.0 * s, -q.y - 0.2);
    float bound = max(bbXZ.x, bbY);
    if (bound > 0.5) return vec2(bound, 99.0);
    float trunkH = 4.5 * s;
    float trunkR = 0.05 * s;
    float trunk = sdCappedCylinder(q - vec3(0, trunkH * 0.5, 0), trunkR, trunkH * 0.5);
    // Fixed-phase foliage offset (was time-driven; removed to kill
    // screen-space warping through the watercolor blur).
    float phase = dot(t.xy, vec2(7.3, 4.1));
    vec2 sway = vec2(sin(phase), cos(phase + 1.0)) * 0.035 * s;
    vec3 fp = q - vec3(sway.x, trunkH * 0.65, sway.y);
    vec3 fr = vec3(1.1 * s, 1.75 * s, 1.1 * s);
    float ellip = sdEllipsoid(fp, fr);
    // Shell-bound the noise: it only displaces points near the ellipsoid
    // surface. Without this, far-away rays read as "inside" the perturbed
    // surface, and the marcher reports phantom hits — producing the
    // long vertical column that appeared above the tree.
    float shell = 1.0 - smoothstep(0.0, 0.5, abs(ellip));
    float lumps = (fbm(fp.xz * 3.0 + fp.y * 2.0) - 0.5) * 0.18
                + (fbm(fp.xy * 7.0 + fp.z * 4.0) - 0.5) * 0.10;
    float foliage = ellip - lumps * s * shell;
    if (trunk < foliage) return vec2(trunk, MAT_TRUNK);
    return vec2(foliage, MAT_FOLIAGE);
  }
  // Birch: taller and thinner than pine, with a smaller higher canopy.
  // Trunk uses MAT_BIRCH (paler bark); foliage shares MAT_FOLIAGE.
  vec2 sdBirch(vec3 p, vec3 t) {
    vec3 q = vec3(p.x - t.x, p.y, p.z - t.y);
    float s = t.z;
    vec2 bbXZ = vec2(length(q.xz), 0.0) - vec2(1.3 * s, 0.0);
    float bbY = max(q.y - 6.5 * s, -q.y - 0.2);
    float bound = max(bbXZ.x, bbY);
    if (bound > 0.5) return vec2(bound, 99.0);
    float trunkH = 5.5 * s;
    float trunkR = 0.045 * s;
    float trunk = sdCappedCylinder(q - vec3(0, trunkH * 0.5, 0), trunkR, trunkH * 0.5);
    vec3 fp = q - vec3(0.0, trunkH * 0.78, 0.0);
    vec3 fr = vec3(0.85 * s, 1.25 * s, 0.85 * s);
    float ellip = sdEllipsoid(fp, fr);
    float shell = 1.0 - smoothstep(0.0, 0.5, abs(ellip));
    float lumps = (fbm(fp.xz * 3.5 + fp.y * 2.0) - 0.5) * 0.16
                + (fbm(fp.xy * 8.0 + fp.z * 4.0) - 0.5) * 0.09;
    float foliage = ellip - lumps * s * shell;
    if (trunk < foliage) return vec2(trunk, MAT_BIRCH);
    return vec2(foliage, MAT_FOLIAGE);
  }
  // Bush: low squashed ellipsoid with stronger fbm lumps. Sits on the
  // ground; t.z is scale (~0.35-0.55 reads as a knee-high shrub).
  vec2 sdBush(vec3 p, vec3 t) {
    vec3 q = vec3(p.x - t.x, p.y, p.z - t.y);
    float s = t.z;
    vec2 bbXZ = vec2(length(q.xz), 0.0) - vec2(1.4 * s, 0.0);
    float bbY = max(q.y - 1.4 * s, -q.y - 0.2);
    float bound = max(bbXZ.x, bbY);
    if (bound > 0.4) return vec2(bound, 99.0);
    vec3 bp = q - vec3(0.0, 0.55 * s, 0.0);
    vec3 br = vec3(1.05 * s, 0.55 * s, 1.05 * s);
    float ellip = sdEllipsoid(bp, br);
    float shell = 1.0 - smoothstep(0.0, 0.4, abs(ellip));
    float lumps = (fbm(bp.xz * 4.0 + bp.y * 3.0) - 0.5) * 0.22
                + (fbm(bp.xy * 9.0 + bp.z * 5.0) - 0.5) * 0.10;
    float bush = ellip - lumps * s * shell;
    return vec2(bush, MAT_FOLIAGE);
  }
  vec2 sdScene(vec3 p) {
    vec2 d = vec2(1e3, 0.0);
    float gh = groundHeight(p.xz);
    float dr = distToRiverXZ(p.xz);
    float bankEdge = RIVER_WIDTH * 0.5 + BANK_WIDTH;
    float matG;
    float surfaceY = gh;
    if (dr < RIVER_WIDTH * 0.5) {
      matG = MAT_WATER; surfaceY = gh - 0.05;
    } else if (dr < bankEdge) {
      matG = MAT_BANK;  surfaceY = gh - 0.02;
    } else {
      matG = MAT_GROUND;
    }
    d = minSdf(d, p.y - surfaceY, matG);
    for (int i = 0; i < TREE_COUNT; i++) {
      vec2 tree = sdPine(p, TREES[i]);
      if (tree.x < d.x) d = tree;
    }
    for (int i = 0; i < BIRCH_COUNT; i++) {
      vec2 b = sdBirch(p, BIRCHES[i]);
      if (b.x < d.x) d = b;
    }
    for (int i = 0; i < BUSH_COUNT; i++) {
      vec2 b = sdBush(p, BUSHES[i]);
      if (b.x < d.x) d = b;
    }
    return d;
  }
  vec3 sceneNormal(vec3 p) {
    // Tetrahedron-tap normal — 4 sdScene calls instead of 6 (33% fewer).
    // sdScene now loops ~30 SDF objects per call, so this is a noticeable
    // saving per shaded pixel.
    const float e = 0.005;
    vec2 k = vec2(1.0, -1.0);
    return normalize(
      k.xyy * sdScene(p + k.xyy * e).x +
      k.yyx * sdScene(p + k.yyx * e).x +
      k.yxy * sdScene(p + k.yxy * e).x +
      k.xxx * sdScene(p + k.xxx * e).x
    );
  }
  float raycastScene(vec3 ro, vec3 rd, out float matID) {
    float t = 0.01;
    vec2 d = vec2(1e3, 0.0);
    // 56 steps is enough now that bounding-cylinder culls let the marcher
    // take big strides through empty meadow. Far-clip 60 — anything beyond
    // is hidden by horizon/sky anyway.
    for (int i = 0; i < 56; i++) {
      if (t > 60.0) break;
      d = sdScene(ro + t * rd);
      if (d.x < t * 0.001) break;
      t += d.x;
    }
    matID = d.y;
    // d.y > 90 = bounding-cull sentinel, treat as a miss (sky) so the
    // marcher running out of iterations near a tree's bound never reports
    // a phantom foliage hit (which produced the vertical column artifact).
    return (t >= 60.0 || d.y > 90.0) ? -1.0 : t;
  }
  float raycastShadow(vec3 ro, vec3 rd, float k) {
    float t = 0.05; float l = 1.0;
    // Halved from 32 — soft shadows are blurred by the watercolor pass
    // anyway, so the loss in penumbra crispness isn't visible.
    for (int i = 0; i < 16; i++) {
      if (t > 18.0) break;
      vec2 d = sdScene(ro + t * rd);
      l = min(l, max(0.0, k * d.x / t));
      if (d.x < 0.001) break;
      t += d.x;
    }
    return l;
  }
  vec4 renderScene(vec3 ro, vec3 rd) {
    float matID = MAT_SKY;
    float t = raycastScene(ro, rd, matID);
    if (t < 0.0) return vec4(MAT_SKY, 1.0, 0.0, 1.0);
    vec3 p = ro + t * rd;
    vec3 n = sceneNormal(p);
    float diffuse = clamp(dot(LIGHT_DIR, n), 0.0, 1.0);
    vec3 hv = normalize(-rd + LIGHT_DIR);
    float specular = max(0.0, pow(max(dot(hv, n), 0.0), 8.0));
    // Shadow march disabled — was 16 sdScene calls per shaded pixel (each
    // sdScene loops 30 SDF objects). The watercolor compositor's
    // shadow-blend lerp uses (1.0 - blurred.w); a fixed value here gives a
    // gentle soft shadow without the per-pixel raymarch cost.
    float shadow = 0.85;
    return vec4(matID, diffuse, specular, shadow);
  }
  mat3 cameraTransform(vec3 pos, vec3 target, float roll) {
    vec3 cw = normalize(target - pos);
    vec3 up = vec3(sin(roll), cos(roll), 0.0);
    vec3 cu = normalize(cross(cw, up));
    vec3 cv = normalize(cross(cu, cw));
    return mat3(cu, cv, cw);
  }

  void main() {
    initData();
    vec2 fragCoord = gl_FragCoord.xy;
    vec2 p = (fragCoord - 0.5 * iResolution) / iResolution.y;
    // Camera driven by R3F (PathWalker / CameraRig / OrbitControls).
    // Three.js looks down -Z, so view-space ray is (p.x, p.y, -focal).
    vec3 ro = uCamPos;
    vec3 rd = normalize(uCamMat * vec3(p, -uFocal));
    vec4 data = renderScene(ro, rd);
    // Encode matID into 0..1 range for UnsignedByte storage. The Image
    // pass multiplies back by 255 before comparing.
    data.x /= 255.0;
    gl_FragColor = data;
  }
`

const IMAGE_FRAG = /* glsl */ `
  precision highp float;
  uniform vec2 iResolution;
  uniform float iTime;
  uniform sampler2D tBufferA;

  ${COMMON_GLSL}

  // ---- materialType (collapsed into parallel arrays — GLSL ES 1.0 has no struct arrays) ----
  // Seven materials: SKY GROUND TRUNK FOLIAGE WATER BANK BIRCH
  vec3 M_color[7];
  vec3 M_dark[7];
  vec3 M_lshadow[7];
  vec3 M_dshadow[7];
  float M_alpha[7];
  float M_shadowAlpha[7];
  vec2 M_flow[7];
  float M_edge[7];
  float M_specular[7];
  vec2 M_paper[7];

  void initMaterials() {
    // 0 SKY — cream paper / blue-gray scribble
    M_color[0]   = vec3(0.957, 0.922, 0.851);
    M_dark[0]    = vec3(0.608, 0.722, 0.831);
    M_lshadow[0] = vec3(0.957, 0.922, 0.851) * 0.85;
    M_dshadow[0] = vec3(0.608, 0.722, 0.831) * 0.7;
    M_alpha[0] = 0.0; M_shadowAlpha[0] = 0.0;
    M_flow[0]  = vec2(0.3, 0.6); M_edge[0] = 0.0; M_specular[0] = 0.0; M_paper[0] = vec2(0.0, 0.0);

    // 1 GROUND
    M_color[1]   = vec3(0.486, 0.588, 0.282);
    M_dark[1]    = vec3(0.122, 0.239, 0.071);
    M_lshadow[1] = vec3(0.486, 0.588, 0.282) * 0.55;
    M_dshadow[1] = vec3(0.122, 0.239, 0.071) * 0.55;
    M_alpha[1] = 0.45; M_shadowAlpha[1] = 0.45;
    M_flow[1] = vec2(0.5, 0.5); M_edge[1] = 0.55; M_specular[1] = 0.7; M_paper[1] = vec2(0.2, 0.4);

    // 2 TRUNK
    M_color[2]   = vec3(0.604, 0.384, 0.259);
    M_dark[2]    = vec3(0.604, 0.384, 0.259) * 0.35;
    M_lshadow[2] = vec3(0.604, 0.384, 0.259) * 0.55;
    M_dshadow[2] = vec3(0.604, 0.384, 0.259) * 0.20;
    M_alpha[2] = 0.55; M_shadowAlpha[2] = 0.55;
    M_flow[2] = vec2(0.5, 0.18); M_edge[2] = 0.35; M_specular[2] = 0.9; M_paper[2] = vec2(0.3, 0.6);

    // 3 FOLIAGE
    M_color[3]   = vec3(0.478, 0.604, 0.302);
    M_dark[3]    = vec3(0.243, 0.420, 0.227);
    M_lshadow[3] = vec3(0.722, 0.812, 0.522);
    M_dshadow[3] = vec3(0.243, 0.420, 0.227) * 0.55;
    M_alpha[3] = 0.42; M_shadowAlpha[3] = 0.42;
    M_flow[3] = vec2(0.5, 0.5); M_edge[3] = 0.6; M_specular[3] = 0.95; M_paper[3] = vec2(0.2, 0.4);

    // 4 WATER
    M_color[4]   = vec3(0.494, 0.659, 0.812);
    M_dark[4]    = vec3(0.302, 0.482, 0.627);
    M_lshadow[4] = vec3(0.910, 0.941, 0.973);
    M_dshadow[4] = vec3(0.302, 0.482, 0.627) * 0.6;
    M_alpha[4] = 0.55; M_shadowAlpha[4] = 0.30;
    M_flow[4] = vec2(0.4, 0.55); M_edge[4] = 0.7; M_specular[4] = 0.99; M_paper[4] = vec2(0.15, 0.3);

    // 5 BANK
    M_color[5]   = vec3(0.722, 0.663, 0.471);
    M_dark[5]    = vec3(0.620, 0.651, 0.424);
    M_lshadow[5] = vec3(0.722, 0.663, 0.471) * 0.7;
    M_dshadow[5] = vec3(0.620, 0.651, 0.424) * 0.55;
    M_alpha[5] = 0.45; M_shadowAlpha[5] = 0.30;
    M_flow[5] = vec2(0.5, 0.5); M_edge[5] = 0.4; M_specular[5] = 0.8; M_paper[5] = vec2(0.2, 0.4);

    // 6 BIRCH — pale silvery trunk with dark grain
    M_color[6]   = vec3(0.882, 0.851, 0.776);
    M_dark[6]    = vec3(0.298, 0.255, 0.220);
    M_lshadow[6] = vec3(0.882, 0.851, 0.776) * 0.78;
    M_dshadow[6] = vec3(0.298, 0.255, 0.220) * 0.55;
    M_alpha[6] = 0.55; M_shadowAlpha[6] = 0.50;
    M_flow[6] = vec2(0.5, 0.22); M_edge[6] = 0.40; M_specular[6] = 0.88; M_paper[6] = vec2(0.3, 0.55);
  }

  // Smaller blur kernel than McfGW2's 11x11 (=121 taps) to keep mobile FPS up.
  // 7x7 = 49 taps, still wide enough for visible wet-edge bleed at 1080p.
  float normpdf(float x, float s) {
    return 0.39894 * exp(-0.5 * x * x / (s * s)) / s;
  }
  vec4 calculateBlurredShape(float matID, vec2 uv, float k_s) {
    const int mSize = 3;
    const int kSize = 1;
    float kernel[3];
    vec4 blurred = vec4(0.0);
    float sigma = 0.008 * iResolution.x;
    float Z = 0.0;
    for (int j = 0; j <= kSize; ++j) {
      float v = normpdf(float(j), sigma);
      kernel[kSize + j] = v;
      kernel[kSize - j] = v;
    }
    for (int j = 0; j < mSize; ++j) Z += kernel[j];
    for (int i = -kSize; i <= kSize; ++i) {
      for (int j = -kSize; j <= kSize; ++j) {
        vec2 duv = vec2(float(i), float(j)) / iResolution;
        vec4 s = texture2D(tBufferA, uv + duv);
        // Decode matID from 0..1 byte storage back to 0..255 float.
        float sid = s.x * 255.0;
        s.x = (abs(sid - matID) < 0.5) ? (1.0 - step(k_s, s.z)) : 0.0;
        blurred += kernel[kSize + j] * kernel[kSize + i] * s;
      }
    }
    return blurred / (Z * Z);
  }

  vec3 procPaper(vec2 uv) {
    // Stand-in for the original iChannel1 paper texture — fbm gives a
    // similar low-frequency luminance variation.
    float v = fbm(uv * 14.0) * 0.7 + fbm(uv * 38.0) * 0.3;
    return vec3(v);
  }

  void paintLayer(inout vec4 color, vec2 uv, float layerMatId) {
    int idx = int(layerMatId + 0.5);
    vec4 blurred = calculateBlurredShape(layerMatId, uv, M_specular[idx]);
    float shape = blurred.x;
    vec3 paper = procPaper(uv * 2.0);
    float paper_T = (2.0 * (paper.x + paper.y + paper.z) / 3.0 - 1.0) * step(0.03, shape);
    shape += M_paper[idx].y * paper_T;

    // Light layer
    vec4 layer = vec4(mix(M_dark[idx], M_color[idx], blurred.y), M_alpha[idx]);
    // Water-only inner-color ripple — modulates the highlight band along
    // a diagonal so it reads as gentle current. Silhouette stays fixed
    // because alpha/shape are unchanged; only inner RGB shifts. Crossfade
    // of two phase-shifted bands prevents temporal banding artifacts.
    // Water ripple disabled while diagnosing global "breathing" — restore
    // once root cause confirmed.
    // if (layerMatId > 3.5 && layerMatId < 4.5) { ... }
    layer.a *= smoothstep(M_flow[idx].x - M_flow[idx].y, M_flow[idx].x + M_flow[idx].y, shape);
    layer.a *= (1.0 + M_edge[idx] * (1.0 - shape));
    layer.a = clamp(layer.a + M_paper[idx].x * paper_T, 0.0, 1.0);
    color.rgb = mix(color.rgb, layer.rgb, layer.a);

    // Shadow layer
    layer = vec4(mix(M_dshadow[idx], M_lshadow[idx], blurred.y), M_shadowAlpha[idx]);
    layer.a *= smoothstep(0.3, 0.7, 1.0 - blurred.w);
    layer.a *= smoothstep(M_flow[idx].x - M_flow[idx].y, M_flow[idx].x + M_flow[idx].y, shape);
    layer.a *= (1.0 + M_edge[idx] * (1.0 - shape));
    layer.a = clamp(layer.a + M_paper[idx].x * paper_T, 0.0, 1.0);
    color.rgb = mix(color.rgb, layer.rgb, layer.a);
  }

  void main() {
    initMaterials();
    vec2 uv = gl_FragCoord.xy / iResolution;

    vec2 buv = uv;

    vec4 color = vec4(0.957, 0.922, 0.851, 1.0); // cream paper base
    paintLayer(color, buv, MAT_SKY);
    paintLayer(color, buv, MAT_GROUND);
    paintLayer(color, buv, MAT_BANK);
    paintLayer(color, buv, MAT_WATER);
    paintLayer(color, buv, MAT_TRUNK);
    paintLayer(color, buv, MAT_BIRCH);
    paintLayer(color, buv, MAT_FOLIAGE);
    gl_FragColor = color;
  }
`

const VERT = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`

export default function ShaderLandscape() {
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera)

  const { paused } = useControls('Shader Landscape', {
    paused: { value: false, label: 'pause' },
  })

  const prevState = useRef({ m: new Float32Array(16), fov: -1, dirty: true })

  const setup = useMemo(() => {
    const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const planeGeo = new THREE.PlaneGeometry(2, 2)

    const bufferATarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      // matID, diffuse, specular, shadow all fit in 8 bits — UnsignedByte
      // is widely supported and avoids float-RT compatibility issues that
      // showed up at large viewport sizes.
      type: THREE.UnsignedByteType,
    })

    const bufferAMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: BUFFER_A_FRAG,
      uniforms: {
        iResolution: { value: new THREE.Vector2(1, 1) },
        iTime: { value: 0 },
        uCamPos: { value: new THREE.Vector3() },
        uCamMat: { value: new THREE.Matrix3() },
        uFocal: { value: 1.5 },
      },
    })
    const imageMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: IMAGE_FRAG,
      uniforms: {
        iResolution: { value: new THREE.Vector2(1, 1) },
        iTime: { value: 0 },
        tBufferA: { value: bufferATarget.texture },
      },
    })

    const bufferAScene = new THREE.Scene()
    bufferAScene.add(new THREE.Mesh(planeGeo, bufferAMat))
    const imageScene = new THREE.Scene()
    imageScene.add(new THREE.Mesh(planeGeo, imageMat))

    return { orthoCam, bufferATarget, bufferAMat, imageMat, bufferAScene, imageScene }
  }, [])

  // Resize render target + uniforms when the canvas size changes.
  useEffect(() => {
    // Cap DPR aggressively — the 5×5 blur runs once per material per pixel,
    // so doubling resolution doubles the cost of the most expensive stage.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.0)
    // Hard cap the buffer's longer side. The watercolor blur smooths out
    // visible aliasing below ~960, so going from 1280 → 960 cuts the
    // expensive raymarch + 5x5 blur pixel count by ~44% with negligible
    // visual cost.
    const MAX_DIM = 900
    const rawW = size.width * dpr
    const rawH = size.height * dpr
    const scale = Math.min(1, MAX_DIM / Math.max(rawW, rawH))
    const w = Math.max(1, Math.floor(rawW * scale))
    const h = Math.max(1, Math.floor(rawH * scale))
    setup.bufferATarget.setSize(w, h)
    setup.bufferAMat.uniforms.iResolution.value.set(w, h)
    setup.imageMat.uniforms.iResolution.value.set(w, h)
    if (prevState.current) prevState.current.dirty = true
  }, [size, setup])

  useEffect(() => {
    return () => {
      setup.bufferATarget.dispose()
      setup.bufferAMat.dispose()
      setup.imageMat.dispose()
    }
  }, [setup])

  // Priority 1 useFrame disables R3F's auto-render so we drive both passes manually.
  // Skip rendering when camera + FOV haven't changed — keeping the canvas
  // surface untouched stops the cards' backdrop-filter from re-running
  // every frame (suspected cause of the "whole image breathing").
  useFrame((state) => {
    // Sync R3F camera (driven by PathWalker / OrbitControls) to the shader.
    camera.updateMatrixWorld()
    const m = camera.matrixWorld.elements
    setup.bufferAMat.uniforms.uCamMat.value.set(
      m[0], m[4], m[8],
      m[1], m[5], m[9],
      m[2], m[6], m[10]
    )
    const fwdX = -m[8], fwdY = -m[9], fwdZ = -m[10]
    const PULLBACK = 1.2
    setup.bufferAMat.uniforms.uCamPos.value.set(
      camera.position.x - fwdX * PULLBACK,
      camera.position.y - fwdY * PULLBACK,
      camera.position.z - fwdZ * PULLBACK
    )
    setup.bufferAMat.uniforms.uFocal.value =
      1 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)

    let dirty = prevState.current.dirty
    if (!dirty) {
      for (let i = 0; i < 16; i++) {
        if (prevState.current.m[i] !== m[i]) { dirty = true; break }
      }
    }
    if (!dirty && prevState.current.fov !== camera.fov) dirty = true

    if (typeof window !== 'undefined') {
      if (window.__skipCount === undefined) {
        window.__skipCount = 0
        window.__renderCount = 0
      }
    }

    if (!dirty) {
      if (typeof window !== 'undefined') window.__skipCount++
      return
    }

    for (let i = 0; i < 16; i++) prevState.current.m[i] = m[i]
    prevState.current.fov = camera.fov
    prevState.current.dirty = false

    if (typeof window !== 'undefined') window.__renderCount++

    gl.setRenderTarget(setup.bufferATarget)
    gl.render(setup.bufferAScene, setup.orthoCam)
    gl.setRenderTarget(null)
    gl.render(setup.imageScene, setup.orthoCam)
  }, 1)

  return null
}
