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

const LIT_VERT_SRC = `#version 300 es
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;

out vec3 v_normal;
out vec3 v_worldPos;

void main() {
  vec4 worldPos = u_model * vec4(a_position, 1.0);
  v_worldPos = worldPos.xyz;
  v_normal = mat3(u_model) * a_normal;
  gl_Position = u_projection * u_view * worldPos;
}
`;

const LIT_FRAG_SRC = `#version 300 es
precision highp float;

in vec3 v_normal;
in vec3 v_worldPos;

uniform vec3 u_lightDir;
uniform vec3 u_baseColor;
uniform vec3 u_eyePos;
uniform vec3 u_skyColor;
uniform vec3 u_groundColor;
uniform vec3 u_fogColor;
uniform float u_fogDensity;

out vec4 outColor;

void main() {
  vec3 n = normalize(v_normal);
  vec3 l = normalize(-u_lightDir);
  float diffuse = max(dot(n, l), 0.0);

  vec3 viewDir = normalize(u_eyePos - v_worldPos);
  vec3 halfVec = normalize(l + viewDir);
  float spec = pow(max(dot(n, halfVec), 0.0), 32.0);

  float hemiT = n.y * 0.5 + 0.5;
  vec3 ambient = mix(u_groundColor, u_skyColor, hemiT) * u_baseColor * 0.6;
  vec3 color = ambient + u_baseColor * diffuse * 0.8 + vec3(1.0) * spec * 0.35;

  float dist = length(u_eyePos - v_worldPos);
  float fog = 1.0 - exp(-pow(dist * u_fogDensity, 2.0));
  color = mix(color, u_fogColor, clamp(fog, 0.0, 1.0));

  outColor = vec4(color, 1.0);
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

out vec4 outColor;

void main() {
  vec3 rayDir = normalize(
    u_camForward
    + u_camRight * (v_ndc.x * u_aspect * u_tanHalfFov)
    + u_camUp * (v_ndc.y * u_tanHalfFov)
  );

  float t = clamp(rayDir.y * 0.5 + 0.5, 0.0, 1.0);
  t = pow(t, 0.5);
  vec3 color = mix(u_skyHorizon, u_skyTop, t);

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

const TERRAIN_VERT_SRC = `#version 300 es
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec3 a_color;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;

out vec3 v_normal;
out vec3 v_worldPos;
out vec3 v_color;

void main() {
  vec4 worldPos = u_model * vec4(a_position, 1.0);
  v_worldPos = worldPos.xyz;
  v_normal = mat3(u_model) * a_normal;
  v_color = a_color;
  gl_Position = u_projection * u_view * worldPos;
}
`;

const TERRAIN_FRAG_SRC = `#version 300 es
precision highp float;

in vec3 v_normal;
in vec3 v_worldPos;
in vec3 v_color;

uniform vec3 u_lightDir;
uniform vec3 u_eyePos;
uniform vec3 u_skyColor;
uniform vec3 u_groundColor;
uniform vec3 u_fogColor;
uniform float u_fogDensity;

out vec4 outColor;

void main() {
  vec3 n = normalize(v_normal);
  vec3 l = normalize(-u_lightDir);
  float diffuse = max(dot(n, l), 0.0);

  float hemiT = n.y * 0.5 + 0.5;
  vec3 ambient = mix(u_groundColor, u_skyColor, hemiT) * v_color * 0.6;
  vec3 color = ambient + v_color * diffuse * 0.8;

  float dist = length(u_eyePos - v_worldPos);
  float fog = 1.0 - exp(-pow(dist * u_fogDensity, 2.0));
  color = mix(color, u_fogColor, clamp(fog, 0.0, 1.0));

  outColor = vec4(color, 1.0);
}
`;
