// =============================================================================
// Watercolor Landscape — Shadertoy port of the narrative R3F scene
// =============================================================================
// Built on @serioux666's POC Watercolor (https://www.shadertoy.com/view/McfGW2)
// CC BY-NC-SA 4.0 — based on Luft & Deussen, "Real-Time Watercolor for Animation".
//
// Three tabs (paste each section into the matching Shadertoy tab):
//   * Common   — material IDs, scene constants (TREES, RIVER)
//   * Buffer A — SDF raymarcher, writes (matID, diffuse, specular, shadow)
//                  iChannel0: <unused>
//   * Image    — watercolor compositor reading Buffer A
//                  iChannel0: Buffer A
//                  iChannel1: paper texture (e.g. preset "Pebbles", filter: mipmap, wrap: repeat)
// =============================================================================


// =============================================================================
// === Common ===
// =============================================================================
const vec3  c  = vec3(1., 0., -1.);
const float pi = acos(-1.);

const float MAT_SKY     = 0.;
const float MAT_GROUND  = 1.;   // meadow / grass
const float MAT_TRUNK   = 2.;
const float MAT_FOLIAGE = 3.;
const float MAT_WATER   = 4.;
const float MAT_BANK    = 5.;

// Pine layout — (x, z, scale). Mirrors PineForest.jsx TREES array.
#define TREE_COUNT 7
const vec3 TREES[TREE_COUNT] = vec3[TREE_COUNT](
    vec3( 0.0,  -8.0, 1.30),
    vec3(-3.4,  -9.5, 0.95),
    vec3( 3.6, -10.0, 0.90),
    vec3(-1.6, -13.0, 0.75),
    vec3( 2.4, -13.5, 0.65),
    vec3(-4.7, -14.0, 0.55),
    vec3( 4.9, -14.5, 0.60)
);

// River centerline — copied from src/scene/river.js (xz only).
#define RIVER_COUNT 12
const vec2 RIVER[RIVER_COUNT] = vec2[RIVER_COUNT](
    vec2(-7.0,   6.0), vec2(-3.0,   3.2), vec2(-1.0,   0.5),
    vec2( 1.5,  -2.0), vec2( 0.5,  -3.5), vec2( 2.0,  -5.0),
    vec2( 3.5,  -6.5), vec2( 4.0,  -8.5), vec2( 2.0, -11.0),
    vec2(-0.5, -14.0), vec2(-3.5, -16.5), vec2(-6.0, -19.0)
);
const float RIVER_WIDTH = 1.5;
const float BANK_WIDTH  = 0.18;


// =============================================================================
// === Buffer A ===
// =============================================================================
// Raymarches the landscape SDF and writes per-pixel material data.
//   r = matID   g = diffuse   b = specular   a = shadow
// The Image pass reads this with the McfGW2 watercolor compositor.

const vec3 LIGHT_DIR = normalize(vec3(2.0, 1.0, -1.0));

// --- noise -------------------------------------------------------------------
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

// --- SDF primitives (iq) -----------------------------------------------------
float sdCappedCylinder(vec3 p, float r, float h) {
    vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
// vertical cone, apex at origin, opens downward along +Y; sc = (sin, cos) of half-angle
float sdCone(vec3 p, vec2 sc, float h) {
    vec2 q = vec2(length(p.xz), p.y);
    vec2 tip = q - vec2(0.0, h);
    vec2 base = vec2(q.x - clamp(q.x, 0.0, h * sc.x / sc.y), q.y);
    float d = max(dot(tip, vec2(sc.y, sc.x)), -p.y);
    float s = sign(max(-q.y * sc.x, q.x * sc.y - h * sc.x));
    return s * sqrt(min(dot(tip, tip), dot(base, base))) * sign(d);
}

// --- helpers -----------------------------------------------------------------
vec2 minSdf(vec2 d, float d_new, float mat_id) {
    if (d_new < d.x) return vec2(d_new, mat_id);
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

// Mirrors the vertex displacement in src/components/Ground.jsx.
float groundHeight(vec2 xz) {
    float backRise = smoothstep(-2.0, -22.0, xz.y) * 1.65;
    float roll = fbm(xz * 0.22) * 0.55;
    return backRise + roll;
}

// Single pine: thin trunk + drooping cone foliage.
vec2 sdPine(vec3 p, vec3 t) {
    vec3 q = vec3(p.x - t.x, p.y, p.z - t.y);
    float s = t.z;

    float trunkH = 4.5 * s;
    float trunkR = 0.04 * s;
    float trunk  = sdCappedCylinder(q - vec3(0, trunkH * 0.5, 0), trunkR, trunkH * 0.5);

    // Cone foliage: base near 0.18*trunkH, apex at trunkH; we model in cone-local
    // space by inverting Y so the apex is at +Y h.
    float foliageBaseY = 0.18 * trunkH;
    float foliageH     = trunkH - foliageBaseY;
    vec3 fp = vec3(q.x, q.y - foliageBaseY, q.z);
    // half-angle ~ atan(baseR / h); baseR ~ 1.1*s, h ~ foliageH
    float halfAng = atan(1.1 * s / foliageH);
    float foliage = sdCone(fp, vec2(sin(halfAng), cos(halfAng)), foliageH);

    if (trunk < foliage) return vec2(trunk, MAT_TRUNK);
    return vec2(foliage, MAT_FOLIAGE);
}

vec2 sdScene(vec3 p) {
    vec2 d = vec2(1e3, 0.);

    float gh = groundHeight(p.xz);

    float dr = distToRiverXZ(p.xz);
    float bankEdge = RIVER_WIDTH * 0.5 + BANK_WIDTH;
    float matGround;
    float surfaceY = gh;
    if (dr < RIVER_WIDTH * 0.5) {
        matGround = MAT_WATER;
        surfaceY = gh - 0.05;          // shallow channel
    } else if (dr < bankEdge) {
        matGround = MAT_BANK;
        surfaceY = gh - 0.02;
    } else {
        matGround = MAT_GROUND;
    }
    d = minSdf(d, p.y - surfaceY, matGround);

    for (int i = 0; i < TREE_COUNT; i++) {
        vec2 tree = sdPine(p, TREES[i]);
        if (tree.x < d.x) d = tree;
    }
    return d;
}

vec3 sceneNormal(vec3 p) {
    vec2 eps = vec2(0.01, 0.0);
    return normalize(vec3(
        sdScene(p + eps.xyy).x - sdScene(p - eps.xyy).x,
        sdScene(p + eps.yxy).x - sdScene(p - eps.yxy).x,
        sdScene(p + eps.yyx).x - sdScene(p - eps.yyx).x
    ));
}

float raycastScene(vec3 ro, vec3 rd, out float matID) {
    float t = 0.01;
    vec2 d = vec2(1e3, 0.);
    for (int i = 0; i < 96 && t < 80.; i++) {
        d = sdScene(ro + t * rd);
        if (d.x < t * 0.0008) break;
        t += d.x;
    }
    matID = d.y;
    return t >= 80. ? -1. : t;
}

float raycastShadow(vec3 ro, vec3 rd, float k) {
    float t = 0.05;
    float lightness = 1.0;
    for (int i = 0; i < 48 && t < 32.; ++i) {
        vec2 d = sdScene(ro + t * rd);
        lightness = min(lightness, max(0., k * d.x / t));
        if (d.x < 0.001) break;
        t += d.x;
    }
    return lightness;
}

vec4 renderScene(vec3 ro, vec3 rd) {
    float matID = MAT_SKY;
    float diffuse = 1.0, specular = 0.0, shadow = 1.0;
    float t = raycastScene(ro, rd, matID);
    if (t < 0.) {
        // sky — diffuse=1, no spec, no shadow
        return vec4(MAT_SKY, 1.0, 0.0, 1.0);
    }
    vec3 p = ro + t * rd;
    vec3 n = sceneNormal(p);
    diffuse = clamp(dot(LIGHT_DIR, n), 0., 1.);
    float shininess = 8.0;
    vec3  hv = normalize(-rd + LIGHT_DIR);
    specular = max(0., pow(max(dot(hv, n), 0.0), shininess));
    shadow = raycastShadow(p + n * 0.02, LIGHT_DIR, 4.0);
    return vec4(matID, diffuse, specular, shadow);
}

mat3 cameraTransform(vec3 pos, vec3 target, float roll) {
    vec3 cw = normalize(target - pos);
    vec3 up = vec3(sin(roll), cos(roll), 0.0);
    vec3 cu = normalize(cross(cw, up));
    vec3 cv = normalize(cross(cu, cw));
    return mat3(cu, cv, cw);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p  = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    // Camera matches App.jsx: position [0,3,7], fov 40° (focal = 1/tan(20°) ≈ 2.747).
    vec3 ro = vec3(0.0, 3.0, 7.0);
    vec3 ta = vec3(0.0, 1.2, 0.0);
    mat3 M  = cameraTransform(ro, ta, 0.0);
    float focal = 2.747;
    vec3 rd = normalize(M * vec3(p, focal));

    fragColor = renderScene(ro, rd);
}


// =============================================================================
// === Image ===
// =============================================================================
// McfGW2 watercolor compositor — paintLayer + calculateBlurredShape preserved
// nearly verbatim. Only the materials table and paint order change.

struct materialType {
    vec3 color;
    vec3 dark_color;
    vec3 light_shadow_color;
    vec3 dark_shadow_color;
    int  bands;
    float alpha;
    float shadow_alpha;
    vec2 flow;
    float edge;
    float specular;
    vec2 paper;
};

vec3 interpolateColors(vec3 a, vec3 b, float t) { return mix(a, b, t); }

// Palette seeded from the live Leva controls (App.jsx defaults):
//   sky paper #f4ebd9, sky scribble #9bb8d4
//   ground   #7c9648, dark #1f3d12
//   foliage  dark #3e6b3a, mid #7a9a4d, light #b8cf85
//   trunk    #9a6242
//   water    #7ea8cf, highlight #e8f0f8, shadow #4d7ba0
//   bank     #9ea66c, warm #b8a978
const materialType MATERIALS[6] = materialType[6](
    // 0 SKY — cream paper base, blue-gray scribble where shaded
    materialType(
        vec3(0.957, 0.922, 0.851),
        vec3(0.608, 0.722, 0.831),
        vec3(0.957, 0.922, 0.851) * 0.85,
        vec3(0.608, 0.722, 0.831) * 0.7,
        1, 0.0, 0.0, vec2(0.3, 0.6), 0.0, 0.0, vec2(0.0, 0.0)
    ),
    // 1 GROUND / GRASS — meadow green
    materialType(
        vec3(0.486, 0.588, 0.282),
        vec3(0.122, 0.239, 0.071),
        vec3(0.486, 0.588, 0.282) * 0.55,
        vec3(0.122, 0.239, 0.071) * 0.55,
        0, 0.45, 0.45, vec2(0.5, 0.5), 0.55, 0.7, vec2(0.2, 0.4)
    ),
    // 2 TRUNK — warm brown
    materialType(
        vec3(0.604, 0.384, 0.259),
        vec3(0.604, 0.384, 0.259) * 0.35,
        vec3(0.604, 0.384, 0.259) * 0.55,
        vec3(0.604, 0.384, 0.259) * 0.20,
        0, 0.55, 0.55, vec2(0.5, 0.18), 0.35, 0.9, vec2(0.3, 0.6)
    ),
    // 3 FOLIAGE — pine green w/ light tip + dark shadow
    materialType(
        vec3(0.478, 0.604, 0.302),
        vec3(0.243, 0.420, 0.227),
        vec3(0.722, 0.812, 0.522),
        vec3(0.243, 0.420, 0.227) * 0.55,
        0, 0.42, 0.42, vec2(0.5, 0.5), 0.6, 0.95, vec2(0.2, 0.4)
    ),
    // 4 WATER — soft blue with cool highlight
    materialType(
        vec3(0.494, 0.659, 0.812),
        vec3(0.302, 0.482, 0.627),
        vec3(0.910, 0.941, 0.973),
        vec3(0.302, 0.482, 0.627) * 0.6,
        1, 0.55, 0.30, vec2(0.4, 0.55), 0.7, 0.99, vec2(0.15, 0.3)
    ),
    // 5 BANK — warm cream / olive
    materialType(
        vec3(0.722, 0.663, 0.471),
        vec3(0.620, 0.651, 0.424),
        vec3(0.722, 0.663, 0.471) * 0.7,
        vec3(0.620, 0.651, 0.424) * 0.55,
        0, 0.45, 0.30, vec2(0.5, 0.5), 0.4, 0.8, vec2(0.2, 0.4)
    )
);

float normpdf(in float x, in float sigma) {
    return 0.39894 * exp(-0.5 * x * x / (sigma * sigma)) / sigma;
}

vec4 calculateBlurredShape(float matID, vec2 uv, float k_s) {
    const int mSize = 11;
    const int kSize = (mSize - 1) / 2;
    float kernel[mSize];
    vec4 blurred = vec4(0.0);

    float sigma = 0.01 * iResolution.x;
    float Z = 0.0;
    for (int j = 0; j <= kSize; ++j)
        kernel[kSize + j] = kernel[kSize - j] = normpdf(float(j), sigma);
    for (int j = 0; j < mSize; ++j) Z += kernel[j];

    for (int i = -kSize; i <= kSize; ++i) {
        for (int j = -kSize; j <= kSize; ++j) {
            vec2 duv = vec2(float(i), float(j)) / iResolution.xy;
            vec4 s = texture(iChannel0, uv + duv);
            // McfGW2 trick: collapse "is this material?" + "is non-specular?" into r.
            s.x = (abs(s.x - matID) < 0.5) ? (1.0 - step(k_s, s.z)) : 0.0;
            blurred += kernel[kSize + j] * kernel[kSize + i] * s;
        }
    }
    return blurred / (Z * Z);
}

void paintLayer(inout vec4 color, vec2 uv, vec4 data, float layerMatId) {
    materialType mat = MATERIALS[int(round(layerMatId))];
    vec4 blurred = calculateBlurredShape(layerMatId, uv, mat.specular);
    float shape = blurred.x;
    vec3 paper = texture(iChannel1, uv * 2.0).rgb;
    float paper_T = (2.0 * (paper.x + paper.y + paper.z) / 3.0 - 1.0) * step(0.03, shape);
    shape += mat.paper.y * paper_T;

    // Light layer
    vec4 layer = vec4(interpolateColors(mat.dark_color, mat.color, blurred.y), mat.alpha);
    layer.a *= smoothstep(mat.flow.x - mat.flow.y, mat.flow.x + mat.flow.y, shape);
    layer.a *= (1.0 + mat.edge * (1.0 - shape));
    layer.a = clamp(layer.a + mat.paper.x * paper_T, 0., 1.);
    color.rgb = mix(color.rgb, layer.rgb, layer.a);

    // Shadow layer
    layer = vec4(interpolateColors(mat.dark_shadow_color, mat.light_shadow_color, blurred.y), mat.shadow_alpha);
    layer.a *= smoothstep(0.3, 0.7, 1.0 - blurred.w);
    layer.a *= smoothstep(mat.flow.x - mat.flow.y, mat.flow.x + mat.flow.y, shape);
    layer.a *= (1.0 + mat.edge * (1.0 - shape));
    layer.a = clamp(layer.a + mat.paper.x * paper_T, 0., 1.);
    color.rgb = mix(color.rgb, layer.rgb, layer.a);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec4 layerData = texture(iChannel0, uv);

    // Cream paper base — matches App's PaperOverlay.
    vec4 color = vec4(0.957, 0.922, 0.851, 1.0);

    // Back-to-front composite. Sky first (when matID==0), then the ground
    // layers, then trunks, then foliage on top.
    paintLayer(color, uv, layerData, MAT_SKY);
    paintLayer(color, uv, layerData, MAT_GROUND);
    paintLayer(color, uv, layerData, MAT_BANK);
    paintLayer(color, uv, layerData, MAT_WATER);
    paintLayer(color, uv, layerData, MAT_TRUNK);
    paintLayer(color, uv, layerData, MAT_FOLIAGE);

    fragColor = color;
}
