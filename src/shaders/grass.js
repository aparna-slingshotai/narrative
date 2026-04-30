export const TRAIL_SIZE = 16

export const grassVertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec4 uTrail[${TRAIL_SIZE}]; // xyz = world pos, w = age (sec)
  uniform float uTouchRadius;
  uniform float uTouchStrength;
  uniform float uWindSpeed;
  uniform float uWindAmplitude;

  attribute vec3 offset;
  attribute float scale;
  attribute float phase;
  attribute float rotation;
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

  void main() {
    float h = uv.y;
    vec3 pos = position;

    // wind sway
    float t = uTime * uWindSpeed;
    float windPhase = t + offset.x * 0.4 + offset.z * 0.25 + phase;
    vec2 windDir = vec2(sin(windPhase), cos(windPhase * 0.8));
    float windCurve = h * h * h;
    pos.x += windDir.x * uWindAmplitude * windCurve;
    pos.z += windDir.y * uWindAmplitude * windCurve * 0.6;

    // accumulate touch bend from trail
    vec2 totalBend = vec2(0.0);
    float totalForce = 0.0;
    float maxFalloff = 0.0;
    for (int i = 0; i < ${TRAIL_SIZE}; i++) {
      vec4 t4 = uTrail[i];
      float ageWeight = exp(-t4.w * 1.8);
      if (ageWeight < 0.01) continue;
      vec2 diffXZ = offset.xz - vec2(t4.x, t4.z);
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
    // gentler bend — half the multiplier of before, no y-pull
    pos.xz += bendDir * bendAmt * windCurve * 0.5;
    vTouchInfluence = maxFalloff;

    pos *= scale;
    pos = rotateY(pos, rotation);
    pos += offset;

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
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

  varying float vHeight;
  varying float vAo;
  varying float vTint;
  varying float vTouchInfluence;
  varying float vCameraDist;

  void main() {
    vec3 baseColor = vec3(0.16, 0.30, 0.10);
    vec3 midColor  = vec3(0.26, 0.42, 0.14);
    vec3 tipColor  = vec3(0.42, 0.58, 0.22);

    vec3 color = mix(baseColor, midColor, smoothstep(0.0, 0.55, vHeight));
    color = mix(color, tipColor, smoothstep(0.55, 1.0, vHeight));

    color.r += vTint * 0.025;
    color.g += vTint * 0.015;
    color.b -= vTint * 0.02;

    color *= mix(0.7, 1.0, vAo);

    color += vec3(0.18, 0.22, 0.14) * vTouchInfluence * uTouchHighlight;

    // distance fog so the grass field fades into the sky/horizon
    float fogAmt = smoothstep(uFogNear, uFogFar, vCameraDist);
    color = mix(color, uFogColor, fogAmt);

    gl_FragColor = vec4(color, 1.0);
  }
`
