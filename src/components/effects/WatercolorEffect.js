import { Effect, EffectAttribute, BlendFunction } from 'postprocessing'
import {
  Uniform,
  Color,
  ShaderMaterial,
  WebGLRenderTarget,
  NearestFilter,
  DoubleSide,
} from 'three'
import { wrapEffect } from '@react-three/postprocessing'

// Vertex/fragment for the override material that renders each mesh as a
// flat color encoding its userData.materialId in the red channel
// (id/255). Per-object uniform is updated via material.onBeforeRender.
const idVertexShader = /* glsl */ `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const idFragmentShader = /* glsl */ `
  uniform float uMatId;
  void main() {
    gl_FragColor = vec4(uMatId / 255.0, 0.0, 0.0, 1.0);
  }
`

// Faithful adaptation of @serioux666's POC Watercolor compositor
// (Shadertoy McfGW2-adjacent). The original deferred renderer wrote
// per-pixel material IDs + diffuse + shadow into Buffer A; we replicate
// that by rendering the scene a second time with an override material
// that emits each mesh's userData.materialId into a side buffer
// (this.idTarget), then read it here.
//
// Key technique kept from the original:
//   1. calculateBlurredShape — per-material density in the neighborhood
//      drives where paint is dense vs thin.
//   2. paper_T = (paper*2-1) * step(threshold, shape) — paper grain only
//      affects painted areas.
//   3. Two-layer paint (light + shadow) mixed by depth-edge + thin-shape.
//   4. Wet-edge pigment pooling proportional to edge*(1-shape).
//
// Refinements borrowed from McfGW2 (per user request):
//   - Domain-warp UV with animated noise → wobbly wet edges.
//   - pow(noise, 2) for non-linear intensity falloff.
//   - Cream paper base color #fadcd1-ish where no material is present.
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uBlurRadius;
  uniform float uPaperGrain;
  uniform float uEdgeIntensity;
  uniform float uShadowStrength;
  uniform float uShapeThreshold;
  uniform float uWobble;
  uniform vec3 uPaperColor;
  uniform sampler2D uIdBuffer;

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

  // material-ID equality with float-quantization tolerance
  float idMatch(float a, float b) {
    return step(abs(a - b), 0.5);
  }

  // 13-tap inline approximation of @serioux666's calculateBlurredShape.
  // Original is separable 11+11; we collapse to a single 13-tap Gaussian
  // arrangement to avoid ping-pong render targets. Each tap counts 1 if
  // its material ID matches the center pixel's. Returns 0..1 density of
  // "this material" in the local neighborhood.
  float calculateBlurredShape(vec2 uv, vec2 texel, float matId) {
    vec2 r = texel * uBlurRadius * 4.0;
    float sum = 0.0;
    float wsum = 0.0;

    const int N = 13;
    vec2 offs[N];
    offs[0]  = vec2( 0.0,  0.0);
    offs[1]  = vec2( 1.0,  0.0);
    offs[2]  = vec2(-1.0,  0.0);
    offs[3]  = vec2( 0.0,  1.0);
    offs[4]  = vec2( 0.0, -1.0);
    offs[5]  = vec2( 0.7,  0.7);
    offs[6]  = vec2(-0.7,  0.7);
    offs[7]  = vec2( 0.7, -0.7);
    offs[8]  = vec2(-0.7, -0.7);
    offs[9]  = vec2( 2.0,  0.0);
    offs[10] = vec2(-2.0,  0.0);
    offs[11] = vec2( 0.0,  2.0);
    offs[12] = vec2( 0.0, -2.0);
    float ws[N];
    ws[0] = 1.00;
    ws[1] = 0.85; ws[2] = 0.85; ws[3] = 0.85; ws[4] = 0.85;
    ws[5] = 0.65; ws[6] = 0.65; ws[7] = 0.65; ws[8] = 0.65;
    ws[9] = 0.40; ws[10] = 0.40; ws[11] = 0.40; ws[12] = 0.40;

    for (int i = 0; i < N; i++) {
      float id = texture2D(uIdBuffer, uv + offs[i] * r).r * 255.0;
      sum += ws[i] * idMatch(id, matId);
      wsum += ws[i];
    }
    return sum / wsum;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    vec3 base = inputColor.rgb;
    vec2 texel = 1.0 / resolution;

    // McfGW2-style domain warp: shift the lookup UV by a low-amplitude
    // animated noise so material boundaries have a wet, wobbly feel
    // instead of geometric pixel-edges.
    vec2 wobbleVec = vec2(
      fbm(uv * 12.0 + uTime * 0.05),
      fbm(uv * 12.0 - uTime * 0.05 + 13.0)
    ) - 0.5;
    vec2 wobbleUv = uv + wobbleVec * uWobble * texel * 12.0;

    // material at the (wobbled) center pixel
    float matId = texture2D(uIdBuffer, wobbleUv).r * 255.0;
    float isPaper = step(matId, 0.5); // id==0 → background

    // density of "this material" in the neighborhood
    float shape = calculateBlurredShape(wobbleUv, texel, matId);

    // depth-gradient edge mask (edge_strength in original)
    float dN = readDepth(uv + vec2(0.0, texel.y));
    float dS = readDepth(uv - vec2(0.0, texel.y));
    float dE = readDepth(uv + vec2(texel.x, 0.0));
    float dW = readDepth(uv - vec2(texel.x, 0.0));
    float edgeMag = clamp(
      sqrt((dE - dW)*(dE - dW) + (dN - dS)*(dN - dS)) * 100.0,
      0.0, 1.0
    );

    // procedural paper noise (subtle motion). swap for texture(uPaper,...)
    // if a paper asset gets dropped at public/textures/paper.png.
    float paper = fbm(uv * 8.0 + uTime * 0.02) * 0.7 + fbm(uv * 24.0) * 0.3;
    float paperT = (paper * 2.0 - 1.0) * step(uShapeThreshold, shape);

    // light layer = scene color (acts as the diffuse channel of the
    // original two-layer composite). shadow layer = darker tinted.
    vec3 light = base;
    vec3 shadowed = base * 0.55;
    float shadowFactor = clamp((1.0 - shape) * 0.6 + edgeMag * 0.4, 0.0, 1.0);

    // wet-edge pigment pooling. Original is on alpha:
    //   layer.a *= 1 + edge*(1 - shape)
    // Adapted to RGB darkening with pow(.,2) falloff (McfGW2).
    float pool = pow(edgeMag * (1.0 - shape), 2.0) * uEdgeIntensity;

    // composite: light → shadow blend → paper modulation → edge pooling
    vec3 color = mix(light, shadowed, shadowFactor * uShadowStrength);
    color *= 1.0 + paperT * uPaperGrain * 0.6;
    color *= 1.0 - pool * 0.55;

    // dissolve into paper where painted shape is too thin (the
    // step(threshold, shape) gate of the original, softened)
    float painted = smoothstep(0.0, uShapeThreshold * 4.0, shape);
    color = mix(uPaperColor, color, painted);

    // pixels with no material get pure paper + faint grain
    vec3 paperWithGrain = uPaperColor + vec3(paper - 0.5) * 0.06;
    color = mix(color, paperWithGrain, isPaper);

    outputColor = vec4(color, inputColor.a);
  }
`

class WatercolorEffectImpl extends Effect {
  constructor({
    scene = null,
    camera = null,
    blurRadius = 1.6,
    paperGrain = 0.45,
    edgeIntensity = 0.8,
    shadowStrength = 0.25,
    shapeThreshold = 0.05,
    wobble = 0.6,
    paperColor = '#fae8d0',
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
        ['uWobble', new Uniform(wobble)],
        ['uPaperColor', new Uniform(new Color(paperColor))],
        ['uIdBuffer', new Uniform(null)],
      ]),
    })

    this.scene = scene
    this.camera = camera

    // off-screen RT for material IDs. Nearest filtering so blurred-shape
    // ID compares aren't smudged by bilinear interpolation.
    this.idTarget = new WebGLRenderTarget(1, 1, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
    })
    this.idTarget.texture.name = 'WatercolorEffect.idBuffer'

    this.idMaterial = new ShaderMaterial({
      vertexShader: idVertexShader,
      fragmentShader: idFragmentShader,
      uniforms: { uMatId: { value: 0 } },
      side: DoubleSide,
    })
    // Per-object uniform: Three calls material.onBeforeRender(...) before
    // each draw, so we patch the uMatId from the object's userData here.
    this.idMaterial.onBeforeRender = function (_renderer, _s, _c, _g, object) {
      const id = (object && object.userData && object.userData.materialId) || 0
      this.uniforms.uMatId.value = id
      this.uniformsNeedUpdate = true
    }

    this.uniforms.get('uIdBuffer').value = this.idTarget.texture
  }

  setSize(width, height) {
    this.idTarget.setSize(width, height)
  }

  update(renderer, _inputBuffer, deltaTime) {
    const t = this.uniforms.get('uTime')
    if (t) t.value += deltaTime

    if (!this.scene || !this.camera) return

    const prevTarget = renderer.getRenderTarget()
    const prevAutoClear = renderer.autoClear
    const prevOverride = this.scene.overrideMaterial
    const prevBg = this.scene.background

    this.scene.overrideMaterial = this.idMaterial
    this.scene.background = null

    renderer.setRenderTarget(this.idTarget)
    renderer.autoClear = true
    renderer.setClearColor(0x000000, 1)
    renderer.clear(true, true, false)
    renderer.render(this.scene, this.camera)

    this.scene.overrideMaterial = prevOverride
    this.scene.background = prevBg
    renderer.autoClear = prevAutoClear
    renderer.setRenderTarget(prevTarget)
  }

  dispose() {
    if (this.idTarget) this.idTarget.dispose()
    if (this.idMaterial) this.idMaterial.dispose()
    super.dispose()
  }
}

export const Watercolor = wrapEffect(WatercolorEffectImpl)
