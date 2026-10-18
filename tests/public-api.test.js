const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const bundle = fs.readFileSync(path.join(ROOT, 'dist', 'opus-engine.js'), 'utf8');

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      if (listeners.has(type)) listeners.get(type).delete(handler);
    },
    dispatch(type, event = {}) {
      for (const handler of [...(listeners.get(type) || [])]) handler(event);
    },
    listenerCount(type) {
      return (listeners.get(type) || new Set()).size;
    },
  };
}

const storage = new Map();
const localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); },
  clear() { storage.clear(); },
  // Real Storage also exposes `.length` and `.key(i)` (SaveSystem.list, in
  // particular, needs both to enumerate slots) -- this mock previously only
  // covered getItem/setItem/removeItem/clear.
  get length() { return storage.size; },
  key(i) { return Array.from(storage.keys())[i] ?? null; },
};
const windowTarget = eventTarget();
const documentTarget = Object.assign(eventTarget(), { hidden: false });
// Share typed-array constructors with the host so public `instanceof` validation
// sees the test data exactly as it would in one browser realm. atob/TextDecoder/
// DataView/ArrayBuffer/Uint8Array/Uint32Array are needed by the glTF importer
// (engine/src/21-gltf.js), which vm.runInNewContext otherwise wouldn't provide
// since it's a genuinely separate realm from Node's own globals.
const context = {
  window: windowTarget,
  document: documentTarget,
  localStorage,
  Float32Array,
  Uint16Array,
  Uint32Array,
  Uint8Array,
  DataView,
  ArrayBuffer,
  TextDecoder,
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
};
vm.runInNewContext(bundle, context, { filename: 'dist/opus-engine.js' });

const Opus = context.window.Opus;
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok ${passed} - ${name}`);
  } catch (error) {
    failed++;
    console.error(`not ok - ${name}`);
    console.error(error.stack || error);
  }
}

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

function vecClose(actual, expected, epsilon = 1e-6) {
  close(actual.x, expected[0], epsilon);
  close(actual.y, expected[1], epsilon);
  close(actual.z, expected[2], epsilon);
}

test('exports the documented version and public systems', () => {
  assert.strictEqual(Opus.VERSION, '0.1.0');
  for (const name of ['Vec3', 'Quat', 'Mat4', 'Mesh', 'Terrain', 'Water', 'Physics']) {
    assert.ok(Opus[name], `missing Opus.${name}`);
  }
});

test('Vec3 arithmetic is immutable and numerically correct', () => {
  const a = new Opus.Vec3(1, 2, 3);
  const b = new Opus.Vec3(4, -1, 2);
  vecClose(a.add(b), [5, 1, 5]);
  vecClose(a.sub(b), [-3, 3, 1]);
  vecClose(a.scale(2), [2, 4, 6]);
  assert.strictEqual(a.dot(b), 8);
  vecClose(a.cross(b), [7, 10, -9]);
  vecClose(a, [1, 2, 3]);
});

test('Vec3 normalization and interpolation handle edge cases', () => {
  vecClose(new Opus.Vec3().normalize(), [0, 0, 0]);
  close(new Opus.Vec3(3, 4, 0).normalize().length(), 1);
  vecClose(Opus.Vec3.lerp(new Opus.Vec3(0, 2, 4), new Opus.Vec3(10, 4, 0), 0.25), [2.5, 2.5, 3]);
  assert.throws(() => new Opus.Vec3(NaN, 0, 0), /must be a number/);
});

test('Mat4 identity and composition preserve expected transforms', () => {
  const identity = Opus.Mat4.identity();
  const translation = Opus.Mat4.compose(
    new Opus.Vec3(2, 3, 4),
    0,
    new Opus.Vec3(1, 1, 1)
  );
  const product = Opus.Mat4.multiply(identity, translation).m;
  close(product[0], 1);
  close(product[5], 1);
  close(product[10], 1);
  close(product[12], 2);
  close(product[13], 3);
  close(product[14], 4);
  close(product[15], 1);
  assert.throws(() => Opus.Mat4.perspective(1, 1, 10, 1), /less than far/);
});

// Wave 5 (Priority H): the shadow map's box projection. A point exactly at
// the box's near-center-bottom-left corner must map to clip-space (-1,-1,-1)
// and the far-center-top-right corner to (1,1,1) -- the standard orthographic
// contract -- and it must reject a degenerate near>=far range the same way
// Mat4.perspective already does, for the same reason (a shadow pass fed a
// broken projection would silently render nothing rather than erroring).
test('Mat4.orthographic maps a bounded box to clip space and validates its range', () => {
  const proj = Opus.Mat4.orthographic(-10, 10, -10, 10, 1, 21);
  const corner = Opus.Mat4.multiply(proj, Opus.Mat4.translation(new Opus.Vec3(-10, -10, -1))).m;
  close(corner[12], -1);
  close(corner[13], -1);
  close(corner[14], -1);
  const farCorner = Opus.Mat4.multiply(proj, Opus.Mat4.translation(new Opus.Vec3(10, 10, -21))).m;
  close(farCorner[12], 1);
  close(farCorner[13], 1);
  close(farCorner[14], 1);
  assert.throws(() => Opus.Mat4.orthographic(-1, 1, -1, 1, 10, 1), /less than far/);
});

// Wave 5: full XYZ orientation via quaternion, layered on top of the
// pre-existing Y-only rotation path without replacing it. The critical
// property under test is bit-exact backward compatibility: a pure-Y
// quaternion must render IDENTICALLY to the old Mat4.rotationY path, or
// every project built before Wave 5 would visually shift on load.
test('Quat composes full XYZ orientation and stays bit-exact with legacy Y-only rotation', () => {
  // A pure-yaw quaternion's render matrix must be bit-identical to the old
  // rotationY-only path -- this is what makes every pre-Wave-5 project
  // render pixel-identically after the quaternion refactor.
  const yaw = 0.5;
  const fromQuat = Opus.Mat4.fromQuaternion(Opus.Quat.fromAxisAngle(new Opus.Vec3(0, 1, 0), yaw)).m;
  const fromLegacy = Opus.Mat4.rotationY(yaw).m;
  for (let i = 0; i < 16; i++) assert.strictEqual(fromQuat[i], fromLegacy[i], `matrix element ${i} diverged`);

  // Mat4.compose still accepts a plain number (legacy signature) alongside
  // the new Quat path -- every pre-Wave-5 caller keeps working unmodified.
  const composedLegacy = Opus.Mat4.compose(new Opus.Vec3(1, 2, 3), yaw, new Opus.Vec3(1, 1, 1)).m;
  const composedQuat = Opus.Mat4.compose(new Opus.Vec3(1, 2, 3), Opus.Quat.fromAxisAngle(new Opus.Vec3(0, 1, 0), yaw), new Opus.Vec3(1, 1, 1)).m;
  for (let i = 0; i < 16; i++) assert.strictEqual(composedLegacy[i], composedQuat[i], `compose element ${i} diverged`);

  // Euler round-trip (fromEuler -> toEuler) is exact away from the
  // pitch=±90° gimbal-lock singularity every Euler representation shares.
  const euler = Opus.Quat.fromEuler(0.3, 0.7, -0.2).toEuler();
  close(euler.x, 0.3); close(euler.y, 0.7); close(euler.z, -0.2);

  // forward/right/up: a 90° yaw should rotate +Z forward onto +X, matching
  // the sign convention every existing hand-rolled sin/cos forward vector
  // in this codebase (the Hovercraft demo's own steering math) already uses.
  const q90 = Opus.Quat.fromAxisAngle(new Opus.Vec3(0, 1, 0), Math.PI / 2);
  vecClose(q90.rotateVec3(new Opus.Vec3(0, 0, 1)), [1, 0, 0]);

  // Quaternion composition order: rotating 90° about X then 90° about Y
  // should NOT commute with the reverse order -- proves multiply() is a
  // real non-commutative composition, not accidentally always identity-like.
  const qX = Opus.Quat.fromAxisAngle(new Opus.Vec3(1, 0, 0), Math.PI / 2);
  const qY = Opus.Quat.fromAxisAngle(new Opus.Vec3(0, 1, 0), Math.PI / 2);
  const xThenY = qY.multiply(qX).rotateVec3(new Opus.Vec3(0, 0, 1));
  const yThenX = qX.multiply(qY).rotateVec3(new Opus.Vec3(0, 0, 1));
  assert.ok(Math.abs(xThenY.x - yThenX.x) > 0.1 || Math.abs(xThenY.y - yThenX.y) > 0.1, 'quaternion multiply must not be commutative');
});

test('Entity.rotationY stays bit-exact through the quaternion refactor; full orientation is independently settable', () => {
  const entity = new Opus.Entity({ mesh: Opus.Mesh.cube() });
  entity.rotationY = 1;
  assert.strictEqual(entity.rotationY, 1); // bit-exact -- see Entity constructor's own comment on why this can't be trig-derived
  vecClose(entity.forward, [Math.sin(1), 0, Math.cos(1)]);

  // Setting full orientation (pitch+yaw+roll) changes forward/up correctly
  // and .rotationY becomes a best-effort DERIVED yaw, not a promise of
  // pitch/roll round-tripping through it. +pitch (rotation about +X) tips
  // forward DOWN under this engine's convention (was facing +Z, now -Y).
  entity.quaternion = Opus.Quat.fromEuler(Math.PI / 2, 0, 0);
  vecClose(entity.forward, [0, -1, 0]);

  // A legacy Entity built with only rotationY (no quaternion field at all
  // in the constructor options) must render identically to before.
  const legacy = new Opus.Entity({ mesh: Opus.Mesh.cube(), rotationY: 0.8 });
  const fromLegacyEntity = legacy.modelMatrix.m;
  const fromDirectRotationY = Opus.Mat4.compose(new Opus.Vec3(), 0.8, new Opus.Vec3(1, 1, 1)).m;
  for (let i = 0; i < 16; i++) assert.strictEqual(fromLegacyEntity[i], fromDirectRotationY[i], `legacy entity matrix element ${i} diverged`);
});

test('mesh factories return frozen CPU descriptions and validate arrays', () => {
  const cube = Opus.Mesh.cube();
  assert.strictEqual(cube.kind, 'cube');
  assert.ok(Object.isFrozen(cube));
  const custom = Opus.Mesh.fromArrays(
    new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    new Uint16Array([0, 1, 2])
  );
  assert.strictEqual(custom.kind, 'arrays');
  assert.throws(() => Opus.Mesh.grid(10, 255), /1 through 254/);
});

// AUDIT.md finding #2: a crafted accessor claiming an absurd vertex count
// must be rejected before allocating, not after. Also covers the glTF
// happy path (a real, small, valid model) and the fromGLTF/toArrays
// round-trip the editor's Save/Load depends on for imported meshes.
test('glTF import rejects unreasonable accessor counts before allocating, and round-trips real geometry', () => {
  const triangle = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const indices = new Uint16Array([0, 1, 2]);
  const posB64 = Buffer.from(triangle.buffer).toString('base64');
  const normB64 = Buffer.from(normals.buffer).toString('base64');
  const idxB64 = Buffer.from(indices.buffer).toString('base64');
  const combined = Buffer.concat([Buffer.from(triangle.buffer), Buffer.from(normals.buffer), Buffer.from(indices.buffer)]).toString('base64');

  const validGltf = JSON.stringify({
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, mode: 4 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: triangle.byteLength },
      { buffer: 0, byteOffset: triangle.byteLength, byteLength: normals.byteLength },
      { buffer: 0, byteOffset: triangle.byteLength + normals.byteLength, byteLength: indices.byteLength },
    ],
    buffers: [{ byteLength: triangle.byteLength + normals.byteLength + indices.byteLength, uri: `data:application/octet-stream;base64,${combined}` }],
  });

  const mesh = Opus.Mesh.fromGLTF(validGltf);
  assert.strictEqual(mesh.kind, 'arrays');
  const arrays = Opus.Mesh.toArrays(mesh);
  assert.strictEqual(arrays.positions.length, 9);
  assert.strictEqual(arrays.indices.length, 3);
  // No TEXCOORD_0/material in this file -- uvs still comes back zero-filled
  // and aligned to vertex count (not omitted), textureDataURL stays null.
  assert.strictEqual(arrays.uvs.length, 6);
  assert.ok(arrays.uvs.every((v) => v === 0));
  assert.strictEqual(arrays.textureDataURL, null);
  assert.throws(() => Opus.Mesh.toArrays(Opus.Mesh.cube()), /fromArrays or Opus\.Mesh\.fromGLTF/);

  const hugeCountGltf = JSON.stringify({
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 50000000, type: 'VEC3' },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 12 }, { buffer: 0, byteOffset: 12, byteLength: 6 }],
    buffers: [{ byteLength: 18, uri: `data:application/octet-stream;base64,${posB64}${idxB64}` }],
  });
  assert.throws(() => Opus.Mesh.fromGLTF(hugeCountGltf), /unreasonable count/);
});

test('Opus.Mesh.fromArrays validates and defaults uvs; glTF import extracts real TEXCOORD_0 and an embedded base-color texture', () => {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const indices = new Uint16Array([0, 1, 2]);

  // Omitted uvs -- defaults to zero-filled, aligned to vertex count, not an error.
  const noUv = Opus.Mesh.fromArrays(positions, normals, indices);
  assert.strictEqual(Opus.Mesh.toArrays(noUv).uvs.length, 6);

  // Explicit, correctly-sized uvs round-trip exactly.
  const uvs = new Float32Array([0, 0, 1, 0, 0, 1]);
  const withUv = Opus.Mesh.fromArrays(positions, normals, indices, uvs);
  assert.deepStrictEqual(Array.from(Opus.Mesh.toArrays(withUv).uvs), [0, 0, 1, 0, 0, 1]);

  // Wrong-length uvs is a validation error, not a silent misalignment.
  assert.throws(() => Opus.Mesh.fromArrays(positions, normals, indices, new Float32Array([0, 0])), /uvs/);

  // A real glTF with TEXCOORD_0 and a single-pixel embedded PNG material.
  const triangle = positions;
  const uvData = new Float32Array([0, 0, 1, 0, 0, 1]);
  const onePxPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const posBytes = Buffer.from(triangle.buffer);
  const normBytes = Buffer.from(normals.buffer);
  const idxBytes = Buffer.from(indices.buffer);
  const uvBytes = Buffer.from(uvData.buffer);
  const combined = Buffer.concat([posBytes, normBytes, idxBytes, uvBytes, onePxPng]).toString('base64');

  const texturedGltf = JSON.stringify({
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 3 }, indices: 2, material: 0, mode: 4 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    textures: [{ source: 0 }],
    images: [{ bufferView: 4, mimeType: 'image/png' }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: 3, type: 'SCALAR' },
      { bufferView: 3, componentType: 5126, count: 3, type: 'VEC2' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBytes.length },
      { buffer: 0, byteOffset: posBytes.length, byteLength: normBytes.length },
      { buffer: 0, byteOffset: posBytes.length + normBytes.length, byteLength: idxBytes.length },
      { buffer: 0, byteOffset: posBytes.length + normBytes.length + idxBytes.length, byteLength: uvBytes.length },
      { buffer: 0, byteOffset: posBytes.length + normBytes.length + idxBytes.length + uvBytes.length, byteLength: onePxPng.length },
    ],
    buffers: [{ byteLength: combined.length, uri: `data:application/octet-stream;base64,${combined}` }],
  });

  const texturedMesh = Opus.Mesh.fromGLTF(texturedGltf);
  const texturedArrays = Opus.Mesh.toArrays(texturedMesh);
  assert.deepStrictEqual(Array.from(texturedArrays.uvs), [0, 0, 1, 0, 0, 1]);
  assert.ok(texturedArrays.textureDataURL, 'expected an extracted base-color texture data URL');
  assert.match(texturedArrays.textureDataURL, /^data:image\/png;base64,/);
});

// Wave 6 (Priority C): the deterministic skinned-mesh fixture -- see
// tests/fixtures/build-skinned-fixture.js for exactly what it contains (a
// 10-vertex ribbon rigged to 2 joints, one "Bend" rotation clip). Real
// parsing, real hierarchy walk, real animation sampling, real matrix math --
// nothing about this test is a stub or a mock of the skinning pipeline.
test('skeletal animation: skinned glTF import, joint hierarchy, and CPU pose sampling are all real and correct', () => {
  const fixturePath = path.join(ROOT, 'tests', 'fixtures', 'skinned-bend.gltf');
  const fixtureJSON = fs.readFileSync(fixturePath, 'utf8');
  const mesh = Opus.Mesh.fromSkinnedGLTF(fixtureJSON);
  const data = Opus.Mesh.toSkinnedArrays(mesh);

  // --- Import correctness ---
  assert.strictEqual(data.positions.length / 3, 10, 'expected 10 vertices (5 rows x 2)');
  assert.strictEqual(data.skin.jointCount, 2);
  assert.deepStrictEqual(Array.from(data.skin.jointParents), [-1, 0], 'joint1 (tip) is a child of joint0 (root)');
  assert.strictEqual(data.skin.clips.length, 1);
  assert.strictEqual(data.skin.clips[0].name, 'Bend');
  close(data.skin.clips[0].duration, 1.0);
  // Row 2 (the y=1.0 hinge) is the one authored 50/50 blend row -- vertices 4 and 5.
  assert.deepStrictEqual(Array.from(data.weights.subarray(4 * 4, 4 * 4 + 2)), [0.5, 0.5]);
  // Row 0 (y=0, fully joint0) and row 4 (y=2.0, fully joint1).
  assert.deepStrictEqual(Array.from(data.weights.subarray(0 * 4, 0 * 4 + 2)), [1, 0]);
  assert.deepStrictEqual(Array.from(data.weights.subarray(8 * 4, 8 * 4 + 2)), [1, 0]);
  assert.deepStrictEqual(Array.from(data.joints.subarray(8 * 4, 8 * 4 + 2)), [1, 0], 'row 4 should reference skin-local joint 1');

  // --- Bind pose (t=0, identity rotation): the palette should leave every
  // vertex exactly where it already is -- both joints' skin matrices are
  // identity at the rest pose (joint0 bind=identity; joint1's world bind
  // matrix is its own inverse-bind-matrix's exact inverse by construction).
  const bindPalette = Opus.Skin.computePalette(data.skin, 0, 0);
  assertPaletteIsIdentityAt(bindPalette, 0);
  assertPaletteIsIdentityAt(bindPalette, 1);

  // --- Mid-swing pose (t=0.25, halfway through the first 0-0.5s keyframe
  // span): slerp between identity and a +40deg-around-Z quaternion at
  // alpha=0.5 lands EXACTLY at +20deg around Z (slerp's own defining
  // property for two rotations sharing an axis) -- computed independently
  // here with plain trig, not copied from the engine's own formula, so this
  // genuinely cross-checks the sampler rather than restating it.
  const midPalette = Opus.Skin.computePalette(data.skin, 0, 0.25);
  const angle = 20 * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  // joint0 (root) is never targeted by the Bend clip -- must stay identity
  // at every point in time, not just at t=0.
  assertPaletteIsIdentityAt(midPalette, 0);
  // joint1's skin matrix is "rotate by 20deg around Z, pivoting at (0,1,0)"
  // -- apply it by hand to the tip vertex (local (0.1, 2, 0)) and confirm
  // the sampler's own palette produces the identical result.
  const tipLocal = [0.1, 2, 0];
  const pivotRelative = [tipLocal[0], tipLocal[1] - 1, tipLocal[2]]; // T(0,-1,0)
  const rotated = [pivotRelative[0] * cos - pivotRelative[1] * sin, pivotRelative[0] * sin + pivotRelative[1] * cos, pivotRelative[2]];
  const expectedTip = [rotated[0], rotated[1] + 1, rotated[2]]; // T(0,1,0)
  const actualTip = applyPalette(midPalette, 1, tipLocal);
  vecClose({ x: actualTip[0], y: actualTip[1], z: actualTip[2] }, expectedTip, 1e-5);

  // --- Loop closure: t=1.0 (the clip's own last keyframe) must be
  // identical to t=0 (both are authored as identity rotation) -- proves a
  // clip that ends where it began actually loops seamlessly with no pop.
  const loopPalette = Opus.Skin.computePalette(data.skin, 0, 1.0);
  assertPaletteIsIdentityAt(loopPalette, 0);
  assertPaletteIsIdentityAt(loopPalette, 1);

  // --- Bind-pose fallback: an unspecified/absent clip index returns the
  // rest pose (identity for both joints here), not a thrown error or a
  // stale palette -- the same "no clip = frozen at rest" contract
  // Entity.update's own bind-pose branch relies on.
  const restPalette = Opus.Skin.computePalette(data.skin, null, 0);
  assertPaletteIsIdentityAt(restPalette, 0);
  assertPaletteIsIdentityAt(restPalette, 1);
});

function assertPaletteIsIdentityAt(palette, jointIndex, epsilon = 1e-5) {
  const m = palette.subarray(jointIndex * 16, jointIndex * 16 + 16);
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (let i = 0; i < 16; i++) close(m[i], identity[i], epsilon);
}

// Applies one joint's own 4x4 (column-major) skin matrix from a palette to
// a local-space point -- the exact math the vertex shader itself performs
// for a vertex fully weighted (1.0) to that one joint.
function applyPalette(palette, jointIndex, point) {
  const m = palette.subarray(jointIndex * 16, jointIndex * 16 + 16);
  const [x, y, z] = point;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

test('terrain sampling is deterministic and respects map bounds', () => {
  const opts = { seed: 42, size: 20, radius: 8, amplitude: 1.2, oceanFloor: -3 };
  const first = Opus.Terrain.sampleHeight(1.25, -2.5, opts);
  const second = Opus.Terrain.sampleHeight(1.25, -2.5, { ...opts });
  assert.strictEqual(first, second);
  assert.notStrictEqual(first, Opus.Terrain.sampleHeight(1.25, -2.5, { ...opts, seed: 43 }));
  assert.strictEqual(Opus.Terrain.sampleHeight(11, 0, opts), -3);
  const normal = Opus.Terrain.sampleNormal(1.25, -2.5, opts);
  close(normal.length(), 1);
  assert.ok(normal.y > 0);
});

test('water height and surface sampling agree in world space', () => {
  const water = {
    position: new Opus.Vec3(5, -1.5, -3),
    waves: [
      { dir: [1, 0], freq: 1, speed: 1, amp: 0.2 },
      { dir: [0, 1], freq: 2, speed: -0.5, amp: 0.1 },
      { dir: [1, 1], freq: 0.5, speed: 0.25, amp: 0.05 },
    ],
  };
  close(Opus.Water.sampleHeight(water, 5, -3, 0), -1.5);
  const height = Opus.Water.sampleHeight(water, 6, -2, 1.25);
  const surface = Opus.Water.sampleSurface(water, 6, -2, 1.25);
  close(surface.height, height);
  close(surface.normal.length(), 1);
  assert.ok(surface.intensity >= 0 && surface.intensity <= 1);
  assert.ok(surface.foamFactor >= 0);
});

test('sphere and AABB intersection helpers cover hits and misses', () => {
  const origin = new Opus.Vec3(0, 0, 0);
  const forward = new Opus.Vec3(0, 0, 1);
  assert.strictEqual(Opus.Physics.raySphere(origin, forward, new Opus.Vec3(0, 0, 5), 1), 4);
  assert.strictEqual(Opus.Physics.raySphere(origin, forward, new Opus.Vec3(3, 0, 5), 1), null);
  assert.ok(Opus.Physics.sphereSphereIntersect(origin, 1, new Opus.Vec3(2, 0, 0), 1));
  assert.ok(!Opus.Physics.sphereSphereIntersect(origin, 1, new Opus.Vec3(2.01, 0, 0), 1));

  const box = Opus.Physics.AABB.fromCenterSize(
    new Opus.Vec3(0, 0, 5),
    new Opus.Vec3(2, 2, 2)
  );
  assert.strictEqual(Opus.Physics.rayAABB(origin, forward, box), 4);
  assert.strictEqual(Opus.Physics.rayAABB(origin, new Opus.Vec3(1, 0, 0), box), null);
  assert.ok(box.containsPoint(new Opus.Vec3(1, 1, 4)));
});

test('box collision pushes a mover out along the nearest edge, in the XZ plane only', () => {
  const box = Opus.Physics.AABB.fromCenterSize(new Opus.Vec3(0, 0, 0), new Opus.Vec3(4, 4, 4));
  const radius = 0.5;

  // Approaching from outside, within radius of the nearest face.
  const approaching = Opus.Physics.resolveBoxCollision(
    new Opus.Vec3(2.3, 0, 0), new Opus.Vec3(-1, 0, 0), radius, box,
  );
  assert.ok(approaching.collided);
  assert.ok(approaching.correctedPosition.x > 2.3, 'should be pushed further outside the box, not into it');
  assert.ok(approaching.correctedVelocity.x >= 0, 'inward velocity component should be removed, not left negative');

  // Clear of the box entirely -- no collision, position/velocity unchanged.
  const clear = Opus.Physics.resolveBoxCollision(
    new Opus.Vec3(10, 0, 0), new Opus.Vec3(-1, 0, 0), radius, box,
  );
  assert.strictEqual(clear.collided, false);
  assert.strictEqual(clear.correctedPosition.x, 10);

  // Fully inside (degenerate/clipped-through case) -- pushed out the nearest side, never left stuck inside.
  const inside = Opus.Physics.resolveBoxCollision(
    new Opus.Vec3(1.9, 0, 0), new Opus.Vec3(0, 0, 0), radius, box,
  );
  assert.ok(inside.collided);
  assert.ok(inside.correctedPosition.x > 1.9);

  // Y is ignored entirely -- a mover far above/below in Y still collides based on XZ alone.
  const highAbove = Opus.Physics.resolveBoxCollision(
    new Opus.Vec3(2.3, 50, 0), new Opus.Vec3(-1, 0, 0), radius, box,
  );
  assert.ok(highAbove.collided, 'collision is XZ-only by design; Y is left to terrain/water height sampling');
});

// Wave 6 (Priority A): resolveOrientedBoxCollision generalizes the above to
// a box that carries its own world rotation. The critical property is the
// same kind of bit-exact backward compatibility Wave 5's Quat work
// established: an identity/absent quat must reproduce resolveBoxCollision's
// own answer exactly, and a genuinely rotated box must block a mover along
// its ACTUAL rotated edge, not its axis-aligned bounding footprint.
test('oriented box collision matches the unrotated case exactly and follows real rotation', () => {
  const half = new Opus.Vec3(2, 2, 2);
  const center = new Opus.Vec3(0, 0, 0);
  const radius = 0.5;

  // Identity quat: bit-exact match against resolveBoxCollision's own answer.
  const box = Opus.Physics.AABB.fromCenterSize(center, new Opus.Vec3(4, 4, 4));
  const plain = Opus.Physics.resolveBoxCollision(new Opus.Vec3(2.3, 0, 0), new Opus.Vec3(-1, 0, 0), radius, box);
  const orientedIdentity = Opus.Physics.resolveOrientedBoxCollision(new Opus.Vec3(2.3, 0, 0), new Opus.Vec3(-1, 0, 0), radius, { center, half, quat: Opus.Quat.identity() });
  assert.strictEqual(orientedIdentity.collided, plain.collided);
  assert.ok(Math.abs(orientedIdentity.correctedPosition.x - plain.correctedPosition.x) < 1e-9);
  assert.ok(Math.abs(orientedIdentity.correctedPosition.z - plain.correctedPosition.z) < 1e-9);
  const orientedNull = Opus.Physics.resolveOrientedBoxCollision(new Opus.Vec3(2.3, 0, 0), new Opus.Vec3(-1, 0, 0), radius, { center, half, quat: null });
  assert.ok(Math.abs(orientedNull.correctedPosition.x - plain.correctedPosition.x) < 1e-9, 'a null quat must also degenerate to the exact axis-aligned answer');

  // A non-square "wall" (wide in X, thin in Z) rotated 90 degrees around Y
  // swaps its own footprint dimensions exactly -- an unambiguous,
  // trig-free way to prove the function tracks the box's REAL rotated
  // geometry, not its old axis-aligned footprint. Unrotated, this wall
  // blocks out to x=+-3 (half.x) and z=+-1 (half.z); rotated 90 degrees,
  // it must block out to x=+-1 and z=+-3 instead.
  const wallHalf = new Opus.Vec3(3, 2, 1);
  const rot90 = Opus.Quat.fromAxisAngle(new Opus.Vec3(0, 1, 0), Math.PI / 2);

  // Unrotated: a mover at x=2.7 (inside the OLD x-reach of 3) collides.
  const unrotatedBlocksWide = Opus.Physics.resolveOrientedBoxCollision(
    new Opus.Vec3(3.3, 0, 0), new Opus.Vec3(-1, 0, 0), radius, { center, half: wallHalf, quat: null },
  );
  assert.ok(unrotatedBlocksWide.collided, 'unrotated wall should still block along its wide (x) axis');

  // After a 90-degree rotation, that SAME world x=3.3 point is now well
  // outside the wall's new (swapped-to-thin, half.z-derived) x-reach of 1.
  const rotatedClearOnOldWideAxis = Opus.Physics.resolveOrientedBoxCollision(
    new Opus.Vec3(3.3, 0, 0), new Opus.Vec3(-1, 0, 0), radius, { center, half: wallHalf, quat: rot90 },
  );
  assert.strictEqual(rotatedClearOnOldWideAxis.collided, false, 'a 90-degree-rotated wall must no longer reach as far along world +X as it did unrotated');

  // But it now reaches that same distance along world +Z instead (the
  // dimension that used to be its narrow x-reach is now its wide z-reach).
  const rotatedBlocksNewWideAxis = Opus.Physics.resolveOrientedBoxCollision(
    new Opus.Vec3(0, 0, 3.3), new Opus.Vec3(0, 0, -1), radius, { center, half: wallHalf, quat: rot90 },
  );
  assert.ok(rotatedBlocksNewWideAxis.collided, 'a 90-degree-rotated wall must now block along world +Z with its former wide-axis reach');
});

// Wave 6 (Priority A/Section 7): the Sphere Collider's own resolution --
// same circle-vs-circle math a hazard/pickup/round prop needs, same
// "outside/degenerate-inside/velocity-reflection" structure resolveBoxCollision
// already established.
test('sphere collision pushes a mover out along the center-to-center vector', () => {
  const center = new Opus.Vec3(0, 0, 0);
  const colliderRadius = 2;
  const radius = 0.5;

  const approaching = Opus.Physics.resolveSphereCollision(new Opus.Vec3(2.3, 0, 0), new Opus.Vec3(-1, 0, 0), radius, center, colliderRadius);
  assert.ok(approaching.collided);
  assert.ok(Math.abs(approaching.correctedPosition.length() - (colliderRadius + radius)) < 1e-9, 'must land exactly on the combined-radius boundary');
  assert.ok(approaching.correctedVelocity.x >= 0, 'inward velocity component must be removed');

  const clear = Opus.Physics.resolveSphereCollision(new Opus.Vec3(10, 0, 0), new Opus.Vec3(-1, 0, 0), radius, center, colliderRadius);
  assert.strictEqual(clear.collided, false);

  // Approaching from a different direction (+Z) must push out along +Z, not
  // a fixed axis -- proving the normal genuinely depends on approach angle.
  const fromZ = Opus.Physics.resolveSphereCollision(new Opus.Vec3(0, 0, 2.3), new Opus.Vec3(0, 0, -1), radius, center, colliderRadius);
  assert.ok(fromZ.collided);
  assert.ok(fromZ.correctedPosition.z > 2.3, 'pushed further out along the actual approach axis');
  assert.ok(Math.abs(fromZ.correctedPosition.x) < 1e-9, 'no spurious X displacement from a pure-Z approach');
});

test('continuous collider sweeps stop fast movers and preserve wall-slide velocity', () => {
  const start = new Opus.Vec3(-6, 0, -1);
  const end = new Opus.Vec3(6, 0, 2);
  const velocity = new Opus.Vec3(80, 0, 20);
  const wall = { center: new Opus.Vec3(0, 0, 0), half: new Opus.Vec3(0.1, 2, 5), quat: null };
  assert.strictEqual(Opus.Physics.resolveOrientedBoxCollision(end, velocity, 0.5, wall).collided, false, 'destination-only overlap demonstrates the tunneling setup');
  const boxHit = Opus.Physics.resolveSweptOrientedBoxCollision(start, end, velocity, 0.5, wall);
  assert.ok(boxHit.collided, 'fast segment must hit the thin wall');
  assert.ok(boxHit.correctedPosition.x < -0.59 && boxHit.correctedPosition.x > -0.61, 'mover stops at its expanded contact plane');
  assert.ok(Math.abs(boxHit.correctedVelocity.x) < 1e-9, 'inward wall velocity is removed');
  assert.ok(Math.abs(boxHit.correctedVelocity.z - 20) < 1e-9, 'tangent velocity survives for stable wall sliding');

  const sphereHit = Opus.Physics.resolveSweptSphereCollision(
    new Opus.Vec3(-5, 0, 0), new Opus.Vec3(5, 0, 1), new Opus.Vec3(60, 0, 6), 0.5,
    new Opus.Vec3(0, 0, 0), 0.5,
  );
  assert.ok(sphereHit.collided, 'fast segment must hit an expanded sphere collider');
  assert.ok(sphereHit.correctedPosition.x < 0, 'sphere contact remains on the approach side');

  const rotated = Opus.Physics.resolveSweptOrientedBoxCollision(
    new Opus.Vec3(0, 0, -6), new Opus.Vec3(0, 0, 6), new Opus.Vec3(0, 0, 80), 0.5,
    { center: new Opus.Vec3(0, 0, 0), half: new Opus.Vec3(5, 2, 0.1), quat: Opus.Quat.fromAxisAngle(new Opus.Vec3(0, 1, 0), Math.PI / 4) },
  );
  assert.ok(rotated.collided, 'sweep follows the real orientation of a rotated thin wall');
});

test('vertical box collision lands a falling mover on top and blocks it from rising through the underside', () => {
  const box = Opus.Physics.AABB.fromCenterSize(new Opus.Vec3(0, 2, 0), new Opus.Vec3(4, 2, 4));
  const radius = 0.5;
  const halfHeight = 0.5;

  // Falling straight down, feet just above the box's top face (within the landing tolerance band) -- should snap onto it and zero downward velocity.
  const landing = Opus.Physics.resolveVerticalBoxCollision(
    new Opus.Vec3(0, 3.3, 0), new Opus.Vec3(0, -5, 0), radius, halfHeight, box,
  );
  assert.ok(landing.collided);
  assert.ok(landing.grounded);
  assert.strictEqual(landing.correctedPosition.y, box.max.y + halfHeight);
  assert.strictEqual(landing.correctedVelocity.y, 0);

  // Falling but nowhere near the box in XZ -- no collision at all.
  const missed = Opus.Physics.resolveVerticalBoxCollision(
    new Opus.Vec3(20, 3.3, 0), new Opus.Vec3(0, -5, 0), radius, halfHeight, box,
  );
  assert.strictEqual(missed.collided, false);
  assert.strictEqual(missed.grounded, false);

  // Far above the box, still falling -- outside the landing tolerance band, so it falls straight through (not yanked up).
  const stillFalling = Opus.Physics.resolveVerticalBoxCollision(
    new Opus.Vec3(0, 20, 0), new Opus.Vec3(0, -5, 0), radius, halfHeight, box,
  );
  assert.strictEqual(stillFalling.collided, false);

  // Rising up into the underside -- stopped, not pushed back down through the box.
  const bonk = Opus.Physics.resolveVerticalBoxCollision(
    new Opus.Vec3(0, 0.6, 0), new Opus.Vec3(0, 6, 0), radius, halfHeight, box,
  );
  assert.ok(bonk.collided);
  assert.strictEqual(bonk.grounded, false, 'bonking the underside is not landing');
  assert.strictEqual(bonk.correctedPosition.y, box.min.y - halfHeight);
  assert.strictEqual(bonk.correctedVelocity.y, 0);
});

// Wave 5, Priority E/section 29: re-investigated whether a fast fall at a
// large (lag-spike-sized) dt can tunnel through a thin platform in one
// frame. A real caller integrates position by `velocity*dt` BEFORE calling
// this function every frame, so this test does the same -- one simulated
// frame at a large dt and a high fall speed, checked against a THIN
// platform (a genuine tunneling risk if the check were a fixed-size band
// instead of one that scales with how far the mover actually traveled).
test('vertical box collision does not tunnel through a thin platform at a large dt / high fall speed', () => {
  const thinBox = Opus.Physics.AABB.fromCenterSize(new Opus.Vec3(0, 5, 0), new Opus.Vec3(4, 0.3, 4)); // a thin platform, top at y=5.15
  const radius = 0.5, halfHeight = 0.5;
  const velocity = new Opus.Vec3(0, -40, 0); // a fast fall
  const dt = 0.15; // a real lag-spike-sized frame, not a steady 60fps tick
  // Start just above the platform, integrate one frame the way a real
  // caller does, THEN resolve -- this is the exact sequence
  // updateThirdPersonController/updateFirstPersonController both follow.
  const startPosition = new Opus.Vec3(0, 5.15 + halfHeight + 0.5, 0); // 0.5 units above the surface the mover should land on
  const movedPosition = startPosition.add(velocity.scale(dt)); // would overshoot to y≈-0.35 (well through the 0.3-thick platform) if unresolved
  const result = Opus.Physics.resolveVerticalBoxCollision(movedPosition, velocity, radius, halfHeight, thinBox, dt);
  assert.ok(result.collided, 'a fast fall at a large dt must still be caught, not tunnel through a thin platform');
  assert.ok(result.grounded);
  assert.strictEqual(result.correctedPosition.y, thinBox.max.y + halfHeight);
  assert.strictEqual(result.correctedVelocity.y, 0);
});

test('ramp collision follows the authored slope without discarding horizontal velocity', () => {
  const ramp = { center: new Opus.Vec3(0, 1, 0), half: new Opus.Vec3(4, 1, 2), quat: Opus.Quat.identity() };
  const velocity = new Opus.Vec3(3, -4, 1);
  const result = Opus.Physics.resolveRampCollision(new Opus.Vec3(0, 1.3, 0), velocity, 0.5, 0.5, ramp, 0.1);
  assert.ok(result.collided && result.grounded);
  assert.ok(Math.abs(result.correctedPosition.y - 1.5) < 1e-9, 'mover feet land on the midpoint of the visible slope');
  assert.strictEqual(result.correctedVelocity.y, 0);
  assert.strictEqual(result.correctedVelocity.x, 3);
  assert.strictEqual(result.correctedVelocity.z, 1);
});

test('trigger volumes emit one enter and exit for a swept crossing', () => {
  let enters = 0;
  let exits = 0;
  const trigger = new Opus.Physics.TriggerVolume({
    center: new Opus.Vec3(0, 0, 0),
    radius: 0.5,
    onEnter: () => enters++,
    onExit: () => exits++,
  });
  trigger.update(new Opus.Vec3(2, 0, 0), new Opus.Vec3(-2, 0, 0));
  assert.strictEqual(enters, 1);
  assert.strictEqual(exits, 1);
  assert.strictEqual(trigger.inside, false);
});

// Wave 6 (Priority A/Section 8): a Box-shaped Trigger Volume must actually
// behave as a box (wide flat coverage that a sphere sized off the longest
// edge would either over- or under-cover), including when rotated, and
// must still catch a fast swept crossing in one frame the same way the
// sphere shape already does.
test('box trigger volumes cover their real oriented footprint, not a sphere', () => {
  // A wide, thin, unrotated box trigger (10 x 2 x 2) -- a point at x=4 is
  // well within its real width but far outside what a sphere sized off the
  // box's SHORT (z) edge would cover.
  let enters = 0;
  const wideBox = new Opus.Physics.TriggerVolume({
    center: new Opus.Vec3(0, 0, 0), shape: 'box', half: new Opus.Vec3(5, 1, 1),
    onEnter: () => enters++,
  });
  wideBox.update(new Opus.Vec3(4, 0, 0));
  assert.strictEqual(enters, 1, 'a point well inside the box\'s real wide footprint must trigger Enter');
  assert.strictEqual(wideBox.containsPoint(new Opus.Vec3(4, 0, 0)), true);
  assert.strictEqual(wideBox.containsPoint(new Opus.Vec3(4, 0, 3)), false, 'outside the box\'s real (short) z-extent, even though within a sphere of radius 5');

  // Rotated 90 degrees around Y: the wide/narrow axes swap, same proof
  // pattern as the oriented-box-collision test above.
  let rotEnters = 0;
  const rotatedBox = new Opus.Physics.TriggerVolume({
    center: new Opus.Vec3(0, 0, 0), shape: 'box', half: new Opus.Vec3(5, 1, 1),
    quat: Opus.Quat.fromAxisAngle(new Opus.Vec3(0, 1, 0), Math.PI / 2),
    onEnter: () => rotEnters++,
  });
  assert.strictEqual(rotatedBox.containsPoint(new Opus.Vec3(4, 0, 0)), false, 'after a 90-degree rotation, the former wide (x) axis is now the narrow one');
  assert.strictEqual(rotatedBox.containsPoint(new Opus.Vec3(0, 0, 4)), true, 'the former narrow (z) axis is now the wide one');

  // Swept crossing: a fast pass through a box trigger in one large step
  // must still fire Enter, the same guarantee the sphere shape already has.
  let sweptEnters = 0;
  const sweptBox = new Opus.Physics.TriggerVolume({
    center: new Opus.Vec3(0, 0, 0), shape: 'box', half: new Opus.Vec3(1, 1, 1),
    onEnter: () => sweptEnters++,
  });
  sweptBox.update(new Opus.Vec3(5, 0, 0), new Opus.Vec3(-5, 0, 0));
  assert.strictEqual(sweptEnters, 1, 'a fast one-frame crossing through a box trigger must still be caught');

  // Backward compatibility: omitting `shape` entirely still means sphere.
  const defaultShape = new Opus.Physics.TriggerVolume({ center: new Opus.Vec3(), radius: 1, onEnter: () => {} });
  assert.strictEqual(defaultShape.shape, 'sphere');
});

test('trigger volumes do not duplicate events while state is unchanged', () => {
  let enters = 0;
  let exits = 0;
  const trigger = new Opus.Physics.TriggerVolume({
    center: new Opus.Vec3(),
    radius: 1,
    onEnter: () => enters++,
    onExit: () => exits++,
  });
  trigger.update(new Opus.Vec3(0.5, 0, 0));
  trigger.update(new Opus.Vec3(0.25, 0, 0));
  trigger.update(new Opus.Vec3(2, 0, 0));
  trigger.update(new Opus.Vec3(3, 0, 0));
  assert.strictEqual(enters, 1);
  assert.strictEqual(exits, 1);
});

test('terrain collision corrects penetration on gentle ground', () => {
  const opts = { seed: 7, size: 20, radius: 8, amplitude: 0.01 };
  const height = Opus.Terrain.sampleHeight(0, 0, opts);
  const result = Opus.Physics.resolveTerrainCollision(
    new Opus.Vec3(0, height + 0.25, 0),
    new Opus.Vec3(1, -2, 0),
    0.5,
    opts
  );
  assert.ok(result.collided);
  assert.ok(result.grounded);
  assert.ok(!result.steep);
  close(result.correctedPosition.y, height + 0.5);
  assert.strictEqual(result.correctedVelocity.y, 0);

  const clear = Opus.Physics.resolveTerrainCollision(
    new Opus.Vec3(0, height + 5, 0),
    new Opus.Vec3(0, -1, 0),
    0.5,
    opts
  );
  assert.ok(!clear.collided);
});

test('map boundary warns, corrects overflow, and avoids runaway inward speed', () => {
  const center = Opus.Physics.applyMapBoundary(new Opus.Vec3(), new Opus.Vec3(1, 0, 0), 1, 10);
  assert.ok(!center.warning);
  vecClose(center.correctedPosition, [0, 0, 0]);

  const outside = Opus.Physics.applyMapBoundary(
    new Opus.Vec3(10, 0, 0),
    new Opus.Vec3(2, 0, 0),
    1,
    10
  );
  assert.ok(outside.warning);
  assert.strictEqual(outside.intensity, 1);
  assert.ok(outside.correctedPosition.x < 10);
  assert.ok(outside.correctedVelocity.x < 0);

  const alreadyInward = Opus.Physics.applyMapBoundary(
    new Opus.Vec3(9, 0, 0),
    new Opus.Vec3(-1, 0, 0),
    1,
    10
  );
  assert.strictEqual(alreadyInward.correctedVelocity.x, -1);
});

test('entity updates stop permanently after idempotent destruction', () => {
  const entity = new Opus.Entity({
    mesh: Opus.Mesh.cube(),
    position: new Opus.Vec3(2, 3, 4),
  });
  entity.spin = 2;
  entity.update(0.5);
  assert.strictEqual(entity.rotationY, 1);
  close(entity.modelMatrix.m[12], 2);
  close(entity.modelMatrix.m[13], 3);
  close(entity.modelMatrix.m[14], 4);

  entity.destroy();
  entity.destroy();
  entity.update(1);
  assert.strictEqual(entity.rotationY, 1);
  assert.ok(entity.destroyed);
  assert.strictEqual(entity.visible, false);
});

test('scene removal and clearing destroy their owned entities', () => {
  const scene = new Opus.Scene();
  const first = new Opus.Entity({ mesh: Opus.Mesh.cube() });
  const second = new Opus.Entity({ mesh: Opus.Mesh.plane() });
  assert.strictEqual(scene.add(first), first);
  scene.add(second);
  assert.strictEqual(scene.entities.length, 2);
  assert.strictEqual(scene.remove(first), true);
  assert.ok(first.destroyed);
  assert.strictEqual(scene.remove(first), false);
  assert.throws(() => scene.add(first), /live Opus.Entity/);

  scene.clear();
  assert.strictEqual(scene.entities.length, 0);
  assert.ok(second.destroyed);
  scene.clear();
});

test('particle emitters enforce caps and release all particles', () => {
  const emitter = new Opus.ParticleEmitter({ rate: 0, maxParticles: 2 });
  emitter.emit(5);
  assert.strictEqual(emitter.particles.length, 2);
  emitter.update(0);
  emitter.destroy();
  emitter.destroy();
  assert.strictEqual(emitter.particles.length, 0);
});

test('input consumes transient state and removes every owned listener', () => {
  const target = eventTarget();
  const input = new Opus.Input(target);
  assert.strictEqual(windowTarget.listenerCount('keydown'), 1);
  assert.strictEqual(target.listenerCount('pointermove'), 1);

  windowTarget.dispatch('keydown', { code: 'Space' });
  assert.ok(input.isDown('Space'));
  assert.ok(input.wasPressed('Space'));
  assert.ok(!input.wasPressed('Space'));
  windowTarget.dispatch('keyup', { code: 'Space' });
  assert.ok(!input.isDown('Space'));

  target.dispatch('pointerdown', { clientX: 10, clientY: 20 });
  target.dispatch('pointermove', { clientX: 14, clientY: 17 });
  const drag = input.consumeDrag();
  assert.strictEqual(drag.dx, 4);
  assert.strictEqual(drag.dy, -3);
  const consumedDrag = input.consumeDrag();
  assert.strictEqual(consumedDrag.dx, 0);
  assert.strictEqual(consumedDrag.dy, 0);
  target.dispatch('wheel', { deltaY: 12, preventDefault() {} });
  assert.strictEqual(input.consumeWheel(), 12);
  assert.strictEqual(input.consumeWheel(), 0);

  // Wave 6 (Priority D): mouse buttons join the same key-state Set under
  // synthetic 'Mouse0'/'Mouse1'/'Mouse2' codes, but ONLY for pointerType
  // 'mouse' -- a touch drag (pointerType 'touch') must never be misread as
  // a mouse-button press, since that would fire mouse-bound actions (e.g.
  // Attack rebound to left-click) on every ordinary touch-camera drag.
  target.dispatch('pointerdown', { clientX: 0, clientY: 0, button: 0, pointerType: 'mouse' });
  assert.ok(input.isDown('Mouse0'), 'left mouse button should register as Mouse0');
  assert.ok(input.wasPressed('Mouse0'));
  target.dispatch('pointerup', { button: 0, pointerType: 'mouse' });
  assert.ok(!input.isDown('Mouse0'), 'Mouse0 should release on pointerup');

  target.dispatch('pointerdown', { clientX: 0, clientY: 0, button: 2, pointerType: 'mouse' });
  assert.ok(input.isDown('Mouse2'), 'right mouse button should register as Mouse2');
  target.dispatch('pointerup', { button: 2, pointerType: 'mouse' });
  assert.ok(!input.isDown('Mouse2'));

  target.dispatch('pointerdown', { clientX: 0, clientY: 0, button: 0, pointerType: 'touch' });
  assert.ok(!input.isDown('Mouse0'), 'a touch pointerdown must never register as a mouse button');
  target.dispatch('pointerup', { button: 0, pointerType: 'touch' });

  input.destroy();
  assert.strictEqual(windowTarget.listenerCount('keydown'), 0);
  assert.strictEqual(windowTarget.listenerCount('keyup'), 0);
  assert.strictEqual(windowTarget.listenerCount('blur'), 0);
  assert.strictEqual(target.listenerCount('pointerdown'), 0);
  assert.strictEqual(target.listenerCount('pointermove'), 0);
  assert.strictEqual(target.listenerCount('wheel'), 0);
  assert.strictEqual(documentTarget.listenerCount('visibilitychange'), 0);
});

test('settings persist values and recover from corrupt storage', () => {
  localStorage.clear();
  const settings = new Opus.SettingsManager('test:settings', { quality: 'high', muted: false });
  assert.strictEqual(settings.get('quality'), 'high');
  settings.set('quality', 'low');
  const reloaded = new Opus.SettingsManager('test:settings', { quality: 'high', muted: false });
  assert.strictEqual(reloaded.get('quality'), 'low');
  assert.strictEqual(reloaded.get('muted'), false);

  localStorage.setItem('test:corrupt', '{not json');
  const recovered = new Opus.SettingsManager('test:corrupt', { quality: 'medium' });
  assert.strictEqual(recovered.get('quality'), 'medium');
});

test('save slots round-trip data and handle deletion', () => {
  localStorage.clear();
  const save = new Opus.SaveSystem('test:save');
  assert.strictEqual(save.has('slot-1'), false);
  assert.strictEqual(save.load('slot-1'), null);
  assert.strictEqual(save.save('slot-1', { score: 42, items: ['a', 'b'] }), true);
  assert.strictEqual(save.has('slot-1'), true);
  assert.strictEqual(JSON.stringify(save.load('slot-1')), JSON.stringify({ score: 42, items: ['a', 'b'] }));
  save.delete('slot-1');
  assert.strictEqual(save.has('slot-1'), false);
  assert.throws(() => save.save('', {}), /non-empty string/);
  assert.throws(() => new Opus.SaveSystem('  '), /non-empty string/);
});

test('save slots can be listed, sorted newest-first, and scoped by namespace', () => {
  // Arrays/objects returned from the bundle are created in the vm sandbox's
  // own realm (a separate Array/Object from this test file's), so
  // deepStrictEqual's identity-sensitive checks don't apply across that
  // boundary -- JSON round-tripping sidesteps it, same as the save/load
  // round-trip assertion above already does.
  localStorage.clear();
  const save = new Opus.SaveSystem('test:list');
  const other = new Opus.SaveSystem('test:other');
  assert.strictEqual(JSON.stringify(save.list()), '[]');
  save.save('alpha', { n: 1 });
  save.save('beta', { n: 2 });
  other.save('unrelated', { n: 99 });
  const slots = save.list();
  assert.strictEqual(slots.length, 2, 'a save under a different namespace must not leak into this list');
  assert.ok(slots.every((s) => typeof s.savedAt === 'number'));
  assert.strictEqual(JSON.stringify(slots.map((s) => s.slot).sort()), JSON.stringify(['alpha', 'beta']));
  save.delete('alpha');
  assert.strictEqual(JSON.stringify(save.list().map((s) => s.slot)), JSON.stringify(['beta']));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
