// Opt-in LDR scene grading, after every scene draw and before DOM HUDs.
// This cannot recover clipped highlights and is not HDR tone mapping/bloom.
const POST_VERT_SRC = `#version 300 es
layout(location = 0) in vec2 a_ndc;
out vec2 v_uv;
void main() { v_uv = a_ndc * 0.5 + 0.5; gl_Position = vec4(a_ndc, 0.0, 1.0); }
`;
const POST_FRAG_SRC = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene;
uniform float u_exposure;
uniform float u_saturation;
out vec4 outColor;
void main() {
  vec4 scene = texture(u_scene, v_uv);
  vec3 color = scene.rgb * exp2(u_exposure);
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  outColor = vec4(clamp(mix(vec3(luminance), color, u_saturation), 0.0, 1.0), scene.a);
}
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

function createProgram(gl, vertSrc, fragSrc) {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${log}`);
  }
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return program;
}

// Wave 6 (Priority C): `a_joints`/`a_weights` (locations 3/4, matching
// createMeshFromArrays' own optional skinning buffers) plus `u_jointMatrices`
// (a capped bone palette, GLTF_MAX_JOINTS-sized) and `u_useSkinning` (false
// for every ordinary entity -- the whole skin branch is a no-op then, so
// this ONE program serves both skinned and non-skinned entities, rather
// than a second program duplicating every other uniform this one already
// has). Dynamically indexing a uniform array by a non-constant vertex-stage
// expression (`u_jointMatrices[int(a_joints.x)]`) is standard, well-
// supported GLSL ES 300 -- the same pattern every glTF-skinning shader uses.
const LIT_VERT_SRC = `#version 300 es
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;
layout(location = 3) in vec4 a_joints;
layout(location = 4) in vec4 a_weights;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform mat4 u_lightViewProj;
uniform mat4 u_jointMatrices[64]; // must match GLTF_MAX_JOINTS in 21-gltf.js
uniform bool u_useSkinning;

out vec3 v_normal;
out vec3 v_worldPos;
out vec2 v_uv;
out vec4 v_lightSpacePos;

void main() {
  vec4 localPos = vec4(a_position, 1.0);
  vec3 localNormal = a_normal;
  if (u_useSkinning) {
    mat4 skinMat = a_weights.x * u_jointMatrices[int(a_joints.x)]
                  + a_weights.y * u_jointMatrices[int(a_joints.y)]
                  + a_weights.z * u_jointMatrices[int(a_joints.z)]
                  + a_weights.w * u_jointMatrices[int(a_joints.w)];
    localPos = skinMat * localPos;
    localNormal = mat3(skinMat) * localNormal;
  }
  vec4 worldPos = u_model * localPos;
  v_worldPos = worldPos.xyz;
  v_normal = mat3(u_model) * localNormal;
  v_uv = a_uv;
  v_lightSpacePos = u_lightViewProj * worldPos;
  gl_Position = u_projection * u_view * worldPos;
}
`;

// Bounded Directional Shadows (Wave 5, Priority H): a depth-only pass over
// the sun's fixed orthographic box, rendered to its own small framebuffer
// before the normal scene pass -- see 09-renderer.js's renderShadowPass.
// No fragment output is declared at all (legal GLSL ES 300 -- there is no
// color attachment on the shadow framebuffer to write to), so this pass
// costs nothing beyond the depth writes gl_Position already implies.
const SHADOW_VERT_SRC = `#version 300 es
layout(location = 0) in vec3 a_position;

uniform mat4 u_model;
uniform mat4 u_lightViewProj;

void main() {
  gl_Position = u_lightViewProj * u_model * vec4(a_position, 1.0);
}
`;

const SHADOW_FRAG_SRC = `#version 300 es
precision highp float;
void main() {}
`;

// Texturing is deliberately bounded, NOT a PBR material model: one optional
// base-color texture, sampled and simply multiplied into the same
// hemisphere-ambient + diffuse + spec lighting every untextured entity
// already used -- no metallic/roughness/normal/emissive maps, no
// multi-texture layering. u_useTexture gates the sample so an untextured
// entity (the overwhelming majority of existing content) pays no visual
// cost and needs no real UV data (see createMeshFromArrays's comment).
const LIT_FRAG_SRC = `#version 300 es
precision highp float;

in vec3 v_normal;
in vec3 v_worldPos;
in vec2 v_uv;
in vec4 v_lightSpacePos;

uniform vec3 u_lightDir;
uniform vec3 u_baseColor;
uniform vec3 u_eyePos;
uniform vec3 u_skyColor;
uniform vec3 u_groundColor;
uniform vec3 u_fogColor;
uniform float u_fogDensity;
uniform sampler2D u_texture;
uniform bool u_useTexture;

// Materials 2.0: a few small, high-value additions on top of the existing
// base-texture/color model -- NOT a second material system, still the same
// "multiply into the same ambient+diffuse+spec" approach texturing already
// established. u_unlit skips lighting entirely for a flat/UI-like look;
// u_alpha feeds the renderer's separate transparent pass (see 09-renderer.js
// -- opaque entities draw depth-write-on first, transparent ones draw after,
// depth-write-off, back-to-front sorted); emissive adds a fixed
// self-illumination term independent of any light, useful for terminals/
// pickups/sci-fi props without needing an actual light object nearby.
uniform bool u_unlit;
uniform bool u_lighting2D;
uniform float u_ambient2D;
uniform float u_alpha;
uniform vec3 u_emissiveColor;
uniform float u_emissiveIntensity;
uniform vec2 u_uvScale;
uniform vec2 u_uvOffset;

// Lighting 2.0: a small, bounded set of placeable point/spot lights on top
// of the one directional sun -- NOT a physically-based lighting model, just
// a simple inverse-square-ish falloff (clamped range, squared for a softer
// edge than 1/d^2 alone) added straight into the same diffuse term the sun
// already contributes to. u_numLights lets the loop skip unused slots
// cheaply rather than branching per-light on an "enabled" flag.
const int MAX_LIGHTS = 8;
uniform int u_numLights;
uniform vec3 u_lightPos[MAX_LIGHTS];
uniform vec3 u_lightColor[MAX_LIGHTS];
uniform float u_lightIntensity[MAX_LIGHTS];
uniform float u_lightRange[MAX_LIGHTS];
uniform float u_lightIsSpot[MAX_LIGHTS];
uniform vec3 u_lightSpotDir[MAX_LIGHTS];
uniform float u_lightSpotCos[MAX_LIGHTS];

// Bounded Directional Shadows (Wave 5, Priority H): the sun ONLY -- Point/
// Spot lights never cast shadows, deliberately bounded scope. A 3x3 PCF tap
// softens the hard 1-bit shadow-map edge cheaply; the fixed 0.0 return
// outside the light's box (and past its far plane) means anything beyond
// the bounded shadow distance is simply always fully lit, never wrongly
// darkened.
uniform sampler2D u_shadowMap;
uniform bool u_shadowsEnabled;
uniform float u_shadowBias;

float shadowFactor() {
  if (!u_shadowsEnabled) return 1.0;
  vec3 proj = v_lightSpacePos.xyz / v_lightSpacePos.w;
  proj = proj * 0.5 + 0.5;
  if (proj.x < 0.0 || proj.x > 1.0 || proj.y < 0.0 || proj.y > 1.0 || proj.z > 1.0) return 1.0;
  vec2 mapSize = vec2(textureSize(u_shadowMap, 0));
  vec2 samplePos = proj.xy * mapSize - 0.5;
  vec2 base = floor(samplePos);
  vec2 fraction = fract(samplePos);
  // Interpolate comparisons, never depths: bilinear depth filtering moves
  // occluders. This integrates the same 3x3 PCF footprint continuously
  // across texels using 16 taps rather than 36 separate bilinear taps.
  float shadow = 0.0;
  for (int x = -1; x <= 2; x++) {
    float weightX = x == -1 ? 1.0 - fraction.x : (x == 2 ? fraction.x : 1.0);
    for (int y = -1; y <= 2; y++) {
      float weightY = y == -1 ? 1.0 - fraction.y : (y == 2 ? fraction.y : 1.0);
      vec2 uv = (base + vec2(float(x), float(y)) + 0.5) / mapSize;
      float pcfDepth = texture(u_shadowMap, uv).r;
      shadow += weightX * weightY * ((proj.z - u_shadowBias > pcfDepth) ? 0.0 : 1.0);
    }
  }
  return shadow / 9.0;
}

out vec4 outColor;

vec3 localLightsContribution(vec3 n, vec3 albedo) {
  vec3 total = vec3(0.0);
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= u_numLights) break;
    vec3 toLight = u_lightPos[i] - v_worldPos;
    float dist = length(toLight);
    vec3 lDir = toLight / max(dist, 0.0001);
    float atten = clamp(1.0 - dist / max(u_lightRange[i], 0.001), 0.0, 1.0);
    atten *= atten;
    if (u_lightIsSpot[i] > 0.5) {
      float cosAngle = dot(-lDir, normalize(u_lightSpotDir[i]));
      atten *= smoothstep(u_lightSpotCos[i], u_lightSpotCos[i] + 0.08, cosAngle);
    }
    float diff = max(dot(n, lDir), 0.0);
    total += u_lightColor[i] * (u_lightIntensity[i] * diff * atten) * albedo;
  }
  return total;
}

// Stylized XY illumination shares existing bounded Point/Spot lights. Z is
// intentionally ignored; no normals, specular, occlusion or shadow claims.
vec3 planarLightsContribution(vec3 albedo) {
  vec3 total = albedo * u_ambient2D;
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= u_numLights) break;
    vec2 delta = v_worldPos.xy - u_lightPos[i].xy;
    float dist = length(delta);
    float attenuation = clamp(1.0 - dist / max(u_lightRange[i], 0.001), 0.0, 1.0);
    attenuation *= attenuation;
    if (u_lightIsSpot[i] > 0.5) {
      float directionLength = length(u_lightSpotDir[i].xy);
      if (directionLength < 0.0001) continue;
      float cosine = dist < 0.0001 ? 1.0 : dot(delta / dist, u_lightSpotDir[i].xy / directionLength);
      attenuation *= smoothstep(u_lightSpotCos[i], u_lightSpotCos[i] + 0.08, cosine);
    }
    total += albedo * u_lightColor[i] * u_lightIntensity[i] * attenuation;
  }
  return total;
}

void main() {
  vec3 n = normalize(v_normal);
  vec2 uv = v_uv * u_uvScale + u_uvOffset;
  // Wave 6 (Priority I): the texture's own ALPHA channel now multiplies
  // into the final fragment alpha (texAlpha defaults to 1.0 when untextured,
  // a complete no-op for every existing opaque/RGB-only texture) -- needed
  // for a Billboard/Sprite whose texture has a transparent cutout
  // background (foliage, icons, characters-as-sprites), the primary real
  // use case this priority exists to serve. Draws through the SAME
  // existing opaque/transparent two-pass split (09-renderer.js) already
  // built for Materials 2.0's own per-entity alpha -- no new render pass.
  vec4 texSample = u_useTexture ? texture(u_texture, uv) : vec4(1.0);
  vec3 texColor = texSample.rgb;
  float texAlpha = texSample.a;
  vec3 albedo = u_baseColor * texColor;

  vec3 color;
  if (u_lighting2D) {
    color = planarLightsContribution(albedo);
  } else if (u_unlit) {
    color = albedo;
  } else {
    vec3 l = normalize(-u_lightDir);
    float diffuse = max(dot(n, l), 0.0);

    vec3 viewDir = normalize(u_eyePos - v_worldPos);
    vec3 halfVec = normalize(l + viewDir);
    float spec = pow(max(dot(n, halfVec), 0.0), 32.0);

    float sh = shadowFactor();
    float hemiT = n.y * 0.5 + 0.5;
    vec3 ambient = mix(u_groundColor, u_skyColor, hemiT) * albedo * 0.6;
    color = ambient + albedo * diffuse * 0.8 * sh + vec3(1.0) * spec * 0.35 * sh;
    color += localLightsContribution(n, albedo);
  }
  color += u_emissiveColor * u_emissiveIntensity;

  float dist = length(u_eyePos - v_worldPos);
  float fog = 1.0 - exp(-pow(dist * u_fogDensity, 2.0));
  color = mix(color, u_fogColor, clamp(fog, 0.0, 1.0));

  outColor = vec4(color, u_alpha * texAlpha);
}
`;

const SKY_VERT_SRC = `#version 300 es
layout(location = 0) in vec2 a_ndc;

out vec2 v_ndc;

void main() {
  v_ndc = a_ndc;
  gl_Position = vec4(a_ndc, 1.0, 1.0);
}
`;

const SKY_FRAG_SRC = `#version 300 es
precision highp float;

in vec2 v_ndc;

uniform vec3 u_camForward;
uniform vec3 u_camRight;
uniform vec3 u_camUp;
uniform float u_tanHalfFov;
uniform float u_aspect;
uniform vec3 u_skyTop;
uniform vec3 u_skyHorizon;
uniform vec3 u_lightDir;
uniform vec3 u_sunColor;
// Wave 6 (Priority H): an optional author-supplied equirectangular
// panorama, sampled INSTEAD OF the procedural gradient when
// u_useSkyTexture is true -- same "one program, one bool gate" reuse
// pattern the skinning shader (Priority C) and terrain paint blend
// (Priority G) already established, rather than a second sky program.
// The sun-glow disc still draws ON TOP of a panorama too (an author's
// photographed/painted sky usually has no bright moving sun disc baked
// in, and the sun's own screen position still needs to track the SAME
// u_lightDir every other lit surface's highlight already reacts to).
uniform sampler2D u_skyTexture;
uniform bool u_useSkyTexture;

out vec4 outColor;

const float PI = 3.14159265;

void main() {
  vec3 rayDir = normalize(
    u_camForward
    + u_camRight * (v_ndc.x * u_aspect * u_tanHalfFov)
    + u_camUp * (v_ndc.y * u_tanHalfFov)
  );

  vec3 color;
  if (u_useSkyTexture) {
    // Standard equirectangular mapping: longitude -> u, latitude -> v.
    float lon = atan(rayDir.z, rayDir.x);
    float lat = asin(clamp(rayDir.y, -1.0, 1.0));
    vec2 uv = vec2(lon / (2.0 * PI) + 0.5, 0.5 - lat / PI);
    color = texture(u_skyTexture, uv).rgb;
  } else {
    float t = clamp(rayDir.y * 0.5 + 0.5, 0.0, 1.0);
    t = pow(t, 0.5);
    color = mix(u_skyHorizon, u_skyTop, t);
  }

  float sun = max(dot(rayDir, normalize(-u_lightDir)), 0.0);
  color += u_sunColor * pow(sun, 256.0) * 1.5;
  color += u_sunColor * pow(sun, 8.0) * 0.15;

  outColor = vec4(color, 1.0);
}
`;

const PARTICLE_VERT_SRC = `#version 300 es
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec4 a_instPosSize;
layout(location = 2) in vec4 a_instColorAlpha;

uniform mat4 u_view;
uniform mat4 u_projection;
uniform vec3 u_camRight;
uniform vec3 u_camUp;

out vec2 v_corner;
out vec4 v_colorAlpha;

void main() {
  vec3 worldPos = a_instPosSize.xyz
    + (u_camRight * a_corner.x + u_camUp * a_corner.y) * a_instPosSize.w;
  v_corner = a_corner;
  v_colorAlpha = a_instColorAlpha;
  gl_Position = u_projection * u_view * vec4(worldPos, 1.0);
}
`;

const PARTICLE_FRAG_SRC = `#version 300 es
precision highp float;

in vec2 v_corner;
in vec4 v_colorAlpha;

out vec4 outColor;

void main() {
  float d = length(v_corner);
  float falloff = smoothstep(1.0, 0.0, d);
  float alpha = falloff * v_colorAlpha.a;
  outColor = vec4(v_colorAlpha.rgb * alpha, alpha);
}
`;

const WATER_VERT_SRC = `#version 300 es
layout(location = 0) in vec3 a_position;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform vec4 u_waveA;
uniform vec4 u_waveB;
uniform vec4 u_waveC;
uniform vec3 u_waveAmp;
uniform float u_time;

out vec3 v_worldPos;
out vec3 v_normal;
out float v_height;

float waveHeight(vec2 p, vec4 w, float amp) {
  float phase = dot(normalize(w.xy), p) * w.z + u_time * w.w;
  return amp * sin(phase);
}

vec2 waveDeriv(vec2 p, vec4 w, float amp) {
  vec2 dir = normalize(w.xy);
  float phase = dot(dir, p) * w.z + u_time * w.w;
  float c = amp * w.z * cos(phase);
  return dir * c;
}

void main() {
  vec4 worldPos = u_model * vec4(a_position, 1.0);
  vec2 p = worldPos.xz;

  float h = waveHeight(p, u_waveA, u_waveAmp.x)
          + waveHeight(p, u_waveB, u_waveAmp.y)
          + waveHeight(p, u_waveC, u_waveAmp.z);

  vec2 d = waveDeriv(p, u_waveA, u_waveAmp.x)
         + waveDeriv(p, u_waveB, u_waveAmp.y)
         + waveDeriv(p, u_waveC, u_waveAmp.z);

  worldPos.y += h;
  v_worldPos = worldPos.xyz;
  v_normal = normalize(vec3(-d.x, 1.0, -d.y));
  v_height = h;

  gl_Position = u_projection * u_view * worldPos;
}
`;

const WATER_FRAG_SRC = `#version 300 es
precision highp float;

in vec3 v_worldPos;
in vec3 v_normal;
in float v_height;

uniform vec3 u_eyePos;
uniform vec3 u_lightDir;
uniform vec3 u_deepColor;
uniform vec3 u_reflectionColor;
uniform vec3 u_foamColor;
uniform vec3 u_fogColor;
uniform float u_fogDensity;
uniform float u_time;

out vec4 outColor;

void main() {
  vec3 n = normalize(v_normal);
  vec3 viewDir = normalize(u_eyePos - v_worldPos);

  float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 4.0);
  vec3 color = mix(u_deepColor, u_reflectionColor, clamp(fresnel, 0.0, 1.0));

  vec3 l = normalize(-u_lightDir);
  vec3 halfVec = normalize(l + viewDir);
  float spec = pow(max(dot(n, halfVec), 0.0), 120.0);
  color += vec3(1.0, 0.96, 0.85) * spec * 0.8;

  float crest = smoothstep(0.045, 0.09, v_height);
  float sparkle = 0.5 + 0.5 * sin(v_worldPos.x * 12.0 + v_worldPos.z * 9.0 + u_time * 3.0);
  float foam = crest * mix(0.4, 1.0, sparkle);
  color = mix(color, u_foamColor, foam);

  float dist = length(u_eyePos - v_worldPos);
  float fog = 1.0 - exp(-pow(dist * u_fogDensity, 2.0));
  color = mix(color, u_fogColor, clamp(fog, 0.0, 1.0));

  outColor = vec4(color, 1.0);
}
`;

// Wave 6B (Priority D): `a_layerWeights` (location 3, matching
// createColoredMesh's own optional 4th buffer) carries each vertex's RAW
// per-layer paint weight straight through to the fragment stage -- the
// terrain fragment shader needs the RAW weight (not the already-baked
// procedural+paint-color v_color) to blend in an authored texture
// independently, the same "pass raw data, blend in the fragment stage"
// approach the entity shader's own UV/texture sampling already uses.
const TERRAIN_VERT_SRC = `#version 300 es
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec3 a_color;
layout(location = 3) in vec3 a_layerWeights;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform mat4 u_lightViewProj;

out vec3 v_normal;
out vec3 v_worldPos;
out vec3 v_color;
out vec3 v_layerWeights;
out vec4 v_lightSpacePos;

void main() {
  vec4 worldPos = u_model * vec4(a_position, 1.0);
  v_worldPos = worldPos.xyz;
  v_normal = mat3(u_model) * a_normal;
  v_color = a_color;
  v_layerWeights = a_layerWeights;
  v_lightSpacePos = u_lightViewProj * worldPos;
  gl_Position = u_projection * u_view * worldPos;
}
`;

const TERRAIN_FRAG_SRC = `#version 300 es
precision highp float;

in vec3 v_normal;
in vec3 v_worldPos;
in vec3 v_color;
in vec3 v_layerWeights;
in vec4 v_lightSpacePos;

uniform vec3 u_lightDir;
uniform vec3 u_eyePos;
uniform vec3 u_skyColor;
uniform vec3 u_groundColor;
uniform vec3 u_fogColor;
uniform float u_fogDensity;

// Wave 6B (Priority D): true textured terrain layers -- an EXTENSION of the
// existing painted-color system above, never a replacement. Each of up to 3
// paint layers may optionally carry a real Texture Asset; when it does, this
// terrain-only sampler+flag+tiling triple lets the fragment stage blend that
// texture in, weighted by the SAME v_layerWeights this layer's flat color
// already blends by -- reusing the one paint-weight authoring system, not a
// second one. u_terrainHasTexN defaults to false (unset uniforms read as
// false/0 in WebGL2) for every terrain that has never had a layer texture
// assigned, making this entire block a complete no-op and leaving the
// existing v_color-only result bit-identical to before this priority existed.
uniform sampler2D u_terrainTex0;
uniform sampler2D u_terrainTex1;
uniform sampler2D u_terrainTex2;
uniform bool u_terrainHasTex0;
uniform bool u_terrainHasTex1;
uniform bool u_terrainHasTex2;
uniform float u_terrainUVScale0;
uniform float u_terrainUVScale1;
uniform float u_terrainUVScale2;

// Same bounded local-lights model as the entity shader -- see LIT_FRAG_SRC's
// own comment for the reasoning. Kept as an exact duplicate of that block
// rather than a shared #include (GLSL ES 300 in WebGL2 has no preprocessor
// include mechanism), so a future change to the falloff/spot math must be
// made in both places -- noted here deliberately so it isn't missed.
const int MAX_LIGHTS = 8;
uniform int u_numLights;
uniform vec3 u_lightPos[MAX_LIGHTS];
uniform vec3 u_lightColor[MAX_LIGHTS];
uniform float u_lightIntensity[MAX_LIGHTS];
uniform float u_lightRange[MAX_LIGHTS];
uniform float u_lightIsSpot[MAX_LIGHTS];
uniform vec3 u_lightSpotDir[MAX_LIGHTS];
uniform float u_lightSpotCos[MAX_LIGHTS];

// Same bounded sun-only shadow sampling as the entity shader -- see
// LIT_FRAG_SRC's shadowFactor for the reasoning; kept as an exact
// duplicate for the same "no #include in GLSL ES 300" reason as the
// lights block above.
uniform sampler2D u_shadowMap;
uniform bool u_shadowsEnabled;
uniform float u_shadowBias;

float shadowFactor() {
  if (!u_shadowsEnabled) return 1.0;
  vec3 proj = v_lightSpacePos.xyz / v_lightSpacePos.w;
  proj = proj * 0.5 + 0.5;
  if (proj.x < 0.0 || proj.x > 1.0 || proj.y < 0.0 || proj.y > 1.0 || proj.z > 1.0) return 1.0;
  vec2 mapSize = vec2(textureSize(u_shadowMap, 0));
  vec2 samplePos = proj.xy * mapSize - 0.5;
  vec2 base = floor(samplePos);
  vec2 fraction = fract(samplePos);
  // Interpolate comparisons, never depths: bilinear depth filtering moves
  // occluders. This integrates the same 3x3 PCF footprint continuously
  // across texels using 16 taps rather than 36 separate bilinear taps.
  float shadow = 0.0;
  for (int x = -1; x <= 2; x++) {
    float weightX = x == -1 ? 1.0 - fraction.x : (x == 2 ? fraction.x : 1.0);
    for (int y = -1; y <= 2; y++) {
      float weightY = y == -1 ? 1.0 - fraction.y : (y == 2 ? fraction.y : 1.0);
      vec2 uv = (base + vec2(float(x), float(y)) + 0.5) / mapSize;
      float pcfDepth = texture(u_shadowMap, uv).r;
      shadow += weightX * weightY * ((proj.z - u_shadowBias > pcfDepth) ? 0.0 : 1.0);
    }
  }
  return shadow / 9.0;
}

out vec4 outColor;

vec3 localLightsContribution(vec3 n, vec3 albedo) {
  vec3 total = vec3(0.0);
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= u_numLights) break;
    vec3 toLight = u_lightPos[i] - v_worldPos;
    float dist = length(toLight);
    vec3 lDir = toLight / max(dist, 0.0001);
    float atten = clamp(1.0 - dist / max(u_lightRange[i], 0.001), 0.0, 1.0);
    atten *= atten;
    if (u_lightIsSpot[i] > 0.5) {
      float cosAngle = dot(-lDir, normalize(u_lightSpotDir[i]));
      atten *= smoothstep(u_lightSpotCos[i], u_lightSpotCos[i] + 0.08, cosAngle);
    }
    float diff = max(dot(n, lDir), 0.0);
    total += u_lightColor[i] * (u_lightIntensity[i] * diff * atten) * albedo;
  }
  return total;
}

void main() {
  vec3 n = normalize(v_normal);
  vec3 l = normalize(-u_lightDir);
  float diffuse = max(dot(n, l), 0.0);
  float sh = shadowFactor();

  // Wave 6B (Priority D): world-space planar texture projection -- no
  // per-layer UV attribute is needed at all, since every paint layer tiles
  // uniformly across the terrain's own XZ footprint; a layer's own UV Scale
  // is just how many world units one texture tile spans. A textured layer's
  // sample REPLACES (via mix, weighted by that layer's own paint weight)
  // its own flat-color contribution that's already baked into v_color --
  // painted-but-untextured layers, and any unpainted procedural remainder,
  // are completely unaffected.
  vec3 albedo = v_color;
  if (u_terrainHasTex0 && v_layerWeights.x > 0.001) {
    vec2 uv0 = v_worldPos.xz / max(u_terrainUVScale0, 0.001);
    albedo = mix(albedo, texture(u_terrainTex0, uv0).rgb, v_layerWeights.x);
  }
  if (u_terrainHasTex1 && v_layerWeights.y > 0.001) {
    vec2 uv1 = v_worldPos.xz / max(u_terrainUVScale1, 0.001);
    albedo = mix(albedo, texture(u_terrainTex1, uv1).rgb, v_layerWeights.y);
  }
  if (u_terrainHasTex2 && v_layerWeights.z > 0.001) {
    vec2 uv2 = v_worldPos.xz / max(u_terrainUVScale2, 0.001);
    albedo = mix(albedo, texture(u_terrainTex2, uv2).rgb, v_layerWeights.z);
  }

  float hemiT = n.y * 0.5 + 0.5;
  vec3 ambient = mix(u_groundColor, u_skyColor, hemiT) * albedo * 0.6;
  vec3 color = ambient + albedo * diffuse * 0.8 * sh;
  color += localLightsContribution(n, albedo);

  float dist = length(u_eyePos - v_worldPos);
  float fog = 1.0 - exp(-pow(dist * u_fogDensity, 2.0));
  color = mix(color, u_fogColor, clamp(fog, 0.0, 1.0));

  outColor = vec4(color, 1.0);
}
`;
