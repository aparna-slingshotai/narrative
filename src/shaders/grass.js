export const TRAIL_SIZE = 16
export const MAX_RIVER_POINTS = 16

export const grassVertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec4 uTrail[${TRAIL_SIZE}]; // xyz = world pos, w = age (sec)
  uniform float uTouchRadius;
  uniform float uTouchStrength;
  uniform float uWindSpeed;
  uniform float uWindAmplitude;

  // Camera-following grass field — blades wrap around the camera so the
  // visible area always has dense coverage with no extra blades wasted
  // outside the frustum.
  uniform vec2 uFieldOffset;   // camera XZ projected to ground
  uniform vec2 uFieldSize;     // tile size (world units, x and z)

  // River exclusion — discard blades that wrap into the water channel.
  uniform vec3 uRiverPoints[${MAX_RIVER_POINTS}];
  uniform int uRiverPointsCount;
  uniform float uRiverExclusionRadius;

  attribute vec3 offset;
  attribute float heightScale;
  attribute float widthScale;
  attribute float phase;
  attribute float rotation;
  attribute float lean;
  attribute float tint;

  varying float vHeight;
  varying float vAo;
  varying float vTint;
  varying float vTouchInfluence;
  varying float vCameraDist;

  vec3 rotateY(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  }

  vec3 rotateX(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
  }

  // squared distance from point P to segment AB (XZ plane only)
  float distToSegmentSq(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b - a;
    float denom = max(dot(ab, ab), 1e-6);
    float t = clamp(dot(p - a, ab) / denom, 0.0, 1.0);
    vec2 closest = a + t * ab;
    vec2 d = p - closest;
    return dot(d, d);
  }

  void main() {
    float h = uv.y;
    vec3 pos = position;

    // Wrap the per-instance offset around the camera. Result is a fresh
    // world-space XZ position that stays within ±fieldSize/2 of camera.
    vec2 wrappedXZ = mod(offset.xz - uFieldOffset + uFieldSize * 0.5, uFieldSize)
                   - uFieldSize * 0.5 + uFieldOffset;

    // River exclusion: collapse the blade if it wraps into the channel
    float riverDistSq = 1e9;
    for (int i = 0; i < ${MAX_RIVER_POINTS - 1}; i++) {
      if (i + 1 >= uRiverPointsCount) break;
      vec3 a = uRiverPoints[i];
      vec3 b = uRiverPoints[i + 1];
      riverDistSq = min(riverDistSq, distToSegmentSq(wrappedXZ, a.xz, b.xz));
    }
    float effHeight = heightScale;
    float effWidth = widthScale;
    if (riverDistSq < uRiverExclusionRadius * uRiverExclusionRadius) {
      effHeight = 0.0;
      effWidth = 0.0;
    }

    // non-uniform scale: width independent of height
    pos.x *= effWidth;
    pos.y *= effHeight;
    pos.z *= effWidth;

    // wind sway, increases with height (cubic so tip moves most)
    float t = uTime * uWindSpeed;
    float windPhase = t + offset.x * 0.4 + offset.z * 0.25 + phase;
    vec2 windDir = vec2(sin(windPhase), cos(windPhase * 0.8));
    float windCurve = h * h * h;
    pos.x += windDir.x * uWindAmplitude * windCurve * effHeight;
    pos.z += windDir.y * uWindAmplitude * windCurve * 0.6 * effHeight;

    // accumulate touch bend from trail (uses wrapped world position)
    vec2 totalBend = vec2(0.0);
    float totalForce = 0.0;
    float maxFalloff = 0.0;
    for (int i = 0; i < ${TRAIL_SIZE}; i++) {
      vec4 t4 = uTrail[i];
      float ageWeight = exp(-t4.w * 1.8);
      if (ageWeight < 0.01) continue;
      vec2 diffXZ = wrappedXZ - vec2(t4.x, t4.z);
      float dist = length(diffXZ);
      float falloff = smoothstep(uTouchRadius, 0.0, dist);
      float f = falloff * ageWeight;
      vec2 dir = normalize(diffXZ + vec2(0.0001));
      totalBend += dir * f;
      totalForce += f;
      maxFalloff = max(maxFalloff, f);
    }
    float bendAmt = clamp(totalForce * uTouchStrength, 0.0, 1.0);
    vec2 bendDir = length(totalBend) > 0.0001 ? normalize(totalBend) : vec2(0.0);
    pos.xz += bendDir * bendAmt * windCurve * 0.5 * effHeight;
    vTouchInfluence = maxFalloff;

    // per-blade lean + rotation
    pos = rotateX(pos, lean * h);
    pos = rotateY(pos, rotation);

    // place at wrapped position (instead of original offset)
    pos.x += wrappedXZ.x;
    pos.z += wrappedXZ.y;
    pos.y += offset.y;

    vHeight = h;
    vAo = smoothstep(0.0, 0.4, h);
    vTint = tint;
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vCameraDist = length(worldPos.xyz - cameraPosition);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

export const grassFragmentShader = /* glsl */ `
  uniform float uTouchHighlight;
  uniform vec3 uColorBase;
  uniform vec3 uColorMid;
  uniform vec3 uColorTip;
  uniform float uTintAmount;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

  varying float vHeight;
  varying float vAo;
  varying float vTint;
  varying float vTouchInfluence;
  varying float vCameraDist;

  void main() {
    vec3 color = mix(uColorBase, uColorMid, smoothstep(0.0, 0.55, vHeight));
    color = mix(color, uColorTip, smoothstep(0.55, 1.0, vHeight));

    color.r += vTint * 0.06 * uTintAmount;
    color.g += vTint * 0.04 * uTintAmount;
    color.b -= vTint * 0.05 * uTintAmount;

    color *= mix(0.7, 1.0, vAo);

    color += vec3(0.18, 0.22, 0.14) * vTouchInfluence * uTouchHighlight;

    float fogAmt = smoothstep(uFogNear, uFogFar, vCameraDist);
    color = mix(color, uFogColor, fogAmt);

    gl_FragColor = vec4(color, 1.0);
  }
`
