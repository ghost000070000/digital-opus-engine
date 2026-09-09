// Generates tests/fixtures/skinned-bend.gltf -- a deterministic, minimal,
// hand-built skinned glTF asset for Wave 6 Priority C's skeletal animation
// work. Not a real character (no humanoid rig) -- deliberately the SIMPLEST
// possible real skin: a thin 10-vertex ribbon (5 rows x 2 verts, 4 quads)
// rigged to exactly 2 joints (a root joint at y=0..1 and a tip joint at
// y=1..2, blended 50/50 at the y=1 hinge row) with one rotation-only
// animation clip ("Bend") that swings the tip joint back and forth around Z.
// Real accessors, real bufferViews, real inverseBindMatrices, real
// animation sampler keyframes -- everything the parser has to genuinely
// handle, just geometrically as small as a real test case can be.
const fs = require('fs');
const path = require('path');

function f32(arr) { return new Float32Array(arr); }

// --- Geometry: 5 rows (y = 0, 0.5, 1.0, 1.5, 2.0), 2 verts per row (x = -0.1, +0.1) ---
const rowsY = [0, 0.5, 1.0, 1.5, 2.0];
const positions = [];
const normals = [];
const joints = []; // Uint8 VEC4 per vertex
const weights = []; // Float32 VEC4 per vertex
for (const y of rowsY) {
  for (const x of [-0.1, 0.1]) {
    positions.push(x, y, 0);
    normals.push(0, 0, 1);
    if (y < 1.0) { joints.push(0, 0, 0, 0); weights.push(1, 0, 0, 0); }
    else if (y > 1.0) { joints.push(1, 0, 0, 0); weights.push(1, 0, 0, 0); }
    else { joints.push(0, 1, 0, 0); weights.push(0.5, 0.5, 0, 0); }
  }
}
const indices = [];
for (let row = 0; row < 4; row++) {
  const a = row * 2, b = row * 2 + 1, c = row * 2 + 2, d = row * 2 + 3;
  indices.push(a, b, d, a, d, c);
}

// --- Skin: joint0 bind = identity, joint1 bind = translate(0,1,0) ---
// inverseBindMatrices: column-major mat4 per joint.
const ibmJoint0 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const ibmJoint1 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1, 0, 1];
const inverseBindMatrices = [...ibmJoint0, ...ibmJoint1];

// --- Animation: "Bend" -- joint1 rotation keyframes at t=0,0.5,1.0 (rotate
// +-40deg around Z, back to identity), LINEAR interpolation, loops cleanly
// (first and last keyframe both identity).
const times = [0, 0.5, 1.0];
const halfAngle40 = (40 * Math.PI / 180) / 2;
const rotations = [
  0, 0, 0, 1, // t=0: identity
  0, 0, Math.sin(halfAngle40), Math.cos(halfAngle40), // t=0.5: +40deg around Z
  0, 0, 0, 1, // t=1.0: identity
];

// --- Pack everything into one buffer, tracking byte offsets (4-byte aligned) ---
const chunks = [];
let offset = 0;
function addChunk(name, typedArray) {
  const byteOffset = offset;
  chunks.push(typedArray);
  offset += typedArray.byteLength;
  if (offset % 4 !== 0) offset += 4 - (offset % 4); // pad to 4-byte boundary
  return byteOffset;
}

const posOffset = addChunk('positions', f32(positions));
const normOffset = addChunk('normals', f32(normals));
const jointsOffset = addChunk('joints', new Uint8Array(joints));
const weightsOffset = addChunk('weights', f32(weights));
const indexOffset = addChunk('indices', new Uint16Array(indices));
const ibmOffset = addChunk('ibm', f32(inverseBindMatrices));
const timesOffset = addChunk('times', f32(times));
const rotationsOffset = addChunk('rotations', f32(rotations));

const totalLength = offset;
const buffer = new ArrayBuffer(totalLength);
const bytes = new Uint8Array(buffer);
let writeOffset = 0;
const offsets = { positions: posOffset, normals: normOffset, joints: jointsOffset, weights: weightsOffset, indices: indexOffset, ibm: ibmOffset, times: timesOffset, rotations: rotationsOffset };
for (const [key, arr] of [['positions', f32(positions)], ['normals', f32(normals)], ['joints', new Uint8Array(joints)], ['weights', f32(weights)], ['indices', new Uint16Array(indices)], ['ibm', f32(inverseBindMatrices)], ['times', f32(times)], ['rotations', f32(rotations)]]) {
  const target = offsets[key];
  bytes.set(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), target);
}

const base64 = Buffer.from(buffer).toString('base64');

const gltf = {
  asset: { version: '2.0', generator: 'DOEngine skinned-fixture builder (hand-built, Wave 6)' },
  scene: 0,
  scenes: [{ nodes: [0, 2] }],
  nodes: [
    { name: 'RootJoint', translation: [0, 0, 0], children: [1] },
    { name: 'TipJoint', translation: [0, 1, 0] },
    { name: 'SkinnedRibbon', mesh: 0, skin: 0 },
  ],
  meshes: [{
    primitives: [{
      attributes: { POSITION: 0, NORMAL: 1, JOINTS_0: 2, WEIGHTS_0: 3 },
      indices: 4,
      mode: 4,
    }],
  }],
  skins: [{ joints: [0, 1], inverseBindMatrices: 5 }],
  animations: [{
    name: 'Bend',
    channels: [{ sampler: 0, target: { node: 1, path: 'rotation' } }],
    samplers: [{ input: 6, output: 7, interpolation: 'LINEAR' }],
  }],
  buffers: [{ byteLength: totalLength, uri: `data:application/octet-stream;base64,${base64}` }],
  bufferViews: [
    { buffer: 0, byteOffset: offsets.positions, byteLength: positions.length * 4 },
    { buffer: 0, byteOffset: offsets.normals, byteLength: normals.length * 4 },
    { buffer: 0, byteOffset: offsets.joints, byteLength: joints.length * 1 },
    { buffer: 0, byteOffset: offsets.weights, byteLength: weights.length * 4 },
    { buffer: 0, byteOffset: offsets.indices, byteLength: indices.length * 2 },
    { buffer: 0, byteOffset: offsets.ibm, byteLength: inverseBindMatrices.length * 4 },
    { buffer: 0, byteOffset: offsets.times, byteLength: times.length * 4 },
    { buffer: 0, byteOffset: offsets.rotations, byteLength: rotations.length * 4 },
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min: [-0.1, 0, 0], max: [0.1, 2, 0] }, // POSITION
    { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' }, // NORMAL
    { bufferView: 2, componentType: 5121, count: joints.length / 4, type: 'VEC4' }, // JOINTS_0 (UNSIGNED_BYTE)
    { bufferView: 3, componentType: 5126, count: weights.length / 4, type: 'VEC4' }, // WEIGHTS_0
    { bufferView: 4, componentType: 5123, count: indices.length, type: 'SCALAR' }, // indices (UNSIGNED_SHORT)
    { bufferView: 5, componentType: 5126, count: 2, type: 'MAT4' }, // inverseBindMatrices
    { bufferView: 6, componentType: 5126, count: times.length, type: 'SCALAR', min: [0], max: [1] }, // animation input (times)
    { bufferView: 7, componentType: 5126, count: rotations.length / 4, type: 'VEC4' }, // animation output (rotations)
  ],
};

const outPath = path.join(__dirname, 'skinned-bend.gltf');
fs.writeFileSync(outPath, JSON.stringify(gltf, null, 2));
console.log('Wrote', outPath, `(${fs.statSync(outPath).size} bytes)`);
