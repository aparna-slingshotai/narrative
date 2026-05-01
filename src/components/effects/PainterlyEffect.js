import { Effect, BlendFunction } from 'postprocessing'
import { Uniform } from 'three'
import { wrapEffect } from '@react-three/postprocessing'
import { forwardRef } from 'react'

// Custom painterly post-effect: brush-stroke smear + posterize + grain +
// edge bleed. Slots into <EffectComposer> via the wrapEffect helper.
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uStrokeStrength;
  uniform float uStrokeScale;
  uniform float uPosterize;
  uniform float uGrainAmount;
  uniform float uEdgeBleed;

  // tiny hash + smooth noise
  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 base = inputColor.rgb;

    // ---- 1. brush smear ----
    // Per-fragment direction from a low-frequency noise field; sample 5 taps
    // along that direction and average. Strength 0 = no smear, 1 = full.
    vec2 grid = uv * uStrokeScale;
    float angle = vnoise(grid) * 6.2831853;
    vec2 dir = vec2(cos(angle), sin(angle));
    vec2 step = dir * (1.0 / max(resolution.x, resolution.y)) * 1.6;

    vec3 smeared = base;
    if (uStrokeStrength > 0.001) {
      vec3 sum = base;
      sum += texture2D(inputBuffer, uv + step).rgb;
      sum += texture2D(inputBuffer, uv - step).rgb;
      sum += texture2D(inputBuffer, uv + step * 2.0).rgb;
      sum += texture2D(inputBuffer, uv - step * 2.0).rgb;
      smeared = sum / 5.0;
    }
    vec3 color = mix(base, smeared, uStrokeStrength);

    // ---- 2. edge bleed ----
    // Sample a 1-pixel cross; large luminance spread = edge → desaturate
    // slightly toward the local mean. Soft hand-painted edge.
    if (uEdgeBleed > 0.001) {
      vec2 px = 1.0 / resolution;
      vec3 cN = texture2D(inputBuffer, uv + vec2(0.0, px.y)).rgb;
      vec3 cS = texture2D(inputBuffer, uv - vec2(0.0, px.y)).rgb;
      vec3 cE = texture2D(inputBuffer, uv + vec2(px.x, 0.0)).rgb;
      vec3 cW = texture2D(inputBuffer, uv - vec2(px.x, 0.0)).rgb;
      vec3 mn = min(min(cN, cS), min(cE, cW));
      vec3 mx = max(max(cN, cS), max(cE, cW));
      float spread = length(mx - mn);
      vec3 mean = (cN + cS + cE + cW) * 0.25;
      color = mix(color, mean, clamp(spread * uEdgeBleed, 0.0, 0.6));
    }

    // ---- 3. posterize with ordered dither ----
    // Quantize each channel to N levels; tiny dither pattern softens banding.
    if (uPosterize > 0.5) {
      float bayer = mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) * 0.5 - 0.25;
      vec3 dither = vec3(bayer / uPosterize);
      color = floor(color * uPosterize + dither + 0.5) / uPosterize;
    }

    // ---- 4. paper grain (in-shader, per-fragment) ----
    if (uGrainAmount > 0.001) {
      float grain = (hash21(floor(gl_FragCoord.xy)) - 0.5) * uGrainAmount;
      color += grain;
    }

    outputColor = vec4(color, inputColor.a);
  }
`

class PainterlyEffectImpl extends Effect {
  constructor({
    strokeStrength = 0.55,
    strokeScale = 220,
    posterize = 14,
    grainAmount = 0.06,
    edgeBleed = 0.6,
  } = {}) {
    super('PainterlyEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ['uTime', new Uniform(0)],
        ['uStrokeStrength', new Uniform(strokeStrength)],
        ['uStrokeScale', new Uniform(strokeScale)],
        ['uPosterize', new Uniform(posterize)],
        ['uGrainAmount', new Uniform(grainAmount)],
        ['uEdgeBleed', new Uniform(edgeBleed)],
      ]),
    })
  }

  update(_renderer, _inputBuffer, deltaTime) {
    const u = this.uniforms.get('uTime')
    if (u) u.value += deltaTime
  }
}

export const Painterly = wrapEffect(PainterlyEffectImpl)
