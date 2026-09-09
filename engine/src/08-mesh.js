// `uvs` is optional (a Float32Array of vertexCount*2, or omitted/undefined)
// -- every lit-program mesh gets a UV attribute slot regardless, so a single
// shader variant can serve both textured and untextured entities (gated by
// the u_useTexture uniform, not by which meshes happen to carry real UVs).
// Meshes with no real UV data just get zero-filled UVs, which read as
// harmless since u_useTexture is false for anything that never had a
// texture assigned.
// Wave 6 (Priority C): `joints`/`weights` are optional (Float32Array,
// vertexCount*4 each, matching JOINTS_0/WEIGHTS_0's own per-vertex stride)
// -- when both are present, two more attribute buffers are created at
// locations 3/4 (the exact locations LIT_VERT_SRC's own `a_joints`/
// `a_weights` read) and `u_useSkinning` gets set per-draw by the renderer
// for entities carrying a `.skin`. An ordinary (non-skinned) mesh simply
// never creates those buffers/attributes at all -- reusing the SAME shader
// program either way, rather than a whole second program with its own
// duplicated uniform-location bookkeeping, since `u_useSkinning` being
// false for every non-skinned draw call already makes the shader's skin
// branch a no-op.
function createMeshFromArrays(gl, positions, normals, indices, uvs, joints, weights) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

  const vertexCount = positions.length / 3;
  const uvData = uvs && uvs.length === vertexCount * 2 ? uvs : new Float32Array(vertexCount * 2);
  const uvBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, uvData, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);

  const resources = [vao, posBuffer, normalBuffer, uvBuffer];
  if (joints && weights) {
    const jointBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, jointBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, joints, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 0, 0);
    resources.push(jointBuffer);

    const weightBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, weightBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, weights, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 4, gl.FLOAT, false, 0, 0);
    resources.push(weightBuffer);
  }

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  resources.push(indexBuffer);

  gl.bindVertexArray(null);

  return { vao, indexCount: indices.length, resources };
}

// Uploads a decoded image (HTMLImageElement/ImageBitmap/canvas) as an RGBA
// texture. NEAREST-free (LINEAR + mipmaps) since every use case here is a
// real photographic/painted texture, not pixel art needing crisp sampling --
// if pixel-art support is ever needed, expose a filter option instead of
// guessing from image size. No PBR maps, no texture arrays/atlases: one
// 2D texture in, one GPU handle out.
function createTextureFromImage(gl, image) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

// Wave 6B (Priority D): `layerWeights` is optional (a Float32Array of
// vertexCount*3, matching the paint system's own PAINT_MAX_LAYERS=3 cap) --
// when present, a 4th attribute buffer is created at location 3 (the exact
// location TERRAIN_VERT_SRC's own `a_layerWeights` reads), carrying each
// vertex's RAW per-layer paint weight so the terrain fragment shader can
// blend up to 3 authored textures independently of the already-baked
// procedural+paint-color `colors` buffer. Terrain is the only caller of
// this function, so no other mesh kind is affected; a terrain with no paint
// layers (or none carrying a texture) gets an all-zero weights buffer, which
// the shader's own `u_terrainHasTexN` gate already makes a complete no-op --
// bit-identical rendering to before this priority existed.
function createColoredMesh(gl, positions, normals, colors, indices, layerWeights) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

  const colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);

  const resources = [vao, posBuffer, normalBuffer, colorBuffer];

  const vertexCount = positions.length / 3;
  const weightData = layerWeights && layerWeights.length === vertexCount * 3 ? layerWeights : new Float32Array(vertexCount * 3);
  const weightBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, weightBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, weightData, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 0, 0);
  resources.push(weightBuffer);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  resources.push(indexBuffer);

  gl.bindVertexArray(null);

  return { vao, indexCount: indices.length, resources };
}

function createCubeMesh(gl) {
  const positions = new Float32Array([
    // +X
    0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5,
    // -X
    -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5,
    // +Y
    -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // -Y
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, -0.5, -0.5,
    // +Z
    -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
    // -Z
    0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, -0.5,
  ]);

  const normals = new Float32Array([
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
  ]);

  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23,
  ]);

  // A real box-unwrap -- one full 0..1 UV square per face, matching each
  // face's own 4-vertex winding order above (bottom-left, bottom-right,
  // top-right, top-left) so a texture reads right-side-up on every face.
  const uvs = new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
  ]);

  return createMeshFromArrays(gl, positions, normals, indices, uvs);
}

function createFullscreenQuad(gl) {
  const ndc = new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1,
  ]);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, ndc, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);

  return { vao, vertexCount: 6, resources: [vao, buffer] };
}

function createParticleGeometry(gl, maxParticles) {
  const corners = new Float32Array([
    -1, -1, 1, -1, 1, 1,
    -1, -1, 1, 1, -1, 1,
  ]);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const cornerBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const posSizeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posSizeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, maxParticles * 4 * 4, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(1, 1);

  const colorAlphaBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorAlphaBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, maxParticles * 4 * 4, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(2, 1);

  gl.bindVertexArray(null);

  return { vao, posSizeBuffer, colorAlphaBuffer, maxParticles, vertexCount: 6, resources: [vao, cornerBuffer, posSizeBuffer, colorAlphaBuffer] };
}

function createGridMesh(gl, size = 30, segments = 48) {
  const verts = segments + 1;
  const positions = new Float32Array(verts * verts * 3);
  let vi = 0;
  for (let iz = 0; iz <= segments; iz++) {
    for (let ix = 0; ix <= segments; ix++) {
      positions[vi++] = (ix / segments - 0.5) * size;
      positions[vi++] = 0;
      positions[vi++] = (iz / segments - 0.5) * size;
    }
  }

  const indices = new Uint16Array(segments * segments * 6);
  let ii = 0;
  for (let iz = 0; iz < segments; iz++) {
    for (let ix = 0; ix < segments; ix++) {
      const a = iz * verts + ix;
      const b = a + 1;
      const c = a + verts;
      const d = c + 1;
      indices[ii++] = a; indices[ii++] = c; indices[ii++] = b;
      indices[ii++] = b; indices[ii++] = c; indices[ii++] = d;
    }
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  gl.bindVertexArray(null);

  return { vao, indexCount: indices.length, resources: [vao, posBuffer, indexBuffer] };
}

function createPlaneMesh(gl) {
  const positions = new Float32Array([
    -0.5, 0, -0.5,
    0.5, 0, -0.5,
    0.5, 0, 0.5,
    -0.5, 0, 0.5,
  ]);
  const normals = new Float32Array([
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

  return createMeshFromArrays(gl, positions, normals, indices);
}
