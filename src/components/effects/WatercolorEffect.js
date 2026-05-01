import { Effect, EffectAttribute, BlendFunction } from 'postprocessing'
import { Uniform } from 'three'
import { wrapEffect } from '@react-three/postprocessing'

// Screen-space adaptation of @serioux666's watercolor compositor:
//   https://www.shadertoy.com/  POC Watercolor (CC BY-NC-SA 4.0)
//
// We don't have a per-pixel material ID buffer, so the "shape" mask is
// derived from luminance + depth gradient instead of from per-material
// blur. The visual hallmarks survive: gaussian wet-edge blur, paper
// modulation tied to shape, edge pigment pooling, two-tone shadow.
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uBlurRadius;
  uniform float uPaperGrain;
  uniform float uEdgeIntensity;
  uniform float uShadowStrength;
  uniform float uShapeThreshold;

  // hash + value noise for the procedural paper texture
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
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.05; a *= 0.5; }
    return v;
  }

  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  // 5-tap gaussian-ish blur of luminance — single pass approximation of
  // the user's separable 11-tap calculateBlurredShape. Returns an
  // estimated "shape density" (0..1 where 1 means dense painted area).
  float blurredShape(vec2 uv, vec2 texel) {
    float r = uBlurRadius;
    float c0 = luma(texture2D(inputBuffer, uv).rgb);
    float c1 = luma(texture2D(inputBuffer, uv + texel * r).rgb);
    float c2 = luma(texture2D(inputBuffer, uv - texel * r).rgb);
    float c3 = luma(texture2D(inputBuffer, uv + vec2(texel.y, -texel.x) * r).rgb);
    float c4 = luma(texture2D(inputBuffer, uv - vec2(texel.y, -texel.x) * r).rgb);
    return (c0 * 2.0 + c1 + c2 + c3 + c4) / 6.0;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    vec3 base = inputColor.rgb;
    vec2 texel = 1.0 / resolution;

    // shape: blurred luminance, used as the "is there paint here" proxy
    float shape = blurredShape(uv, texel);

    // paper texture (procedural fbm) — only modulates where shape exists
    float paper = fbm(uv * 8.0 + uTime * 0.01) * 0.7 + fbm(uv * 24.0) * 0.3;
    float paperT = (paper * 2.0 - 1.0) * step(uShapeThreshold, shape) * uPaperGrain;

    vec3 color = base;

    // depth-gradient edge mask (samples are pre-multiplied depth values
    // from postprocessing's automatic depth buffer)
    float dC = depth;
    float dN = readDepth(uv + vec2(0.0, texel.y));
    float dS = readDepth(uv - vec2(0.0, texel.y));
    float dE = readDepth(uv + vec2(texel.x, 0.0));
    float dW = readDepth(uv - vec2(texel.x, 0.0));
    float dx = dE - dW;
    float dy = dN - dS;
    float edgeMag = clamp(sqrt(dx * dx + dy * dy) * 100.0, 0.0, 1.0);

    // wet-edge pigment pooling: darken where the blurred shape is dim
    // AND we are near a depth edge — the user's
    //   layer.a *= (1 + edge * (1 - shape))
    // adapted to color rather than alpha.
    float pool = edgeMag * (1.0 - shape) * uEdgeIntensity;
    color *= 1.0 - pool * 0.55;

    // paper modulation: alpha-like grain that darkens painted areas
    color *= 1.0 + paperT * 0.6;

    // shadow layer: a darker version of the color shows in shadowed
    // regions. We use shape (low = thinner pigment) as a stand-in for
    // the user's diffuse buffer.
    float shadow = (1.0 - shape) * 0.6 + edgeMag * 0.4;
    vec3 shadowed = color * 0.6;
    color = mix(color, shadowed, clamp(shadow * uShadowStrength, 0.0, 1.0));

    outputColor = vec4(color, inputColor.a);
  }
`

class WatercolorEffectImpl extends Effect {
  constructor({
    blurRadius = 1.6,
    paperGrain = 0.45,
    edgeIntensity = 0.8,
    shadowStrength = 0.25,
    shapeThreshold = 0.05,
  } = {}) {
    super('WatercolorEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map([
        ['uTime', new Uniform(0)],
        ['uBlurRadius', new Uniform(blurRadius)],
        ['uPaperGrain', new Uniform(paperGrain)],
        ['uEdgeIntensity', new Uniform(edgeIntensity)],
        ['uShadowStrength', new Uniform(shadowStrength)],
        ['uShapeThreshold', new Uniform(shapeThreshold)],
      ]),
    })
  }

  update(_renderer, _inputBuffer, deltaTime) {
    const u = this.uniforms.get('uTime')
    if (u) u.value += deltaTime
  }
}

export const Watercolor = wrapEffect(WatercolorEffectImpl)
