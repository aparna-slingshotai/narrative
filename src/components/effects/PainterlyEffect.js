import { Effect, BlendFunction } from 'postprocessing'
import { Uniform } from 'three'
import { wrapEffect } from '@react-three/postprocessing'

// Watercolor post-effect: smooth ring blur + wet-edge pigment pooling +
// pigment density variation + gentle posterize + paper grain. Slots
// into <EffectComposer> via the wrapEffect helper.
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uWashStrength;
  uniform float uWashRadius;
  uniform float uWetEdge;
  uniform float uPigment;
  uniform float uPosterize;
  uniform float uGrainAmount;

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

  // luminance for edge detection
  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 base = inputColor.rgb;

    // ---- 1. smooth wash: ring blur ----
    // 8 samples on a circle at uWashRadius pixels, averaged with the
    // center. Produces a smooth blur (no directional bias) that reads
    // as flowing watercolor rather than oil-paint strokes.
    vec3 wash = base;
    float radius = uWashRadius / max(resolution.x, resolution.y);
    if (uWashStrength > 0.001) {
      const float TAU = 6.2831853;
      vec3 sum = base;
      float count = 1.0;
      for (int i = 0; i < 8; i++) {
        float a = (float(i) / 8.0) * TAU;
        vec2 o = vec2(cos(a), sin(a)) * radius;
        sum += texture2D(inputBuffer, uv + o).rgb;
        count += 1.0;
      }
      // second smaller ring for fuller blur
      for (int i = 0; i < 8; i++) {
        float a = (float(i) / 8.0) * TAU + 0.39;
        vec2 o = vec2(cos(a), sin(a)) * radius * 0.55;
        sum += texture2D(inputBuffer, uv + o).rgb;
        count += 1.0;
      }
      wash = sum / count;
    }
    vec3 color = mix(base, wash, uWashStrength);

    // ---- 2. wet-edge pigment pooling ----
    // Sobel-lite: sample 4 neighbors, take luminance gradient, darken
    // proportional to gradient. Mimics watercolor's signature darker
    // rim where pigment pools at the boundary of a wash.
    if (uWetEdge > 0.001) {
      vec2 px = 1.0 / resolution * 1.5;
      float lN = luma(texture2D(inputBuffer, uv + vec2(0.0,  px.y)).rgb);
      float lS = luma(texture2D(inputBuffer, uv + vec2(0.0, -px.y)).rgb);
      float lE = luma(texture2D(inputBuffer, uv + vec2( px.x, 0.0)).rgb);
      float lW = luma(texture2D(inputBuffer, uv + vec2(-px.x, 0.0)).rgb);
      float gx = lE - lW;
      float gy = lN - lS;
      float edge = sqrt(gx * gx + gy * gy);
      // darken by an amount proportional to gradient. Cap so it doesn't
      // become a hard cartoon outline.
      float darken = clamp(edge * uWetEdge, 0.0, 0.4);
      color *= 1.0 - darken;
    }

    // ---- 3. pigment density variation ----
    // Low-frequency noise modulates a slight darken/lighten so washes
    // don't look uniform — mimics how pigment distributes unevenly
    // when wet paper dries.
    if (uPigment > 0.001) {
      float v = vnoise(gl_FragCoord.xy / 60.0);
      float v2 = vnoise(gl_FragCoord.xy / 18.0 + 4.7);
      float density = (v * 0.7 + v2 * 0.3) - 0.5; // -0.5..0.5
      color *= 1.0 + density * uPigment;
    }

    // ---- 4. gentle posterize with ordered dither ----
    if (uPosterize > 0.5) {
      float bayer = mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) * 0.5 - 0.25;
      vec3 dither = vec3(bayer / uPosterize);
      color = floor(color * uPosterize + dither + 0.5) / uPosterize;
    }

    // ---- 5. paper grain (in-shader) ----
    if (uGrainAmount > 0.001) {
      float grain = (hash21(floor(gl_FragCoord.xy)) - 0.5) * uGrainAmount;
      color += grain;
    }

    outputColor = vec4(color, inputColor.a);
  }
`

class PainterlyEffectImpl extends Effect {
  constructor({
    washStrength = 0.65,
    washRadius = 2.5,
    wetEdge = 1.4,
    pigment = 0.10,
    posterize = 18,
    grainAmount = 0.05,
  } = {}) {
    super('PainterlyEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ['uTime', new Uniform(0)],
        ['uWashStrength', new Uniform(washStrength)],
        ['uWashRadius', new Uniform(washRadius)],
        ['uWetEdge', new Uniform(wetEdge)],
        ['uPigment', new Uniform(pigment)],
        ['uPosterize', new Uniform(posterize)],
        ['uGrainAmount', new Uniform(grainAmount)],
      ]),
    })
  }

  update(_renderer, _inputBuffer, deltaTime) {
    const u = this.uniforms.get('uTime')
    if (u) u.value += deltaTime
  }
}

export const Painterly = wrapEffect(PainterlyEffectImpl)
