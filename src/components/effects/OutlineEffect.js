import { Effect, EffectAttribute, BlendFunction } from 'postprocessing'
import { Uniform, Color } from 'three'
import { wrapEffect } from '@react-three/postprocessing'

// Depth-based silhouette outline — Sobel kernel on the scene depth buffer
// produces a dark stroke around object boundaries. Combined with the
// watercolor effect this gives the "drawn-then-painted" grease-pencil
// quality.
const fragmentShader = /* glsl */ `
  uniform float uThickness;
  uniform float uDepthThreshold;
  uniform vec3 uColor;
  uniform float uIntensity;

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    vec2 texel = uThickness / resolution;

    // 4 corner samples for a cheap Sobel-style depth gradient
    float dNW = readDepth(uv + vec2(-texel.x,  texel.y));
    float dNE = readDepth(uv + vec2( texel.x,  texel.y));
    float dSW = readDepth(uv + vec2(-texel.x, -texel.y));
    float dSE = readDepth(uv + vec2( texel.x, -texel.y));

    float gx = (dNE + dSE) - (dNW + dSW);
    float gy = (dNW + dNE) - (dSW + dSE);
    float edgeMag = sqrt(gx * gx + gy * gy);

    // perspective division means depth gradients near the far plane are
    // tiny; scale up so the threshold has a usable range
    float edge = smoothstep(uDepthThreshold, uDepthThreshold * 4.0, edgeMag * 100.0);

    vec3 color = mix(inputColor.rgb, uColor, edge * uIntensity);
    outputColor = vec4(color, inputColor.a);
  }
`

class OutlineEffectImpl extends Effect {
  constructor({
    thickness = 1.2,
    depthThreshold = 0.04,
    color = new Color('#3a2818'),
    intensity = 0.9,
  } = {}) {
    super('OutlineEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map([
        ['uThickness', new Uniform(thickness)],
        ['uDepthThreshold', new Uniform(depthThreshold)],
        ['uColor', new Uniform(color)],
        ['uIntensity', new Uniform(intensity)],
      ]),
    })
  }
}

export const Outline = wrapEffect(OutlineEffectImpl)
