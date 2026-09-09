/**
 * Digital Opus Engine public boundary. Only `window.Opus` leaves the build IIFE.
 * Public geometry objects are CPU-side descriptions; GPU objects remain private.
 */

function received(value) {
  if (typeof value === 'number') return String(value);
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  return value && value.constructor ? value.constructor.name : typeof value;
}

function fail(method, parameter, expected, value) {
  throw new TypeError(`${method}: "${parameter}" must be ${expected}; received ${received(value)}.`);
}

function finite(value, parameter, method) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(method, parameter, 'a number other than NaN or Infinity', value);
  return value;
}

function positive(value, parameter, method, allowZero = false) {
  finite(value, parameter, method);
  if (allowZero ? value < 0 : value <= 0) fail(method, parameter, allowZero ? 'a non-negative number' : 'greater than 0', value);
  return value;
}

function integer(value, parameter, method) {
  if (!Number.isInteger(value) || value <= 0) fail(method, parameter, 'a whole number greater than 0', value);
  return value;
}

function vector(value, parameter, method) {
  if (!(value instanceof Vec3)) fail(method, parameter, 'an Opus.Vec3', value);
  finite(value.x, `${parameter}.x`, method);
  finite(value.y, `${parameter}.y`, method);
  finite(value.z, `${parameter}.z`, method);
  return value;
}

function colorArray(value, parameter, method) {
  if (!Array.isArray(value) || value.length !== 3) fail(method, parameter, 'an array of 3 numbers [r, g, b]', value);
  for (let i = 0; i < 3; i++) finite(value[i], `${parameter}[${i}]`, method);
  return value;
}

function callback(value, parameter, method, optional = false) {
  if ((!optional || value !== undefined) && typeof value !== 'function') fail(method, parameter, 'a function', value);
  return value;
}

function canvasElement(value, method) {
  if (!value || typeof value.getContext !== 'function' || String(value.tagName).toLowerCase() !== 'canvas') {
    fail(method, 'canvas', 'an HTMLCanvasElement', value);
  }
}

function optionsObject(value, parameter, method) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(method, parameter, 'an options object', value);
}

function validateTerrainOptions(opts, method) {
  optionsObject(opts, 'options', method);
  if (opts.seed !== undefined) finite(opts.seed, 'options.seed', method);
  for (const name of ['size', 'radius', 'amplitude']) if (opts[name] !== undefined) positive(opts[name], `options.${name}`, method);
  for (const name of ['islandBase', 'oceanFloor', 'waterLevel']) if (opts[name] !== undefined) finite(opts[name], `options.${name}`, method);
  if (opts.segments !== undefined) {
    integer(opts.segments, 'options.segments', method);
    if (opts.segments > 254) fail(method, 'options.segments', 'a whole number from 1 through 254', opts.segments);
  }
  if (opts.position !== undefined) vector(opts.position, 'options.position', method);
}

function validateWaves(waves, method) {
  if (!Array.isArray(waves) || waves.length !== 3) fail(method, 'options.waves', 'an array of exactly 3 wave objects', waves);
  waves.forEach((wave, index) => {
    optionsObject(wave, `options.waves[${index}]`, method);
    if (!Array.isArray(wave.dir) || wave.dir.length !== 2) fail(method, `options.waves[${index}].dir`, 'a two-number array', wave.dir);
    finite(wave.dir[0], `options.waves[${index}].dir[0]`, method);
    finite(wave.dir[1], `options.waves[${index}].dir[1]`, method);
    if (Math.hypot(wave.dir[0], wave.dir[1]) === 0) fail(method, `options.waves[${index}].dir`, 'a non-zero direction', wave.dir);
    positive(wave.freq, `options.waves[${index}].freq`, method);
    finite(wave.speed, `options.waves[${index}].speed`, method);
    positive(wave.amp, `options.waves[${index}].amp`, method, true);
  });
}

function validateWaterOptions(opts, method) {
  optionsObject(opts, 'options', method);
  if (opts.size !== undefined) positive(opts.size, 'options.size', method);
  if (opts.segments !== undefined) {
    integer(opts.segments, 'options.segments', method);
    if (opts.segments > 254) fail(method, 'options.segments', 'a whole number from 1 through 254', opts.segments);
  }
  if (opts.position !== undefined) vector(opts.position, 'options.position', method);
  if (opts.waves !== undefined) validateWaves(opts.waves, method);
  if (opts.deepColor !== undefined && (!Array.isArray(opts.deepColor) || opts.deepColor.length !== 3 || opts.deepColor.some((n) => typeof n !== 'number' || !Number.isFinite(n)))) {
    fail(method, 'options.deepColor', 'a three-number RGB array', opts.deepColor);
  }
}

const DEFAULT_WAVES = Object.freeze([
  Object.freeze({ dir: [1, 0.2], freq: 0.6, speed: 1, amp: 0.1 }),
  Object.freeze({ dir: [-0.3, 1], freq: 1.3, speed: 0.7, amp: 0.06 }),
  Object.freeze({ dir: [0.6, -0.8], freq: 2.4, speed: 1.6, amp: 0.03 }),
]);

const MESH_DATA = new WeakMap();
const ENTITY_MESHES = new WeakMap();
const TERRAIN_RENDER = new WeakMap();
const WATER_RENDER = new WeakMap();

function meshDescriptor(kind, data) {
  const descriptor = Object.freeze({ kind });
  MESH_DATA.set(descriptor, { kind, ...data });
  return descriptor;
}

function getEntityRenderMesh(entity) {
  return ENTITY_MESHES.get(entity);
}

// Wave 6 (Priority B/Section 14): unit Ramp/Wedge geometry, built once and
// cached (Opus.Mesh.wedge() always returns the same frozen descriptor, the
// same "shared, reusable description" contract cube()/plane() already
// promise). Vertex layout/winding follows createCubeMesh's own established
// per-face pattern (a 4-vertex "bottom-left, bottom-right, top-right,
// top-left" quad, or a 3-vertex triangle for the two open ends) so a Ramp
// shades and unwraps exactly the way every other primitive in this engine
// already does -- no separate convention invented for one shape.
let WEDGE_MESH_DESCRIPTOR = null;
function buildWedgeArrays() {
  // A=(-.5,-.5,-.5) B=(.5,-.5,-.5) C=(.5,.5,-.5) D=(-.5,-.5,.5) E=(.5,-.5,.5) F=(.5,.5,.5)
  const positions = new Float32Array([
    // Bottom (-Y): D, E, B, A
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, -0.5, -0.5,
    // Back, vertical (+X): B, E, F, C
    0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5,
    // Slope (rises +X): A, C, F, D
    -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5,
    // End, -Z (triangle): B, C, A
    0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, -0.5,
    // End, +Z (triangle): D, F, E
    -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
  ]);
  const s = Math.SQRT1_2;
  const normals = new Float32Array([
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    -s, s, 0, -s, s, 0, -s, s, 0, -s, s, 0,
    0, 0, -1, 0, 0, -1, 0, 0, -1,
    0, 0, 1, 0, 0, 1, 0, 0, 1,
  ]);
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14,
    15, 16, 17,
  ]);
  const uvs = new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 0.5, 1,
    0, 0, 1, 0, 0.5, 1,
  ]);
  return { positions, normals, indices, uvs };
}

/** CPU-side mesh factories. Returned descriptions are safe to share between App instances. */
const Mesh = Object.freeze({
  /** Returns a 1x1x1 cube description. */
  cube() { return meshDescriptor('cube', {}); },
  /** Returns a 1x1 plane description on the XZ plane. */
  plane() { return meshDescriptor('plane', {}); },
  /**
   * Wave 6 (Priority B/Section 14): a 1x1x1 Ramp/Wedge -- a right
   * triangular prism whose sloped face rises along local +X, from
   * y=-0.5 at x=-0.5 (the ramp's open, walkable-onto low end) up to
   * y=+0.5 at x=+0.5 (a vertical wall at the high end). Built once as a
   * static Float32Array set and returned through the SAME 'arrays'
   * mesh-description/GPU path Opus.Mesh.fromArrays already uses -- no new
   * renderer draw branch needed, matching this engine's own "arrays" kind
   * being fully generic. Opus.Physics.resolveRampCollision's walkable
   * surface is defined to match this exact geometry (same rise direction,
   * same -0.5..0.5 slope), so the rendered ramp and its collision surface
   * are always the same plane, never two separately-authored shapes that
   * could drift apart.
   */
  wedge() {
    if (!WEDGE_MESH_DESCRIPTOR) WEDGE_MESH_DESCRIPTOR = meshDescriptor('arrays', buildWedgeArrays());
    return WEDGE_MESH_DESCRIPTOR;
  },
  /** Returns a subdivided XZ grid description. */
  grid(size = 30, segments = 48) {
    positive(size, 'size', 'Opus.Mesh.grid');
    integer(segments, 'segments', 'Opus.Mesh.grid');
    if (segments > 254) fail('Opus.Mesh.grid', 'segments', 'a whole number from 1 through 254', segments);
    return meshDescriptor('grid', { size, segments });
  },
  /**
   * Returns a custom indexed mesh description. Input arrays are retained
   * and must not be mutated. `uvs` is optional (a Float32Array of
   * `positions.length / 3 * 2`) -- omit it for a mesh that's never
   * textured; every mesh gets a UV attribute slot at the GPU layer
   * regardless (see createMeshFromArrays), so this only controls whether
   * that slot carries real texture coordinates or harmless zeros.
   */
  fromArrays(positions, normals, indices, uvs) {
    const method = 'Opus.Mesh.fromArrays';
    if (!(positions instanceof Float32Array) || positions.length % 3) fail(method, 'positions', 'a Float32Array whose length is divisible by 3', positions);
    if (!(normals instanceof Float32Array) || normals.length !== positions.length) fail(method, 'normals', 'a Float32Array matching positions.length', normals);
    if (!(indices instanceof Uint16Array) || indices.length % 3) fail(method, 'indices', 'a Uint16Array of triangle indices', indices);
    const expectedUvLength = (positions.length / 3) * 2;
    if (uvs !== undefined && (!(uvs instanceof Float32Array) || uvs.length !== expectedUvLength)) fail(method, 'uvs', `undefined, or a Float32Array of length ${expectedUvLength} (positions.length / 3 * 2)`, uvs);
    return meshDescriptor('arrays', { positions, normals, indices, uvs: uvs || new Float32Array(expectedUvLength) });
  },
  /**
   * Imports geometry from a glTF 2.0 file: a JSON string (.gltf, buffers as
   * base64 data URIs) or an ArrayBuffer (.glb, or raw .gltf bytes).
   * Texture coordinates (TEXCOORD_0) are imported when present; one bounded
   * base-color texture is imported too (see 21-gltf.js's own comment) and
   * surfaced via `Opus.Mesh.toArrays(mesh).textureDataURL` since a mesh
   * description has no separate "and also load this texture" return slot.
   * Skinning/animation are NOT imported by this function even if the file
   * has them (this is the STATIC path -- vertices are baked into world
   * space at import time, which is exactly wrong for a skinned mesh; see
   * `fromSkinnedGLTF` below for the dedicated skinned-mesh import path).
   * Throws with a specific reason for anything unsupported (external
   * buffer/image files, non-triangle/non-indexed primitives, more than
   * 65535 vertices) rather than silently dropping data.
   */
  fromGLTF(input) {
    const { positions, normals, uvs, indices, textureDataURL } = parseGLTFToArrays(input);
    return meshDescriptor('arrays', { positions, normals, indices, uvs, textureDataURL });
  },
  /**
   * Wave 6 (Priority C): imports a SKINNED glTF 2.0 model -- exactly one
   * skin (the first mesh node with both `mesh` and `skin` set), TRS
   * animation channels only (no morph targets), up to 64 joints. Returns a
   * mesh description carrying the skin's rig data (joint hierarchy, bind
   * pose, inverse bind matrices, animation clips) alongside its geometry;
   * `App.addEntity` recognizes this shape and sets the resulting entity's
   * `.skin`, enabling the shader's skinning branch and per-frame CPU pose
   * sampling (`Entity.update`, see 11-entity.js) automatically -- no
   * separate "make this entity animated" call needed. Unlike `fromGLTF`,
   * vertex positions are kept in the skin's own local bind space (NOT
   * baked into world space), since a skinned vertex is re-transformed every
   * frame by the current animated joint palette, not fixed at import time.
   */
  fromSkinnedGLTF(input) {
    const { positions, normals, uvs, indices, joints, weights, jointCount, inverseBindMatrices, jointParents, jointLocalBind, jointNames, clips } = parseSkinnedGLTFToArrays(input);
    return meshDescriptor('skinned', { positions, normals, indices, uvs, joints, weights, skin: { jointCount, inverseBindMatrices, jointParents, jointLocalBind, jointNames, clips } });
  },
  /**
   * The `fromArrays` counterpart for skinned meshes -- reconstructs a
   * skinned mesh description directly from already-parsed geometry+rig
   * data (exactly the shape `toSkinnedArrays` returns), without re-parsing
   * a glTF file. Exists for the same reason `fromArrays` exists alongside
   * `fromGLTF`: a Save/Load or asset-library reload needs to rebuild the
   * mesh from PERSISTED plain data, not by keeping the original import file
   * around forever.
   */
  fromSkinnedArrays(positions, normals, indices, uvs, joints, weights, skin) {
    const method = 'Opus.Mesh.fromSkinnedArrays';
    if (!(positions instanceof Float32Array) || positions.length % 3) fail(method, 'positions', 'a Float32Array whose length is divisible by 3', positions);
    if (!(normals instanceof Float32Array) || normals.length !== positions.length) fail(method, 'normals', 'a Float32Array matching positions.length', normals);
    if (!(indices instanceof Uint16Array) || indices.length % 3) fail(method, 'indices', 'a Uint16Array of triangle indices', indices);
    const vertexCount = positions.length / 3;
    if (!(joints instanceof Float32Array) || joints.length !== vertexCount * 4) fail(method, 'joints', `a Float32Array of length ${vertexCount * 4} (vertexCount * 4)`, joints);
    if (!(weights instanceof Float32Array) || weights.length !== vertexCount * 4) fail(method, 'weights', `a Float32Array of length ${vertexCount * 4} (vertexCount * 4)`, weights);
    optionsObject(skin, 'skin', method);
    return meshDescriptor('skinned', { positions, normals, indices, uvs: uvs || new Float32Array(vertexCount * 2), joints, weights, skin });
  },
  /**
   * The `fromSkinnedGLTF` counterpart to `toArrays` -- returns the full
   * geometry AND rig data behind a skinned mesh description (positions/
   * normals/uvs/indices/joints/weights plus the `skin` rig object), so a
   * skinned asset can be persisted (Save/Load, asset library) and
   * reconstructed later without keeping the original glTF file around, the
   * same "describe once, reconstruct exactly" contract `toArrays` already
   * gives non-skinned custom meshes.
   */
  toSkinnedArrays(mesh) {
    const data = MESH_DATA.get(mesh);
    if (!data || data.kind !== 'skinned') fail('Opus.Mesh.toSkinnedArrays', 'mesh', 'a mesh description created by Opus.Mesh.fromSkinnedGLTF', mesh);
    return { positions: data.positions, normals: data.normals, indices: data.indices, uvs: data.uvs, joints: data.joints, weights: data.weights, skin: data.skin };
  },
  /**
   * Inverse of fromArrays -- returns the { positions, normals, indices,
   * uvs, textureDataURL } behind a mesh description created by fromArrays
   * or fromGLTF, so an imported/custom mesh's geometry (and any embedded
   * glTF texture) can be persisted (save/load, export) without the caller
   * having kept the original arrays or source file around. `textureDataURL`
   * is null unless the mesh came from a glTF file with an embedded
   * base-color texture. Only 'arrays'-kind descriptions carry raw arrays;
   * cube/plane/grid/terrain shapes are generated by the renderer at draw
   * time and have no flat array form, so this throws for those instead of
   * guessing.
   */
  toArrays(mesh) {
    const data = MESH_DATA.get(mesh);
    if (!data || data.kind !== 'arrays') fail('Opus.Mesh.toArrays', 'mesh', 'a mesh description created by Opus.Mesh.fromArrays or Opus.Mesh.fromGLTF', mesh);
    return { positions: data.positions, normals: data.normals, indices: data.indices, uvs: data.uvs || new Float32Array((data.positions.length / 3) * 2), textureDataURL: data.textureDataURL || null };
  },
});

/** Procedural island creation and matching CPU sampling. */
const Terrain = Object.freeze({
  /** Creates a validated terrain description for `app.createTerrain`. */
  generate(options = {}) {
    validateTerrainOptions(options, 'Opus.Terrain.generate');
    return Object.freeze({ options: { ...options } });
  },
  /** Samples terrain height without mutation. Accepts a terrain handle or its options object. */
  sampleHeight(x, z, terrainOrOptions = {}) {
    finite(x, 'x', 'Opus.Terrain.sampleHeight');
    finite(z, 'z', 'Opus.Terrain.sampleHeight');
    const opts = terrainOrOptions && terrainOrOptions.options ? terrainOrOptions.options : terrainOrOptions;
    validateTerrainOptions(opts, 'Opus.Terrain.sampleHeight');
    const half = (opts.size ?? 22) * 0.5;
    return Math.abs(x) <= half && Math.abs(z) <= half ? islandHeight(x, z, opts) : (opts.oceanFloor ?? -2.4);
  },
  /** Samples the heightfield normal. */
  sampleNormal(x, z, terrainOrOptions = {}) {
    finite(x, 'x', 'Opus.Terrain.sampleNormal');
    finite(z, 'z', 'Opus.Terrain.sampleNormal');
    const opts = terrainOrOptions && terrainOrOptions.options ? terrainOrOptions.options : terrainOrOptions;
    validateTerrainOptions(opts, 'Opus.Terrain.sampleNormal');
    return sampleTerrainNormal(x, z, opts);
  },
});

/** Animated water creation and exact visible-wave sampling. */
const Water = Object.freeze({
  /** Creates a validated water description for `app.createWater`. */
  createSurface(options = {}) {
    validateWaterOptions(options, 'Opus.Water.createSurface');
    return Object.freeze({ options: { ...options } });
  },
  /** Returns world-space wave height for a water handle. */
  sampleHeight(water, x, z, time) {
    if (!water || !Array.isArray(water.waves) || !(water.position instanceof Vec3)) fail('Opus.Water.sampleHeight', 'water', 'a water handle returned by app.createWater', water);
    finite(x, 'x', 'Opus.Water.sampleHeight');
    finite(z, 'z', 'Opus.Water.sampleHeight');
    finite(time, 'time', 'Opus.Water.sampleHeight');
    return water.position.y + sampleWaveHeight(water.waves, x - water.position.x, z - water.position.z, time);
  },
  /** Returns surface height, normal, wave intensity, and foam factor. */
  sampleSurface(water, x, z, time) {
    const height = Water.sampleHeight(water, x, z, time);
    const d = 0.05;
    const hx = Water.sampleHeight(water, x + d, z, time) - Water.sampleHeight(water, x - d, z, time);
    const hz = Water.sampleHeight(water, x, z + d, time) - Water.sampleHeight(water, x, z - d, time);
    const normal = new Vec3(-hx / (2 * d), 1, -hz / (2 * d)).normalize();
    const amplitude = water.waves.reduce((sum, wave) => sum + wave.amp, 0) || 1;
    const intensity = Math.min(1, Math.abs(height - water.position.y) / amplitude);
    return { height, normal, intensity, foamFactor: Math.max(0, (height - water.position.y) / amplitude) };
  },
});

/**
 * Wave 6 (Priority C): the CPU skinning-pose sampler, exposed publicly so
 * a skin's pose is inspectable/predictable WITHOUT a live App/WebGL
 * context -- an editor Animation Inspector previewing a clip, an authored
 * tool computing a hitbox from the current pose, or a test asserting exact
 * bend angles, none of which should need a real canvas. `Entity.update`
 * (11-entity.js) calls this exact same function every frame for a live
 * entity -- no second implementation.
 */
const Skin = Object.freeze({
  /** Returns a Float32Array of skin.jointCount*16 floats -- the current bone palette at `time` seconds into `clipIndex` (or the bind pose if `clipIndex` is null/undefined). */
  computePalette(skin, clipIndex, time) {
    optionsObject(skin, 'skin', 'Opus.Skin.computePalette');
    if (!Array.isArray(skin.jointParents) || !Array.isArray(skin.jointLocalBind) || !Array.isArray(skin.inverseBindMatrices) || !Array.isArray(skin.clips)) {
      fail('Opus.Skin.computePalette', 'skin', 'a skin object from Opus.Mesh.toSkinnedArrays(mesh).skin', skin);
    }
    finite(time, 'time', 'Opus.Skin.computePalette');
    return computeSkinPalette(skin, clipIndex, time);
  },
  /**
   * Wave 6B (Priority B): bounded crossfade between exactly two clips --
   * `blend` 0 is fully `clipIndexA`/`timeA`, 1 is fully `clipIndexB`/`timeB`.
   * `Entity.update` calls this exact same function during a live crossfade
   * (see 11-entity.js) -- no second blending implementation.
   */
  computePaletteBlended(skin, clipIndexA, timeA, clipIndexB, timeB, blend) {
    optionsObject(skin, 'skin', 'Opus.Skin.computePaletteBlended');
    if (!Array.isArray(skin.jointParents) || !Array.isArray(skin.jointLocalBind) || !Array.isArray(skin.inverseBindMatrices) || !Array.isArray(skin.clips)) {
      fail('Opus.Skin.computePaletteBlended', 'skin', 'a skin object from Opus.Mesh.toSkinnedArrays(mesh).skin', skin);
    }
    finite(timeA, 'timeA', 'Opus.Skin.computePaletteBlended');
    finite(timeB, 'timeB', 'Opus.Skin.computePaletteBlended');
    finite(blend, 'blend', 'Opus.Skin.computePaletteBlended');
    return computeSkinPaletteBlended(skin, clipIndexA, timeA, clipIndexB, timeB, blend);
  },
  /**
   * Wave 7 (Priority A/Sections 3-4): the bone WORLD-transform query Bone
   * Sockets are built on. Returns an array of `{name, position, rotation,
   * scale}` (one per joint, `position`/`scale` as `Opus.Vec3`, `rotation` as
   * `Opus.Quat`) -- the CURRENT animated pose at `time` seconds into
   * `clipIndex` (or the bind pose if `clipIndex` is null/undefined), sampled
   * from the actual joint hierarchy (never inferred from skinned vertices).
   * These are in the SKIN's own local (bind-root) space, matching
   * `computePalette`'s own convention -- compose with an entity's own
   * `modelMatrix`/`quaternion`/`position` to place a joint in world space,
   * the same "engine gives the data, caller composes it" split every other
   * `Opus.Skin` function already follows. Bounded, entity-agnostic public
   * data -- never a raw WebGL uniform buffer.
   */
  computeJointTransforms(skin, clipIndex, time) {
    optionsObject(skin, 'skin', 'Opus.Skin.computeJointTransforms');
    if (!Array.isArray(skin.jointParents) || !Array.isArray(skin.jointLocalBind) || !Array.isArray(skin.clips)) {
      fail('Opus.Skin.computeJointTransforms', 'skin', 'a skin object from Opus.Mesh.toSkinnedArrays(mesh).skin', skin);
    }
    finite(time, 'time', 'Opus.Skin.computeJointTransforms');
    const clip = clipIndex != null ? skin.clips[clipIndex] : null;
    return sampleClipJointWorldTRS(skin, clip, time);
  },
});

/** Validated collision, raycast, trigger, boundary, and buoyancy utilities. */
const Physics = Object.freeze({
  AABB,
  TriggerVolume,
  sphereSphereIntersect,
  raySphere,
  rayAABB,
  sampleWaveHeight,
  applyBuoyancy,
  resolveTerrainCollision(position, velocity, radius = 0.5, terrainOrOptions = {}) {
    vector(position, 'position', 'Opus.Physics.resolveTerrainCollision');
    vector(velocity, 'velocity', 'Opus.Physics.resolveTerrainCollision');
    positive(radius, 'radius', 'Opus.Physics.resolveTerrainCollision');
    const opts = terrainOrOptions && terrainOrOptions.options ? terrainOrOptions.options : terrainOrOptions;
    validateTerrainOptions(opts, 'Opus.Physics.resolveTerrainCollision');
    return resolveTerrainCollision(position, velocity, radius, opts);
  },
  applyMapBoundary(position, velocity, radius = 0.5, boundaryRadius = 18) {
    vector(position, 'position', 'Opus.Physics.applyMapBoundary');
    vector(velocity, 'velocity', 'Opus.Physics.applyMapBoundary');
    positive(radius, 'radius', 'Opus.Physics.applyMapBoundary');
    positive(boundaryRadius, 'boundaryRadius', 'Opus.Physics.applyMapBoundary');
    if (radius >= boundaryRadius) fail('Opus.Physics.applyMapBoundary', 'radius', 'less than boundaryRadius', radius);
    return applyMapBoundary(position, velocity, radius, boundaryRadius);
  },
  /** Resolves a circular mover against a solid AABB in the XZ plane (Y ignored -- see resolveBoxCollision). */
  resolveBoxCollision(position, velocity, radius, box) {
    vector(position, 'position', 'Opus.Physics.resolveBoxCollision');
    vector(velocity, 'velocity', 'Opus.Physics.resolveBoxCollision');
    positive(radius, 'radius', 'Opus.Physics.resolveBoxCollision');
    if (!(box instanceof AABB)) fail('Opus.Physics.resolveBoxCollision', 'box', 'an Opus.Physics.AABB', box);
    vector(box.min, 'box.min', 'Opus.Physics.resolveBoxCollision');
    vector(box.max, 'box.max', 'Opus.Physics.resolveBoxCollision');
    return resolveBoxCollision(position, velocity, radius, box);
  },
  /** Resolves a mover's vertical extent against a solid AABB's top/bottom faces -- landing on top or bonking the underside. XZ sides are still resolveBoxCollision's job. */
  resolveVerticalBoxCollision(position, velocity, radius, halfHeight, box, dt = 1 / 60) {
    vector(position, 'position', 'Opus.Physics.resolveVerticalBoxCollision');
    vector(velocity, 'velocity', 'Opus.Physics.resolveVerticalBoxCollision');
    positive(radius, 'radius', 'Opus.Physics.resolveVerticalBoxCollision');
    positive(halfHeight, 'halfHeight', 'Opus.Physics.resolveVerticalBoxCollision');
    if (!(box instanceof AABB)) fail('Opus.Physics.resolveVerticalBoxCollision', 'box', 'an Opus.Physics.AABB', box);
    vector(box.min, 'box.min', 'Opus.Physics.resolveVerticalBoxCollision');
    vector(box.max, 'box.max', 'Opus.Physics.resolveVerticalBoxCollision');
    return resolveVerticalBoxCollision(position, velocity, radius, halfHeight, box, dt);
  },
  /**
   * Wave 6 (Priority A): the oriented generalization of resolveBoxCollision
   * -- resolves a circular mover against a box collider that carries its
   * own world rotation (`obb.quat`, an Opus.Quat), not just its axis-aligned
   * bounding footprint. `obb` is `{ center: Vec3, half: Vec3 (half-extents),
   * quat: Opus.Quat | null }`; an absent/null quat degenerates to exactly
   * resolveBoxCollision's own axis-aligned answer. Still XZ-plane-only for
   * the same reason resolveBoxCollision is (see its own comment) -- Y is
   * unaffected by this function either way.
   */
  resolveOrientedBoxCollision(position, velocity, radius, obb) {
    vector(position, 'position', 'Opus.Physics.resolveOrientedBoxCollision');
    vector(velocity, 'velocity', 'Opus.Physics.resolveOrientedBoxCollision');
    positive(radius, 'radius', 'Opus.Physics.resolveOrientedBoxCollision');
    optionsObject(obb, 'obb', 'Opus.Physics.resolveOrientedBoxCollision');
    vector(obb.center, 'obb.center', 'Opus.Physics.resolveOrientedBoxCollision');
    vector(obb.half, 'obb.half', 'Opus.Physics.resolveOrientedBoxCollision');
    if (obb.quat !== undefined && obb.quat !== null && !(obb.quat instanceof Quat)) fail('Opus.Physics.resolveOrientedBoxCollision', 'obb.quat', 'an Opus.Quat, null, or undefined', obb.quat);
    return resolveOrientedBoxCollision(position, velocity, radius, obb);
  },
  /**
   * Wave 6 (Priority A/Section 7): resolves a circular mover against a
   * Sphere Collider, in the XZ plane (Y ignored, same scoping as
   * resolveBoxCollision -- see its own comment for the reasoning).
   */
  resolveSphereCollision(position, velocity, radius, center, colliderRadius) {
    vector(position, 'position', 'Opus.Physics.resolveSphereCollision');
    vector(velocity, 'velocity', 'Opus.Physics.resolveSphereCollision');
    positive(radius, 'radius', 'Opus.Physics.resolveSphereCollision');
    vector(center, 'center', 'Opus.Physics.resolveSphereCollision');
    positive(colliderRadius, 'colliderRadius', 'Opus.Physics.resolveSphereCollision');
    return resolveSphereCollision(position, velocity, radius, center, colliderRadius);
  },
  /**
   * Wave 6 (Priority B/Section 14-15): resolves a mover's vertical extent
   * against a Ramp's own sloped walkable surface -- the direct slope
   * generalization of resolveVerticalBoxCollision's flat top-face landing
   * check. `ramp` is `{ center, half, quat }` (the same oriented-box shape
   * every other Wave 6 collider shares); its LOCAL +X axis is the rise
   * direction, matching Opus.Mesh.wedge()'s own geometry. Deliberately
   * walkable-surface-only -- see the function's own comment in
   * engine/src/20-physics.js for why the ramp's sides/back face are left to
   * whatever solid platform the ramp is authored against, rather than
   * duplicating a second, conflicting box-collision check here.
   */
  resolveRampCollision(position, velocity, radius, halfHeight, ramp, dt = 1 / 60) {
    vector(position, 'position', 'Opus.Physics.resolveRampCollision');
    vector(velocity, 'velocity', 'Opus.Physics.resolveRampCollision');
    positive(radius, 'radius', 'Opus.Physics.resolveRampCollision');
    positive(halfHeight, 'halfHeight', 'Opus.Physics.resolveRampCollision');
    optionsObject(ramp, 'ramp', 'Opus.Physics.resolveRampCollision');
    vector(ramp.center, 'ramp.center', 'Opus.Physics.resolveRampCollision');
    vector(ramp.half, 'ramp.half', 'Opus.Physics.resolveRampCollision');
    if (ramp.quat !== undefined && ramp.quat !== null && !(ramp.quat instanceof Quat)) fail('Opus.Physics.resolveRampCollision', 'ramp.quat', 'an Opus.Quat, null, or undefined', ramp.quat);
    return resolveRampCollision(position, velocity, radius, halfHeight, ramp, dt);
  },
});

/** Engine instance returned by `Opus.create`. */
class App {
  /** Maximum Point/Spot lights rendered simultaneously (see createLight). */
  static MAX_LIGHTS = 8;

  /** Creates an isolated engine instance around one canvas. */
  constructor(canvas, config = {}) {
    canvasElement(canvas, 'Opus.create');
    optionsObject(config, 'config', 'Opus.create');
    this.canvas = canvas;
    this.settings = new SettingsManager(config.settingsNamespace ?? 'doengine:settings', { quality: 'high', muted: false, ...config.defaultSettings });
    this.save = new SaveSystem(config.saveNamespace ?? 'doengine:save');
    this.audio = new AudioEngine();
    this.audio.setMuted(!!this.settings.get('muted'));

    const highQuality = this.settings.get('quality') !== 'low';
    this._qualitySettings = { dprCap: highQuality ? (config.dprCap ?? 2) : 1 };
    positive(this._qualitySettings.dprCap, 'config.dprCap', 'Opus.create');
    const context = initGL(canvas, this._qualitySettings);
    this._gl = context.gl;
    this._context = context;
    this._renderer = new Renderer(this._gl);
    this.camera = new Camera();
    this.input = new Input(canvas);
    this.scene = new Scene();
    this.scene._onAdd = (entity) => this._prepareEntity(entity);
    this.hud = config.hud === false ? null : new HUD();
    this.paused = false;
    this.destroyed = false;
    this._lightDir = new Vec3(-0.5, -1.0, -0.3);
    // Bounded Directional Shadows (Wave 5, Priority H) -- disabled by
    // default so every project saved before this feature exists (all 13
    // shipped stress games, Crate Run) renders and performs identically;
    // App.configureShadows({enabled:true}) opts in per-project.
    this._shadowsEnabled = false;
    this._shadowDistance = 30;
    this._shadowBias = 0.0025;
    this._terrains = [];
    this._waters = [];
    this._emitters = [];
    this._lights = [];
    this._lightsOverLimitWarned = false;
    this._callbacks = [];
    this._gpuMeshes = new Set();
    this._meshCache = new Map();
    this._gpuTextures = new Set();
    this._pendingScreenshot = false;
    this._pauseCallbacks = [];
    this._elapsed = 0;

    if (this.hud) {
      this.hud.setQualityLabel(highQuality ? 'High' : 'Low');
      this.hud.setSoundLabel(!this.settings.get('muted'));
      this._wireHud();
    }

    this._loop = new GameLoop(
      (dt, elapsed) => {
        if (!this.paused) {
          this._elapsed += dt;
          this.camera.update(this.input, dt);
          this.scene.update(dt);
          for (const emitter of this._emitters) emitter.update(dt);
          for (const fn of this._callbacks) fn(dt, this._elapsed);
        }
        if (this.hud) this.hud.reportFrame(dt);
        this.audio.updateListener(this.camera);
      },
      () => this._render()
    );

    this._unlockAudio = () => {
      this.audio.resume();
      window.removeEventListener('pointerdown', this._unlockAudio);
      window.removeEventListener('keydown', this._unlockAudio);
    };
    window.addEventListener('pointerdown', this._unlockAudio);
    window.addEventListener('keydown', this._unlockAudio);
    this._escape = (event) => {
      if (event.code === 'Escape') this.paused ? this.resume() : this.pause();
    };
    window.addEventListener('keydown', this._escape);
    if (config.autoStart !== false) this.start();
  }

  _wireHud() {
    this.hud.onPauseToggle(() => this.paused ? this.resume() : this.pause());
    this.hud.onQualityToggle(() => {
      const high = this._qualitySettings.dprCap <= 1;
      this._qualitySettings.dprCap = high ? 2 : 1;
      this.settings.set('quality', high ? 'high' : 'low');
      this.hud.setQualityLabel(high ? 'High' : 'Low');
      this.resize();
    });
    this.hud.onSoundToggle(() => {
      const muted = !this.audio.muted;
      this.audio.setMuted(muted);
      this.settings.set('muted', muted);
      this.hud.setSoundLabel(!muted);
    });
    this.hud.onScreenshot(() => this.screenshot());
    this.hud.onSave(() => {
      this.save.save('quick', this.scene.entities.map((entity) => ({ position: [entity.position.x, entity.position.y, entity.position.z], rotationY: entity.rotationY })));
      this.hud.showStatus('Scene status saved');
    });
    this.hud.onLoad(() => {
      const state = this.save.load('quick');
      if (Array.isArray(state)) state.forEach((item, index) => {
        const entity = this.scene.entities[index];
        if (entity && item && Array.isArray(item.position)) entity.position.set(...item.position);
        if (entity && Number.isFinite(item.rotationY)) entity.rotationY = item.rotationY;
      });
      this.hud.showStatus(state ? 'Scene status loaded' : 'No saved scene status');
    });
  }

  _alive(method) {
    if (this.destroyed) fail(`App.${method}`, 'App', 'not destroyed', this);
  }

  _makeRenderMesh(description) {
    if (this._meshCache.has(description)) return this._meshCache.get(description);
    const data = MESH_DATA.get(description);
    if (!data) fail('App.addEntity', 'options.mesh', 'a mesh returned by Opus.Mesh', description);
    let mesh;
    if (data.kind === 'cube') mesh = createCubeMesh(this._gl);
    else if (data.kind === 'plane') mesh = createPlaneMesh(this._gl);
    else if (data.kind === 'grid') mesh = createGridMesh(this._gl, data.size, data.segments);
    else if (data.kind === 'skinned') mesh = createMeshFromArrays(this._gl, data.positions, data.normals, data.indices, data.uvs, data.joints, data.weights);
    else mesh = createMeshFromArrays(this._gl, data.positions, data.normals, data.indices, data.uvs);
    this._gpuMeshes.add(mesh);
    this._meshCache.set(description, mesh);
    return mesh;
  }

  _destroyMesh(mesh) {
    const gl = this._gl;
    (mesh.resources || []).forEach((resource, index) => {
      if (index === 0) gl.deleteVertexArray(resource);
      else gl.deleteBuffer(resource);
    });
    this._gpuMeshes.delete(mesh);
  }

  _prepareEntity(entity) {
    if (!(entity instanceof Entity)) fail('Scene.add', 'entity', 'an Opus.Entity', entity);
    vector(entity.position, 'entity.position', 'Scene.add');
    vector(entity.scale, 'entity.scale', 'Scene.add');
    if (!MESH_DATA.has(entity.mesh)) fail('Scene.add', 'entity.mesh', 'a mesh returned by Opus.Mesh', entity.mesh);
    if (!ENTITY_MESHES.has(entity)) ENTITY_MESHES.set(entity, this._makeRenderMesh(entity.mesh));
  }

  // Bounded Directional Shadows (Wave 5, Priority H): the shadow box is
  // centered on the camera's own eye, not the whole scene -- "bounded"
  // means a fixed-size box that follows the player, not a scene-spanning
  // cascade. `up` falls back to +Z only in the (rare, authoring-error-ish)
  // case the sun points nearly straight up/down, where +Y would be
  // parallel to the light direction and Mat4.lookAt's cross product would
  // degenerate.
  _buildShadowInfo() {
    const center = this.camera.eye;
    const dist = this._shadowDistance;
    const dirN = this._lightDir.normalize();
    const up = Math.abs(dirN.dot(new Vec3(0, 1, 0))) > 0.99 ? new Vec3(0, 0, 1) : new Vec3(0, 1, 0);
    const lightEye = center.sub(dirN.scale(dist * 2));
    const view = Mat4.lookAt(lightEye, center, up);
    const proj = Mat4.orthographic(-dist, dist, -dist, dist, 0.1, dist * 4);
    return { enabled: true, lightViewProj: Mat4.multiply(proj, view), bias: this._shadowBias, center };
  }

  _render() {
    this.resize();
    const aspect = this.canvas.width / Math.max(this.canvas.height, 1);
    let shadowInfo = null;
    if (this._shadowsEnabled) {
      shadowInfo = this._buildShadowInfo();
      const casters = this.scene.entities.filter((e) =>
        e.visible && !e.unlit && (e.alpha ?? 1) >= 1 && e.castShadow !== false &&
        getEntityRenderMesh(e) && shadowInfo.center.sub(e.position).length() <= this._shadowDistance
      );
      this._renderer.renderShadowPass(shadowInfo.lightViewProj, casters);
    }
    // Priority I: a disabled light (light.enabled === false) is filtered out
    // here, at the single point every render path already reads `_lights`
    // through -- both renderScene (entities) and renderTerrain read the
    // exact same filtered array, so they can never disagree about which
    // lights are currently active.
    const activeLights = this._lights.filter((l) => l.enabled);
    this._renderer.renderScene(this.camera, aspect, this.scene, this._lightDir, activeLights, shadowInfo);
    for (const terrain of this._terrains) this._renderer.renderTerrain(this.camera, aspect, terrain, this._lightDir, activeLights, shadowInfo);
    for (const water of this._waters) this._renderer.renderWater(this.camera, aspect, water, this._elapsed, this._lightDir);
    const particles = [];
    for (const emitter of this._emitters) emitter.appendRenderData(particles);
    this._renderer.renderParticles(this.camera, aspect, particles);
    if (this._pendingScreenshot) {
      this._pendingScreenshot = false;
      captureScreenshot(this.canvas, this._screenshotFilename);
      this._screenshotFilename = undefined;
      if (this.hud) this.hud.showStatus('Screenshot saved');
    }
  }

  /** Creates and adds an Entity. */
  addEntity(options) {
    this._alive('addEntity');
    optionsObject(options, 'options', 'App.addEntity');
    if (!MESH_DATA.has(options.mesh)) fail('App.addEntity', 'options.mesh', 'a mesh returned by Opus.Mesh', options.mesh);
    if (options.position !== undefined) vector(options.position, 'options.position', 'App.addEntity');
    if (options.scale !== undefined) vector(options.scale, 'options.scale', 'App.addEntity');
    if (options.rotationY !== undefined) finite(options.rotationY, 'options.rotationY', 'App.addEntity');
    const entity = new Entity(options);
    // Wave 6 (Priority C): a mesh from Opus.Mesh.fromSkinnedGLTF carries its
    // rig data on the mesh descriptor itself (MESH_DATA, the same private
    // map every other mesh kind already uses) -- copying it onto the entity
    // here is the ONE place that turns "this entity's mesh happens to be
    // skinned" into "this entity IS animated", so Entity.update and
    // _drawEntity never need to reach back into MESH_DATA themselves.
    const meshData = MESH_DATA.get(options.mesh);
    if (meshData.kind === 'skinned') entity.skin = meshData.skin;
    return this.scene.add(entity);
  }

  /**
   * Uploads a decoded image (HTMLImageElement, HTMLCanvasElement, or
   * ImageBitmap -- anything the caller has already fully decoded/loaded) as
   * a GPU texture and returns an opaque handle usable as `entity.texture`.
   * Bounded, non-PBR: one 2D color texture, no arrays/atlases/render
   * targets. Unlike Opus.Mesh descriptions, a texture handle is NOT
   * cross-App-safe -- it's already GPU-resident in THIS app's context, so
   * loading the same image into a second App means calling this again there.
   */
  createTexture(image) {
    this._alive('createTexture');
    const decoded = (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement)
      || (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement)
      || (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap);
    if (!decoded) fail('App.createTexture', 'image', 'a decoded HTMLImageElement, HTMLCanvasElement, or ImageBitmap', image);
    if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement && (!image.complete || !image.naturalWidth)) {
      fail('App.createTexture', 'image', 'a fully loaded HTMLImageElement (wait for its load event first)', image);
    }
    const handle = createTextureFromImage(this._gl, image);
    this._gpuTextures.add(handle);
    return handle;
  }

  /** Frees a texture handle's GPU memory. Safe to call once; a destroyed handle must not be reused (including on an entity still referencing it). */
  destroyTexture(handle) {
    this._alive('destroyTexture');
    if (!this._gpuTextures.has(handle)) return;
    this._gl.deleteTexture(handle);
    this._gpuTextures.delete(handle);
  }

  /** Creates and renders a procedural terrain handle. */
  createTerrain(options = {}) {
    this._alive('createTerrain');
    const description = Terrain.generate(options);
    const opts = description.options;
    const position = opts.position ? opts.position.clone() : new Vec3();
    const publicTerrain = {
      options: { ...opts },
      position,
      waterLevel: opts.waterLevel ?? -1.6,
      sampleHeight(x, z) { return Terrain.sampleHeight(x - position.x, z - position.z, opts) + position.y; },
      sampleNormal(x, z) { return Terrain.sampleNormal(x - position.x, z - position.z, opts); },
    };
    // Wave 6B (Priority D): `paintLayers` is a direct reference to this
    // terrain's OWN paint-layer metadata (name/color/textureAssetId/
    // uvScale) -- safe to read every frame without going stale, since any
    // change to paint layers goes through the editor's own remove+recreate
    // `regenerateTerrain` (a fresh options object, and therefore a fresh
    // renderTerrain, every time). `layerTextures` is an editor-assigned
    // array of up to 3 GPU texture handles (or null), exposed on the public
    // handle via a live pass-through accessor -- the same "engine just reads
    // whatever's assigned" pattern `entity.texture` already established,
    // since the engine itself has no concept of a Texture Asset Library.
    const renderTerrain = { _mesh: createTerrainMesh(this._gl, opts), position, paintLayers: (opts.paintEdits ? opts.paintEdits.layers : []), layerTextures: [null, null, null] };
    Object.defineProperty(publicTerrain, 'layerTextures', {
      get() { return renderTerrain.layerTextures; },
      set(v) { renderTerrain.layerTextures = v; },
      enumerable: true,
    });
    this._gpuMeshes.add(renderTerrain._mesh);
    this._terrains.push(renderTerrain);
    TERRAIN_RENDER.set(publicTerrain, renderTerrain);
    return publicTerrain;
  }

  /** Removes a terrain created by `createTerrain` and releases its GPU geometry. */
  removeTerrain(handle) {
    this._alive('removeTerrain');
    const renderTerrain = TERRAIN_RENDER.get(handle);
    if (!renderTerrain) fail('App.removeTerrain', 'handle', 'a terrain handle returned by app.createTerrain', handle);
    const index = this._terrains.indexOf(renderTerrain);
    if (index >= 0) this._terrains.splice(index, 1);
    this._destroyMesh(renderTerrain._mesh);
    TERRAIN_RENDER.delete(handle);
  }

  /** Creates and renders animated water with instance sampling helpers. */
  createWater(options = {}) {
    this._alive('createWater');
    const description = Water.createSurface(options);
    const opts = description.options;
    const handle = {
      position: opts.position ? opts.position.clone() : new Vec3(),
      deepColor: opts.deepColor ? opts.deepColor.slice() : [0.03, 0.14, 0.22],
      waves: (opts.waves ?? DEFAULT_WAVES).map((wave) => ({ ...wave, dir: wave.dir.slice() })),
      sampleHeight(x, z, time) { return Water.sampleHeight(handle, x, z, time); },
      sampleSurface(x, z, time) { return Water.sampleSurface(handle, x, z, time); },
    };
    const renderWater = { _mesh: createGridMesh(this._gl, opts.size ?? 34, opts.segments ?? 56), position: handle.position, deepColor: handle.deepColor, waves: handle.waves };
    this._gpuMeshes.add(renderWater._mesh);
    this._waters.push(renderWater);
    WATER_RENDER.set(handle, renderWater);
    return handle;
  }

  /** Removes water created by `createWater` and releases its GPU geometry. */
  removeWater(handle) {
    this._alive('removeWater');
    const renderWater = WATER_RENDER.get(handle);
    if (!renderWater) fail('App.removeWater', 'handle', 'a water handle returned by app.createWater', handle);
    const index = this._waters.indexOf(renderWater);
    if (index >= 0) this._waters.splice(index, 1);
    this._destroyMesh(renderWater._mesh);
    WATER_RENDER.delete(handle);
  }

  /** Creates a capped particle emitter managed by the App. */
  createEmitter(options = {}) {
    this._alive('createEmitter');
    optionsObject(options, 'options', 'App.createEmitter');
    if (options.position !== undefined) vector(options.position, 'options.position', 'App.createEmitter');
    if (options.rate !== undefined) positive(options.rate, 'options.rate', 'App.createEmitter', true);
    if (options.spread !== undefined) positive(options.spread, 'options.spread', 'App.createEmitter', true);
    if (options.maxParticles !== undefined) {
      integer(options.maxParticles, 'options.maxParticles', 'App.createEmitter');
      if (options.maxParticles > MAX_PARTICLES) fail('App.createEmitter', 'options.maxParticles', `a whole number from 1 through ${MAX_PARTICLES}`, options.maxParticles);
    }
    const emitter = new ParticleEmitter(options);
    this._emitters.push(emitter);
    return emitter;
  }

  /** Removes a particle emitter created by `createEmitter`. */
  removeEmitter(emitter) {
    this._alive('removeEmitter');
    const index = this._emitters.indexOf(emitter);
    if (index < 0) fail('App.removeEmitter', 'emitter', 'an emitter returned by app.createEmitter', emitter);
    this._emitters.splice(index, 1);
  }

  /**
   * Creates a placeable Point or Spot light. NOT a physically-based lighting
   * system -- a small, bounded set (see App.MAX_LIGHTS) of simple
   * range-attenuated point/spot lights, additive on top of the one
   * directional sun App.setEnvironment already controlled. The returned
   * handle's properties (position/color/intensity/range/angle/direction)
   * are plain mutable fields, read fresh every frame -- the same
   * "mutate in place, no update() call needed" convention every other
   * live handle in this engine (entities, emitters) already uses.
   */
  createLight(options = {}) {
    this._alive('createLight');
    optionsObject(options, 'options', 'App.createLight');
    if (options.type !== undefined && options.type !== 'point' && options.type !== 'spot') fail('App.createLight', 'options.type', "'point' or 'spot'", options.type);
    if (options.position !== undefined) vector(options.position, 'options.position', 'App.createLight');
    if (options.direction !== undefined) vector(options.direction, 'options.direction', 'App.createLight');
    if (options.intensity !== undefined) positive(options.intensity, 'options.intensity', 'App.createLight', true);
    if (options.range !== undefined) positive(options.range, 'options.range', 'App.createLight');
    if (options.angle !== undefined) positive(options.angle, 'options.angle', 'App.createLight');
    const light = {
      type: options.type === 'spot' ? 'spot' : 'point',
      position: options.position ? options.position.clone() : new Vec3(),
      color: options.color ? [...options.color] : [1, 1, 1],
      intensity: options.intensity ?? 1,
      range: options.range ?? 10,
      angle: options.angle ?? (Math.PI / 6),
      direction: options.direction ? options.direction.clone() : new Vec3(0, -1, 0),
      // Wave 5 (Priority I): a plain mutable flag, same "mutate in place"
      // convention as every other field here -- toggling a light off
      // without destroying/recreating its handle (and therefore without
      // losing its position/color/etc configuration) was previously only
      // possible via removeLight + a fresh createLight.
      enabled: options.enabled !== false,
    };
    this._lights.push(light);
    // Bounded, predictable overflow behavior rather than a silent visual cap
    // a designer would have no way to discover: the renderer only ever
    // uploads the first MAX_LIGHTS (insertion order), and the FIRST time a
    // scene exceeds that, one console warning fires -- not one per light
    // per frame, which would flood the console on every subsequent draw.
    if (this._lights.length > App.MAX_LIGHTS && !this._lightsOverLimitWarned) {
      this._lightsOverLimitWarned = true;
      console.warn(`Opus: ${this._lights.length} lights placed, but only the first ${App.MAX_LIGHTS} are rendered simultaneously (App.MAX_LIGHTS). Remove an earlier light to let a later one take effect.`);
    }
    return light;
  }

  /** Removes a light created by `createLight`. */
  removeLight(light) {
    this._alive('removeLight');
    const index = this._lights.indexOf(light);
    if (index < 0) fail('App.removeLight', 'light', 'a light returned by app.createLight', light);
    this._lights.splice(index, 1);
    if (this._lights.length <= App.MAX_LIGHTS) this._lightsOverLimitWarned = false;
  }

  /** Registers a per-frame callback and returns an unsubscribe function. */
  onUpdate(fn) {
    this._alive('onUpdate');
    callback(fn, 'handler', 'App.onUpdate');
    this._callbacks.push(fn);
    return () => {
      const index = this._callbacks.indexOf(fn);
      if (index >= 0) this._callbacks.splice(index, 1);
    };
  }

  /** Registers a pause-state callback and returns an unsubscribe function. */
  onPauseChange(fn) {
    this._alive('onPauseChange');
    callback(fn, 'handler', 'App.onPauseChange');
    this._pauseCallbacks.push(fn);
    return () => {
      const index = this._pauseCallbacks.indexOf(fn);
      if (index >= 0) this._pauseCallbacks.splice(index, 1);
    };
  }

  /** Starts rendering; an optional callback is registered before starting. */
  start(update) {
    this._alive('start');
    if (update !== undefined) this.onUpdate(update);
    this._loop.start();
    return this;
  }

  /** Pauses simulation while rendering and input listeners remain active. */
  pause() {
    this._alive('pause');
    if (this.paused) return;
    this.paused = true;
    if (this.hud) this.hud.setPaused(true);
    this.audio.stopEngineHum();
    for (const fn of this._pauseCallbacks) fn(true);
  }

  /** Resumes simulation. */
  resume() {
    this._alive('resume');
    if (!this.paused) return;
    this.paused = false;
    if (this.hud) this.hud.setPaused(false);
    for (const fn of this._pauseCallbacks) fn(false);
  }

  /**
   * Sets one or more environment/lighting properties (all optional --
   * unspecified ones keep their current value). `lightDir` is the sun's
   * direction (unnormalized is fine, same as the renderer's own default);
   * `skyTop`/`skyHorizon`/`groundColor`/`sunColor` are [r,g,b] arrays (0-1
   * range expected, not enforced); `fogDensity` a non-negative number
   * (0 disables fog). `skyHorizon` also doubles as the fog color, matching
   * how the renderer already blends fog into the horizon.
   */
  setEnvironment(options = {}) {
    this._alive('setEnvironment');
    optionsObject(options, 'options', 'App.setEnvironment');
    if (options.lightDir !== undefined) { vector(options.lightDir, 'options.lightDir', 'App.setEnvironment'); this._lightDir = options.lightDir; }
    if (options.skyTop !== undefined) { colorArray(options.skyTop, 'options.skyTop', 'App.setEnvironment'); this._renderer.skyTop = options.skyTop; }
    if (options.skyHorizon !== undefined) { colorArray(options.skyHorizon, 'options.skyHorizon', 'App.setEnvironment'); this._renderer.skyHorizon = options.skyHorizon; }
    if (options.groundColor !== undefined) { colorArray(options.groundColor, 'options.groundColor', 'App.setEnvironment'); this._renderer.groundColor = options.groundColor; }
    if (options.sunColor !== undefined) { colorArray(options.sunColor, 'options.sunColor', 'App.setEnvironment'); this._renderer.sunColor = options.sunColor; }
    if (options.fogDensity !== undefined) { positive(options.fogDensity, 'options.fogDensity', 'App.setEnvironment', true); this._renderer.fogDensity = options.fogDensity; }
    // Wave 6 (Priority H): an optional equirectangular panorama, folded
    // into the SAME environment round-trip every other sky/lighting field
    // already uses -- `skyTexture` is a GPU texture handle from
    // `app.createTexture` (or `null` to fall back to the procedural
    // gradient sky, the pre-Priority-H default every project already has).
    if (options.skyTexture !== undefined) {
      if (options.skyTexture !== null && !this._gpuTextures.has(options.skyTexture)) fail('App.setEnvironment', 'options.skyTexture', 'a texture handle from App.createTexture, or null', options.skyTexture);
      this._renderer.skyTexture = options.skyTexture;
    }
    // Folded in here (not a separate save/load path) so a level's shadow
    // configuration travels through the ONE existing environment round-trip
    // (syncCurrentLevelObjects/applyLevelEnvironment) every other
    // environment field already uses -- see configureShadows for the
    // options shape.
    if (options.shadows !== undefined) this.configureShadows(options.shadows);
  }

  /** Returns the current environment/lighting properties (see setEnvironment). */
  getEnvironment() {
    this._alive('getEnvironment');
    return {
      lightDir: this._lightDir,
      shadows: this.getShadowConfig(),
      skyTop: this._renderer.skyTop,
      skyHorizon: this._renderer.skyHorizon,
      groundColor: this._renderer.groundColor,
      sunColor: this._renderer.sunColor,
      fogDensity: this._renderer.fogDensity,
      skyTexture: this._renderer.skyTexture || null,
    };
  }

  /**
   * Configures the single bounded directional-light (sun) shadow map --
   * Point/Spot lights never cast shadows, deliberately. Disabled by
   * default (`enabled: false`), so calling this is the explicit opt-in;
   * every project saved before this feature existed renders and performs
   * identically until a scene calls it. `resolution` is the shadow map's
   * square texture size in pixels (default 1024); `distance` is the half-
   * size, in world units, of the fixed box centered on the camera that
   * casters/receivers are computed within (default 30 -- bounded, not a
   * scene-spanning cascade); `bias` nudges the depth comparison to avoid
   * shadow acne (default 0.0025). A per-entity `castShadow: false` opts an
   * individual entity out of casting (e.g. small debris); unlit and
   * transparent entities never cast, matching how they already skip
   * regular lighting.
   */
  configureShadows(options = {}) {
    this._alive('configureShadows');
    optionsObject(options, 'options', 'App.configureShadows');
    if (options.enabled !== undefined) this._shadowsEnabled = !!options.enabled;
    if (options.resolution !== undefined) { positive(options.resolution, 'options.resolution', 'App.configureShadows'); this._renderer.setShadowResolution(options.resolution); }
    if (options.distance !== undefined) { positive(options.distance, 'options.distance', 'App.configureShadows'); this._shadowDistance = options.distance; }
    if (options.bias !== undefined) { finite(options.bias, 'options.bias', 'App.configureShadows'); this._shadowBias = options.bias; }
  }

  /** Returns the current shadow configuration (see configureShadows). */
  getShadowConfig() {
    this._alive('getShadowConfig');
    return { enabled: this._shadowsEnabled, resolution: this._renderer._shadowSize, distance: this._shadowDistance, bias: this._shadowBias };
  }

  /** Resizes the drawing buffer to the displayed canvas size. */
  resize() { this._alive('resize'); this._context.resize(); }

  /**
   * Sets the device-pixel-ratio render quality ('high' or 'low') and
   * resizes immediately -- the same effect the opt-in Opus.HUD's own
   * quality toggle already had internally, now reachable without that HUD
   * (e.g. from a custom Pause Menu). Persists via `this.settings` so it's
   * remembered on the next `Opus.create()` too, same as the HUD toggle.
   */
  setQuality(level) {
    this._alive('setQuality');
    if (level !== 'high' && level !== 'low') fail('App.setQuality', 'level', "'high' or 'low'", level);
    this._qualitySettings.dprCap = level === 'low' ? 1 : 2;
    this.settings.set('quality', level);
    this.resize();
  }

  /** Queues a PNG capture immediately after the next rendered frame. */
  screenshot(filename) {
    this._alive('screenshot');
    if (filename !== undefined && typeof filename !== 'string') fail('App.screenshot', 'filename', 'a string', filename);
    this._pendingScreenshot = true;
    this._screenshotFilename = filename;
  }

  /** Stops all owned work and releases listeners, audio, DOM, scene, particles, and GPU resources. */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this._loop.stop();
    window.removeEventListener('pointerdown', this._unlockAudio);
    window.removeEventListener('keydown', this._unlockAudio);
    window.removeEventListener('keydown', this._escape);
    this.input.destroy();
    this._context.destroy();
    this.audio.destroy();
    if (this.hud) this.hud.destroy();
    for (const emitter of this._emitters) emitter.destroy();
    const gl = this._gl;
    for (const mesh of this._gpuMeshes) (mesh.resources || []).forEach((resource, index) => {
      if (index === 0) gl.deleteVertexArray(resource);
      else gl.deleteBuffer(resource);
    });
    for (const texture of this._gpuTextures) gl.deleteTexture(texture);
    this._renderer.destroy();
    this.scene.clear();
    this.scene._onAdd = null;
    this._terrains.length = this._waters.length = this._emitters.length = this._callbacks.length = this._pauseCallbacks.length = 0;
    this._gpuMeshes.clear();
    this._meshCache.clear();
    this._gpuTextures.clear();
  }
}

/** Single supported browser namespace. */
const Opus = Object.freeze({
  VERSION: '0.1.0',
  Vec3,
  Quat,
  Mat4,
  Scene,
  Entity,
  Camera,
  Mesh,
  Terrain,
  Water,
  ParticleEmitter,
  Physics,
  Skin,
  AudioEngine,
  Input,
  HUD,
  SettingsManager,
  SaveSystem,
  App,
  /** Creates a zero-configuration WebGL2 App. */
  create(canvas, config = {}) { return new App(canvas, config); },
  /** Immediately downloads a canvas PNG; prefer `app.screenshot()` during a running loop. */
  screenshot(canvas, filename) {
    canvasElement(canvas, 'Opus.screenshot');
    if (filename !== undefined && typeof filename !== 'string') fail('Opus.screenshot', 'filename', 'a string', filename);
    return captureScreenshot(canvas, filename);
  },
});
