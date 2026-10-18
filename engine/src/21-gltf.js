// glTF 2.0 geometry import. Parses a .gltf (JSON, embedded base64 buffers)
// or .glb (binary container) file into flat position/normal/uv/index arrays
// compatible with Opus.Mesh.fromArrays, plus (bounded, see below) one
// extracted base-color texture. Animations and skinning are still out of
// scope -- Entity has no skinning, so importing that data wouldn't be
// usable even if parsed. Materials are handled deliberately narrowly: only
// the FIRST base-color texture found anywhere in the file is extracted (one
// texture per imported model, mirroring the existing one-color-per-entity
// convention), and only the base color map -- no metallic/roughness/normal/
// emissive maps, matching this engine's non-PBR lit shader. Honest about
// the remaining limits with a clear error rather than silently dropping
// data with no signal. External .bin buffer references (and external image
// file references) are unsupported for the same reason -- the editor reads
// one dropped file, not a folder -- so a buffer/image needs to be either
// embedded (data: URI) or, for buffers, the GLB binary chunk.

const GLTF_COMPONENT_TYPES = {
  5120: { array: Int8Array, size: 1, max: 127 },
  5121: { array: Uint8Array, size: 1, max: 255 },
  5122: { array: Int16Array, size: 2, max: 32767 },
  5123: { array: Uint16Array, size: 2, max: 65535 },
  5125: { array: Uint32Array, size: 4, max: 4294967295 },
  5126: { array: Float32Array, size: 4, max: null },
};
const GLTF_TYPE_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const GLB_MAGIC = 0x46546c67;

function gltfFail(reason) {
  throw new Error(`Opus.Mesh.fromGLTF: ${reason}`);
}

function decodeDataURI(uri) {
  const match = /^data:[^,]*;base64,([\s\S]*)$/.exec(uri);
  if (!match) gltfFail('only base64 data URIs are supported for buffers (no external .bin file references)');
  const binary = atob(match[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function parseGLTFContainer(input) {
  if (typeof input === 'string') {
    return { json: JSON.parse(input), glbBinaryChunk: null };
  }
  if (!(input instanceof ArrayBuffer)) {
    gltfFail('expected a glTF JSON string or an ArrayBuffer (.glb, or raw .gltf bytes)');
  }
  const view = new DataView(input);
  if (input.byteLength < 12 || view.getUint32(0, true) !== GLB_MAGIC) {
    const text = new TextDecoder('utf-8').decode(input);
    return { json: JSON.parse(text), glbBinaryChunk: null };
  }
  const totalLength = view.getUint32(8, true);
  let offset = 12;
  let json = null;
  let glbBinaryChunk = null;
  while (offset < totalLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    if (chunkType === 0x4e4f534a) { // 'JSON'
      json = JSON.parse(new TextDecoder('utf-8').decode(input.slice(chunkStart, chunkStart + chunkLength)));
    } else if (chunkType === 0x004e4942) { // 'BIN\0'
      glbBinaryChunk = input.slice(chunkStart, chunkStart + chunkLength);
    }
    offset = chunkStart + chunkLength;
  }
  if (!json) gltfFail('GLB container has no JSON chunk');
  return { json, glbBinaryChunk };
}

function resolveGLTFBuffers(json, glbBinaryChunk) {
  return (json.buffers || []).map((buf, i) => {
    if (buf.uri) return decodeDataURI(buf.uri);
    if (i === 0 && glbBinaryChunk) return glbBinaryChunk;
    gltfFail(`buffer ${i} has no uri and no embedded GLB binary chunk (external .bin files aren't supported)`);
  });
}

// Generous headroom above the 65535-vertex final ceiling (parseGLTFToArrays
// below) -- large enough to never reject a model that would otherwise pass
// that check, small enough that a crafted accessor claiming millions of
// elements gets rejected before allocating anything, not after (AUDIT.md
// finding #2: the final vertex-count check ran only once every accessor
// for every primitive had already been fully allocated and read).
const GLTF_MAX_ACCESSOR_COUNT = 500000;

function readGLTFAccessor(json, bufferBytes, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const componentInfo = GLTF_COMPONENT_TYPES[accessor.componentType];
  if (!componentInfo) gltfFail(`unsupported accessor componentType ${accessor.componentType}`);
  const numComponents = GLTF_TYPE_COMPONENTS[accessor.type];
  if (!numComponents) gltfFail(`unsupported accessor type "${accessor.type}"`);
  const count = accessor.count;
  if (!Number.isInteger(count) || count < 0 || count > GLTF_MAX_ACCESSOR_COUNT) {
    gltfFail(`accessor ${accessorIndex} has an unreasonable count (${count}); max supported is ${GLTF_MAX_ACCESSOR_COUNT}`);
  }
  const out = new Float32Array(count * numComponents);
  if (accessor.bufferView === undefined) return out; // sparse-only accessor: treated as zeros

  const bufferView = json.bufferViews[accessor.bufferView];
  const buffer = bufferBytes[bufferView.buffer];
  const elementSize = componentInfo.size * numComponents;
  const stride = bufferView.byteStride || elementSize;
  const baseOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
  const view = new DataView(buffer);
  const readers = {
    Int8Array: (o) => view.getInt8(o),
    Uint8Array: (o) => view.getUint8(o),
    Int16Array: (o) => view.getInt16(o, true),
    Uint16Array: (o) => view.getUint16(o, true),
    Uint32Array: (o) => view.getUint32(o, true),
    Float32Array: (o) => view.getFloat32(o, true),
  };
  const read = readers[componentInfo.array.name];

  for (let i = 0; i < count; i++) {
    const elementOffset = baseOffset + i * stride;
    for (let c = 0; c < numComponents; c++) {
      let value = read(elementOffset + c * componentInfo.size);
      if (accessor.normalized && componentInfo.max) {
        value = value / componentInfo.max;
        if (componentInfo.array.name.startsWith('Int')) value = Math.max(value, -1);
      }
      out[i * numComponents + c] = value;
    }
  }
  return out;
}

function nodeLocalMatrix(node) {
  if (node.matrix) {
    const out = new Mat4();
    out.m.set(node.matrix);
    return out;
  }
  const t = node.translation || [0, 0, 0];
  const r = node.rotation || [0, 0, 0, 1];
  const s = node.scale || [1, 1, 1];
  const T = Mat4.translation(new Vec3(t[0], t[1], t[2]));
  const R = Mat4.fromQuaternion(new Quat(r[0], r[1], r[2], r[3]));
  const S = Mat4.scaling(new Vec3(s[0], s[1], s[2]));
  return Mat4.multiply(T, Mat4.multiply(R, S));
}

function transformPoint(mat, x, y, z) {
  const m = mat.m;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

// Rotation/scale only, no translation -- correct for directions (normals)
// under uniform scale. Non-uniform scale would technically need the
// inverse-transpose; treated as an acceptable, documented simplification
// for a geometry-only importer rather than a silent correctness gap.
function transformDirection(mat, x, y, z) {
  const m = mat.m;
  return [
    m[0] * x + m[4] * y + m[8] * z,
    m[1] * x + m[5] * y + m[9] * z,
    m[2] * x + m[6] * y + m[10] * z,
  ];
}

// Fallback when a primitive has no NORMAL attribute: averaged per-vertex
// face normals, computed from the triangle list itself -- every hand-built
// mesh in this engine already ships normals, so this is the one path where
// they might genuinely be missing.
function computeFlatNormals(positions, indices) {
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i] * 3, ib = indices[i + 1] * 3, ic = indices[i + 2] * 3;
    const ux = positions[ib] - positions[ia], uy = positions[ib + 1] - positions[ia + 1], uz = positions[ib + 2] - positions[ia + 2];
    const vx = positions[ic] - positions[ia], vy = positions[ic + 1] - positions[ia + 1], vz = positions[ic + 2] - positions[ia + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (const idx of [ia, ib, ic]) { normals[idx] += nx; normals[idx + 1] += ny; normals[idx + 2] += nz; }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= len; normals[i + 1] /= len; normals[i + 2] /= len;
  }
  return normals;
}

function walkGLTFNode(json, bufferBytes, nodeIndex, parentMatrix, out) {
  const node = json.nodes[nodeIndex];
  const worldMatrix = Mat4.multiply(parentMatrix, nodeLocalMatrix(node));
  if (node.mesh !== undefined) {
    const mesh = json.meshes[node.mesh];
    for (const primitive of mesh.primitives) {
      if (primitive.mode !== undefined && primitive.mode !== 4) gltfFail(`primitive mode ${primitive.mode} isn't supported (only TRIANGLES / mode 4)`);
      if (primitive.indices === undefined) gltfFail('non-indexed primitives aren\'t supported');
      const posAttr = primitive.attributes.POSITION;
      if (posAttr === undefined) gltfFail('primitive has no POSITION attribute');

      const localPositions = readGLTFAccessor(json, bufferBytes, posAttr);
      const localIndices = readGLTFAccessor(json, bufferBytes, primitive.indices);
      const localNormals = primitive.attributes.NORMAL !== undefined
        ? readGLTFAccessor(json, bufferBytes, primitive.attributes.NORMAL)
        : computeFlatNormals(localPositions, localIndices);
      // UVs -- TEXCOORD_0 if present, else zero-filled so out.uvs stays
      // aligned 1:1 with out.positions/out.normals regardless of whether
      // every primitive in the file has texture coordinates. A primitive
      // with no UVs simply can't be textured (renders as if untextured,
      // same as any other Opus mesh with no uvs supplied), not an error.
      const vertexCount = localPositions.length / 3;
      const localUVs = primitive.attributes.TEXCOORD_0 !== undefined
        ? readGLTFAccessor(json, bufferBytes, primitive.attributes.TEXCOORD_0)
        : new Float32Array(vertexCount * 2);

      const indexBase = out.positions.length / 3;
      for (let i = 0; i < vertexCount; i++) {
        const p = transformPoint(worldMatrix, localPositions[i * 3], localPositions[i * 3 + 1], localPositions[i * 3 + 2]);
        out.positions.push(p[0], p[1], p[2]);
        const n = transformDirection(worldMatrix, localNormals[i * 3], localNormals[i * 3 + 1], localNormals[i * 3 + 2]);
        const len = Math.hypot(n[0], n[1], n[2]) || 1;
        out.normals.push(n[0] / len, n[1] / len, n[2] / len);
        out.uvs.push(localUVs[i * 2], localUVs[i * 2 + 1]);
      }
      for (let i = 0; i < localIndices.length; i++) out.indices.push(indexBase + localIndices[i]);

      // Bounded material support: the FIRST base-color texture found on any
      // primitive in the whole file becomes the one texture offered back to
      // the caller (Opus.Mesh has one texture per imported model, mirroring
      // the existing one-color-per-entity convention -- not a per-primitive
      // multi-material system). Deliberately NOT full PBR: only the base
      // color/diffuse texture is extracted, no metallic/roughness/normal/
      // emissive maps, matching this engine's non-PBR lit shader.
      if (!out.textureDataURL && primitive.material !== undefined) {
        const material = json.materials && json.materials[primitive.material];
        const texRef = material && material.pbrMetallicRoughness && material.pbrMetallicRoughness.baseColorTexture;
        if (texRef && json.textures && json.textures[texRef.index]) {
          const textureDef = json.textures[texRef.index];
          const image = json.images && json.images[textureDef.source];
          if (image) out.textureDataURL = resolveGLTFImageDataURL(image, json, bufferBytes);
        }
      }
    }
  }
  for (const childIndex of node.children || []) walkGLTFNode(json, bufferBytes, childIndex, worldMatrix, out);
}

// An embedded glTF image is either a data: URI directly (common in .gltf
// text files) or bytes living in a bufferView (common in .glb) -- both are
// turned into one data: URL so the caller can hand it straight to `new
// Image()`/`<img src>` without knowing which form the source file used.
// External image files (a bare relative path uri) aren't supported, same
// externally-referenced-file boundary this importer already draws for
// buffers (see decodeDataURI above).
function resolveGLTFImageDataURL(image, json, bufferBytes) {
  if (image.uri) {
    if (!/^data:/.test(image.uri)) return null; // external file reference -- unsupported, same as external .bin
    return image.uri;
  }
  if (image.bufferView === undefined) return null;
  const bufferView = json.bufferViews[image.bufferView];
  const buffer = bufferBytes[bufferView.buffer];
  const bytes = new Uint8Array(buffer, bufferView.byteOffset || 0, bufferView.byteLength);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const mimeType = image.mimeType || 'image/png';
  return `data:${mimeType};base64,${btoa(binary)}`;
}

// Wave 6 (Priority C): the skinned-mesh import path, DELIBERATELY SEPARATE
// from parseGLTFToArrays/walkGLTFNode above rather than a shared codepath --
// a static mesh's vertices get the node's world matrix BAKED IN at import
// time (walkGLTFNode's own transformPoint calls), which is exactly wrong
// for a skinned mesh: a skinned vertex must stay in the SKIN's own local
// bind space and be re-transformed every frame by the CURRENT animated
// joint palette, never baked once at import. Bounded scope, matching the
// investigation already on record in this file's Wave 5 history: exactly
// ONE skin (the first mesh node with both `mesh` and `skin` set), TRS
// animation channels only (no morph targets), a capped joint count, no IK,
// no multi-skin retargeting.
const GLTF_MAX_JOINTS = 64;

function findSkinnedMeshNode(json) {
  for (let i = 0; i < (json.nodes || []).length; i++) {
    const node = json.nodes[i];
    if (node.mesh !== undefined && node.skin !== undefined) return { nodeIndex: i, node };
  }
  return null;
}

function readLocalTRS(node) {
  return {
    translation: node.translation ? node.translation.slice() : [0, 0, 0],
    rotation: node.rotation ? node.rotation.slice() : [0, 0, 0, 1],
    scale: node.scale ? node.scale.slice() : [1, 1, 1],
  };
}

function parseSkinnedGLTFToArrays(input) {
  const { json, glbBinaryChunk } = parseGLTFContainer(input);
  const found = findSkinnedMeshNode(json);
  if (!found) gltfFail('no skinned mesh node found (a node with both "mesh" and "skin" set) -- use Opus.Mesh.fromGLTF for a non-skinned model');
  const bufferBytes = resolveGLTFBuffers(json, glbBinaryChunk);
  const mesh = json.meshes[found.node.mesh];
  const primitive = mesh.primitives[0];
  if (!primitive) gltfFail('skinned mesh has no primitives');
  if (primitive.mode !== undefined && primitive.mode !== 4) gltfFail(`primitive mode ${primitive.mode} isn't supported (only TRIANGLES / mode 4)`);
  if (primitive.indices === undefined) gltfFail('non-indexed primitives aren\'t supported');
  const posAttr = primitive.attributes.POSITION;
  const jointsAttr = primitive.attributes.JOINTS_0;
  const weightsAttr = primitive.attributes.WEIGHTS_0;
  if (posAttr === undefined) gltfFail('skinned primitive has no POSITION attribute');
  if (jointsAttr === undefined || weightsAttr === undefined) gltfFail('skinned primitive is missing JOINTS_0/WEIGHTS_0 -- not actually a skinned mesh');

  const positions = readGLTFAccessor(json, bufferBytes, posAttr);
  const indices = readGLTFAccessor(json, bufferBytes, primitive.indices);
  const vertexCount = positions.length / 3;
  const normals = primitive.attributes.NORMAL !== undefined
    ? readGLTFAccessor(json, bufferBytes, primitive.attributes.NORMAL)
    : computeFlatNormals(positions, indices);
  const uvs = primitive.attributes.TEXCOORD_0 !== undefined
    ? readGLTFAccessor(json, bufferBytes, primitive.attributes.TEXCOORD_0)
    : new Float32Array(vertexCount * 2);
  const joints = readGLTFAccessor(json, bufferBytes, jointsAttr); // 4 per vertex, skin-local joint indices (as floats, e.g. 0.0/1.0)
  const weights = readGLTFAccessor(json, bufferBytes, weightsAttr); // 4 per vertex

  const skin = json.skins[found.node.skin];
  if (!skin || !skin.joints || skin.joints.length === 0) gltfFail('skin has no joints');
  if (skin.joints.length > GLTF_MAX_JOINTS) gltfFail(`skin has ${skin.joints.length} joints, over the ${GLTF_MAX_JOINTS} this engine's bone palette supports`);
  const jointCount = skin.joints.length;

  const inverseBindFlat = skin.inverseBindMatrices !== undefined
    ? readGLTFAccessor(json, bufferBytes, skin.inverseBindMatrices)
    : new Float32Array(jointCount * 16).map((_, i) => (i % 16 === 0 || i % 16 === 5 || i % 16 === 10 || i % 16 === 15) ? 1 : 0); // identity fallback per joint
  const inverseBindMatrices = [];
  for (let j = 0; j < jointCount; j++) inverseBindMatrices.push(Array.from(inverseBindFlat.subarray(j * 16, j * 16 + 16)));

  // Joint hierarchy: map each joint's NODE index -> its local index within
  // skin.joints, then find each joint's PARENT joint (by walking the node
  // graph's own parent-of relationship, restricted to nodes also present in
  // skin.joints -- the bounded "joints form a clean subtree" assumption
  // documented above). -1 means this joint has no animated parent (a root
  // joint), so its world matrix is just its own local matrix.
  const nodeToJointIndex = new Map();
  skin.joints.forEach((nodeIdx, localIdx) => nodeToJointIndex.set(nodeIdx, localIdx));
  const nodeParent = new Array(json.nodes.length).fill(-1);
  json.nodes.forEach((node, i) => { (node.children || []).forEach((childIdx) => { nodeParent[childIdx] = i; }); });
  const jointParents = skin.joints.map((nodeIdx) => {
    let p = nodeParent[nodeIdx];
    while (p !== -1 && !nodeToJointIndex.has(p)) p = nodeParent[p];
    return p === -1 ? -1 : nodeToJointIndex.get(p);
  });
  const jointLocalBind = skin.joints.map((nodeIdx) => readLocalTRS(json.nodes[nodeIdx]));
  // Wave 7 (Priority A): joint NAMES, for Bone Sockets -- not needed by
  // animation sampling itself (which only ever deals in local joint
  // INDICES), but Socket authoring wants a human-readable dropdown ("hand.R"
  // instead of "joint7"). Falls back to a synthetic "joint<i>" name for any
  // joint node with no `name` field at all, so a socket can still be
  // authored (just less legibly) against a rig that genuinely has no names,
  // per this priority's own explicit "still expose its available joints"
  // requirement -- never a reason to fail the whole import.
  const jointNames = skin.joints.map((nodeIdx, i) => (json.nodes[nodeIdx] && json.nodes[nodeIdx].name) || `joint${i}`);

  // Animation clips -- only channels targeting an actual joint node are
  // kept (a channel animating something outside the skin, e.g. a camera
  // rig sharing the same file, is silently out of this importer's scope,
  // not an error -- it simply produces a clip with fewer tracks).
  const clips = (json.animations || []).map((anim, animIndex) => {
    const tracks = [];
    let duration = 0;
    for (const channel of anim.channels) {
      const jointLocalIndex = nodeToJointIndex.get(channel.target.node);
      if (jointLocalIndex === undefined) continue; // not a joint -- out of scope, skip
      if (!['translation', 'rotation', 'scale'].includes(channel.target.path)) continue; // no morph/weights channel support
      const sampler = anim.samplers[channel.sampler];
      const times = readGLTFAccessor(json, bufferBytes, sampler.input);
      const values = readGLTFAccessor(json, bufferBytes, sampler.output);
      if (times.length > 0) duration = Math.max(duration, times[times.length - 1]);
      tracks.push({ jointLocalIndex, path: channel.target.path, times, values, interpolation: sampler.interpolation || 'LINEAR' });
    }
    return { name: anim.name || `clip${animIndex}`, duration, tracks };
  });

  return {
    positions, normals, uvs, indices: new Uint16Array(indices),
    joints, weights, jointCount, inverseBindMatrices, jointParents, jointLocalBind, jointNames, clips,
  };
}

// --- CPU animation sampling (Wave 6, Priority C) ---------------------
// Given a skin's static rig data (joint hierarchy, bind pose, inverse bind
// matrices) plus one clip and a playback time, produces the final bone
// palette -- one Mat4 per joint, ready to upload as the skinning vertex
// shader's uniform array. Deliberately CPU-side, once per animated entity
// per frame (not per-vertex, not GPU compute) -- the joint count is capped
// (GLTF_MAX_JOINTS) specifically so this stays cheap.

function findKeyframeIndex(times, t) {
  // Returns i such that times[i] <= t < times[i+1] (clamped at both ends).
  if (t <= times[0]) return 0;
  if (t >= times[times.length - 1]) return times.length - 1;
  for (let i = 0; i < times.length - 1; i++) {
    if (t >= times[i] && t < times[i + 1]) return i;
  }
  return times.length - 1;
}

function sampleTrackVec(track, t, stride) {
  const { times, values } = track;
  const i = findKeyframeIndex(times, t);
  if (i >= times.length - 1) return Array.from(values.subarray(i * stride, i * stride + stride));
  const t0 = times[i], t1 = times[i + 1];
  const alpha = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
  const a = values.subarray(i * stride, i * stride + stride);
  const b = values.subarray((i + 1) * stride, (i + 1) * stride + stride);
  const out = new Array(stride);
  for (let c = 0; c < stride; c++) out[c] = a[c] + (b[c] - a[c]) * alpha;
  return out;
}

function sampleTrackQuat(track, t) {
  const { times, values } = track;
  const i = findKeyframeIndex(times, t);
  if (i >= times.length - 1) return Array.from(values.subarray(i * 4, i * 4 + 4));
  const t0 = times[i], t1 = times[i + 1];
  const alpha = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
  const qa = new Quat(values[i * 4], values[i * 4 + 1], values[i * 4 + 2], values[i * 4 + 3]);
  const qb = new Quat(values[(i + 1) * 4], values[(i + 1) * 4 + 1], values[(i + 1) * 4 + 2], values[(i + 1) * 4 + 3]);
  const q = Quat.slerp(qa, qb, alpha);
  return [q.x, q.y, q.z, q.w];
}

/**
 * Computes the local TRS of every joint at time `t` for one clip: the
 * clip's own animated tracks override the joint's rest (bind) TRS
 * component-by-component (a joint with no translation track just keeps its
 * bind translation, etc) -- so a clip that only animates rotation (like the
 * deterministic fixture's own "Bend" clip) still produces a fully valid
 * pose for every other joint and every other TRS component.
 */
function sampleClipLocalTRS(skinData, clip, t) {
  const out = skinData.jointLocalBind.map((bind) => ({ translation: bind.translation.slice(), rotation: bind.rotation.slice(), scale: bind.scale.slice() }));
  if (!clip) return out;
  for (const track of clip.tracks) {
    const target = out[track.jointLocalIndex];
    if (!target) continue;
    if (track.path === 'translation') target.translation = sampleTrackVec(track, t, 3);
    else if (track.path === 'scale') target.scale = sampleTrackVec(track, t, 3);
    else if (track.path === 'rotation') target.rotation = sampleTrackQuat(track, t);
  }
  return out;
}

// Shared by computeSkinPalette and computeSkinPaletteBlended below: given
// ALREADY-SAMPLED per-joint local TRS (single-clip or already-blended), do
// the exact same local-matrix -> world-matrix (hierarchy walk) -> skin-
// matrix (x inverse bind) pipeline once. One implementation, so a plain
// single-clip pose and a blended pose can never diverge on the actual
// matrix math, only on how the TRS was produced.
function localTRSToPalette(skinData, localTRS) {
  const localMatrices = localTRS.map(({ translation, rotation, scale }) => Mat4.compose(
    new Vec3(translation[0], translation[1], translation[2]),
    new Quat(rotation[0], rotation[1], rotation[2], rotation[3]),
    new Vec3(scale[0], scale[1], scale[2]),
  ));
  const worldMatrices = new Array(skinData.jointCount);
  // Bounded assumption (documented in parseSkinnedGLTFToArrays): a joint's
  // parent always appears EARLIER in skin.joints than the joint itself
  // (true for every glTF exporter this importer has been tested against,
  // and always true for the deterministic fixture), so one linear pass
  // suffices -- no recursion, no topological sort needed.
  for (let j = 0; j < skinData.jointCount; j++) {
    const parent = skinData.jointParents[j];
    worldMatrices[j] = parent === -1 ? localMatrices[j] : Mat4.multiply(worldMatrices[parent], localMatrices[j]);
  }
  const palette = new Float32Array(skinData.jointCount * 16);
  for (let j = 0; j < skinData.jointCount; j++) {
    const ibm = new Mat4();
    ibm.m.set(skinData.inverseBindMatrices[j]);
    const skinMatrix = Mat4.multiply(worldMatrices[j], ibm);
    palette.set(skinMatrix.m, j * 16);
  }
  return palette;
}
// Wave 7 (Priority A/Sections 3-4): the bone WORLD-transform query Bone
// Sockets need -- deliberately a SEPARATE composition from localTRSToPalette
// above (which produces vertex-SKINNING matrices, world*inverseBind, not
// usable for attaching an object to a joint), reusing the actual sampled
// TRS hierarchy directly rather than decomposing a general 4x4 product back
// apart (which risks shear/precision loss for the same input every other
// consumer here already trusts). Composes position/rotation/scale
// incrementally parent-to-child -- EXACTLY the same formula the editor's own
// `resolveWorldTransform` already uses for ordinary object hierarchy
// (`worldPos = parentPos + parentRot.rotate(localPos * parentScale)`,
// `worldRot = parentRot * localRot`, `worldScale = parentScale * localScale`
// component-wise) -- one shared composition convention for "an animated
// hierarchy," not a second one invented just for bones. Returns transforms
// in the SKIN's own local (bind-root) space, matching the same space
// `computeSkinPalette`'s own `worldMatrices` already work in -- the caller
// (Opus.Skin.computeJointTransforms) is what composes with an entity's own
// world transform, so this stays a pure, entity-agnostic skin-data function
// like every other one in this file.
// Explicit diagnostic extraction only: never changes skin, entity or collider.
// Times are clip-local and bounded, not automatically wrapped across cycles.
function computeRootTranslationDelta(skinData, clipIndex, fromTime, toTime, rootIndex) {
  const clip = skinData?.clips?.[clipIndex];
  if (!Number.isInteger(clipIndex) || clipIndex < 0 || !clip || !Number.isFinite(clip.duration) || clip.duration <= 0 || !Array.isArray(clip.tracks)) throw new RangeError('Choose an available finite-duration clip');
  if (!Number.isInteger(rootIndex) || rootIndex < 0 || skinData.jointParents?.[rootIndex] !== -1 || !skinData.jointLocalBind?.[rootIndex]) throw new RangeError('Choose a skeleton root joint');
  if (![fromTime,toTime].every(t => Number.isFinite(t) && t >= 0 && t <= clip.duration)) throw new RangeError('Root motion sample times must be within the clip duration');
  const a = sampleClipLocalTRS(skinData, clip, fromTime)[rootIndex].translation;
  const b = sampleClipLocalTRS(skinData, clip, toTime)[rootIndex].translation;
  if (![...a,...b].every(Number.isFinite)) throw new RangeError('Root translation is unavailable or nonfinite');
  return new Vec3(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
}
function sampleClipJointWorldTRS(skinData, clip, t) {
  const localTRS = sampleClipLocalTRS(skinData, clip, t);
  const world = new Array(skinData.jointCount);
  for (let j = 0; j < skinData.jointCount; j++) {
    const local = localTRS[j];
    const localPos = new Vec3(local.translation[0], local.translation[1], local.translation[2]);
    const localRot = new Quat(local.rotation[0], local.rotation[1], local.rotation[2], local.rotation[3]);
    const localScale = new Vec3(local.scale[0], local.scale[1], local.scale[2]);
    const parent = skinData.jointParents[j];
    if (parent === -1) {
      world[j] = { position: localPos, rotation: localRot, scale: localScale };
    } else {
      const p = world[parent];
      const scaledLocal = new Vec3(localPos.x * p.scale.x, localPos.y * p.scale.y, localPos.z * p.scale.z);
      world[j] = {
        position: p.position.add(p.rotation.rotateVec3(scaledLocal)),
        rotation: p.rotation.multiply(localRot),
        scale: new Vec3(p.scale.x * localScale.x, p.scale.y * localScale.y, p.scale.z * localScale.z),
      };
    }
  }
  const names = skinData.jointNames || world.map((_, i) => `joint${i}`);
  return world.map((w, j) => ({ name: names[j], position: w.position, rotation: w.rotation, scale: w.scale }));
}
/**
 * The full pose -> bone-palette pipeline: sample every joint's local TRS at
 * `t`, then run it through the shared local-TRS -> palette pipeline above.
 * Returns a flat Float32Array of jointCount*16 floats, column-major per
 * joint back to back, ready for a single WebGL uniform upload.
 */
function computeSkinPalette(skinData, clipIndex, t) {
  const clip = clipIndex != null ? skinData.clips[clipIndex] : null;
  const localTRS = sampleClipLocalTRS(skinData, clip, t);
  return localTRSToPalette(skinData, localTRS);
}
/**
 * Wave 6B (Priority B): bounded crossfade -- blends TWO clips' sampled
 * local TRS per joint (translation/scale lerp, rotation slerp) BEFORE
 * composing matrices, not by blending final 4x4 matrices directly (which
 * doesn't interpolate meaningfully for rotation/scale) -- exactly the "if
 * TRS data is available, don't blend final matrices" instruction this
 * priority was built against. `blend` is 0 (fully clip A) to 1 (fully clip
 * B). No layering, no bone masks, no blend trees -- a single scalar blend
 * between exactly two poses, which is all a locomotion-state crossfade or
 * an Attack/Death transition ever needs.
 */
function computeSkinPaletteBlended(skinData, clipIndexA, tA, clipIndexB, tB, blend) {
  const clipA = clipIndexA != null ? skinData.clips[clipIndexA] : null;
  const clipB = clipIndexB != null ? skinData.clips[clipIndexB] : null;
  const trsA = sampleClipLocalTRS(skinData, clipA, tA);
  const trsB = sampleClipLocalTRS(skinData, clipB, tB);
  return localTRSToPalette(skinData, blendLocalTRS(trsA, trsB, blend));
}

// Pose-space crossfade also accepts the visible pose of an interrupted fade.
// Never interpolate final skin matrices: that would distort rotations/scales.
function blendLocalTRS(trsA, trsB, blend) {
  const b = Math.max(0, Math.min(1, blend));
  const blended = trsA.map((a, i) => {
    const bb = trsB[i];
    const translation = [a.translation[0] + (bb.translation[0] - a.translation[0]) * b, a.translation[1] + (bb.translation[1] - a.translation[1]) * b, a.translation[2] + (bb.translation[2] - a.translation[2]) * b];
    const scale = [a.scale[0] + (bb.scale[0] - a.scale[0]) * b, a.scale[1] + (bb.scale[1] - a.scale[1]) * b, a.scale[2] + (bb.scale[2] - a.scale[2]) * b];
    const qa = new Quat(a.rotation[0], a.rotation[1], a.rotation[2], a.rotation[3]);
    const qb = new Quat(bb.rotation[0], bb.rotation[1], bb.rotation[2], bb.rotation[3]);
    const qr = Quat.slerp(qa, qb, b);
    return { translation, scale, rotation: [qr.x, qr.y, qr.z, qr.w] };
  });
  return blended;
}

function parseGLTFToArrays(input) {
  const { json, glbBinaryChunk } = parseGLTFContainer(input);
  if (!json.meshes || json.meshes.length === 0) gltfFail('file has no meshes');
  const bufferBytes = resolveGLTFBuffers(json, glbBinaryChunk);

  const sceneIndex = json.scene ?? 0;
  const scene = json.scenes && json.scenes[sceneIndex];
  const rootNodeIndices = scene ? scene.nodes : (json.nodes || []).map((_, i) => i);
  if (!rootNodeIndices || rootNodeIndices.length === 0) gltfFail('file has no scene root nodes to walk');

  const out = { positions: [], normals: [], uvs: [], indices: [], textureDataURL: null };
  const identity = new Mat4();
  for (const rootIndex of rootNodeIndices) walkGLTFNode(json, bufferBytes, rootIndex, identity, out);

  if (out.positions.length === 0) gltfFail('no triangle geometry found (mesh nodes may be unreferenced by the scene)');
  const vertexCount = out.positions.length / 3;
  if (vertexCount > 65535) gltfFail(`model has ${vertexCount} vertices, over the 65535 that Opus.Mesh.fromArrays supports (Uint16 indices) -- simplify/decimate the model before importing`);

  return {
    positions: new Float32Array(out.positions),
    normals: new Float32Array(out.normals),
    uvs: new Float32Array(out.uvs),
    indices: new Uint16Array(out.indices),
    textureDataURL: out.textureDataURL,
  };
}
