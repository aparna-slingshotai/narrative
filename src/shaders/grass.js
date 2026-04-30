export const grassVertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uTouchPos;
  uniform float uTouchActive;
  uniform float uTouchRadius;
  uniform float uTouchStrength;
  uniform float uWindSpeed;
  uniform float uWindAmplitude;

  attribute vec3 offset;
  attribute float scale;
  attribute float phase;

  varying float vHeight;
  varying float vAo;

  void main() {
    vec3 pos = position;
    float h = pos.y;
    vHeight = h;
    vAo = 1.0 - smoothstep(0.0, 0.3, h);

    // wind sway
    float t = uTime * uWindSpeed;
    float sway = sin(t + offset.x * 0.5 + phase) * uWindAmplitude * h;
    pos.x += sway;
    pos.z += sin(t * 0.8 + offset.z * 0.3 + phase * 0.7) * uWindAmplitude * 0.5 * h;

    // touch bend — blades flatten away from touch point
    vec3 worldOff = offset;
    vec3 diff = worldOff - uTouchPos;
    float dist = length(diff.xz);
    float falloff = smoothstep(uTouchRadius, 0.0, dist);
    float touchStrength = uTouchActive * falloff * uTouchStrength;
    vec2 bendDir = normalize(diff.xz + 0.0001);
    pos.xz += bendDir * touchStrength * h * 1.5;
    pos.y -= touchStrength * h * 0.4;

    pos *= scale;
    pos += offset;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

export const grassFragmentShader = /* glsl */ `
  varying float vHeight;
  varying float vAo;

  void main() {
    vec3 tipColor = vec3(0.35, 0.65, 0.22);
    vec3 baseColor = vec3(0.12, 0.28, 0.08);
    vec3 color = mix(baseColor, tipColor, vHeight);
    color *= (0.6 + 0.4 * vAo);
    gl_FragColor = vec4(color, 1.0);
  }
`
