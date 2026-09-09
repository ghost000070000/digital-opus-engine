// Terrain Sculpting (Wave 4): an optional additive height-edit layer on top
// of the procedural base, `opts.heightEdits = { segments, deltas }` -- a
// dense grid of per-vertex offsets at the SAME resolution as the terrain's
// own render grid (`opts.segments`), avoiding a second resampling grid
// entirely. Bilinearly interpolated so sculpted terrain reads smoothly
// between edited vertices, not as a blocky per-cell step.
function sampleHeightEdit(x, z, opts) {
  const edits = opts.heightEdits;
  if (!edits || !edits.deltas || !edits.segments) return 0;
  const size = opts.size ?? 22;
  const segs = edits.segments;
  const verts = segs + 1;
  let gx = (x / size + 0.5) * segs;
  let gz = (z / size + 0.5) * segs;
  gx = Math.max(0, Math.min(segs, gx));
  gz = Math.max(0, Math.min(segs, gz));
  const ix0 = Math.floor(gx), iz0 = Math.floor(gz);
  const ix1 = Math.min(segs, ix0 + 1), iz1 = Math.min(segs, iz0 + 1);
  const fx = gx - ix0, fz = gz - iz0;
  const d = edits.deltas;
  const v00 = d[iz0 * verts + ix0] || 0;
  const v10 = d[iz0 * verts + ix1] || 0;
  const v01 = d[iz1 * verts + ix0] || 0;
  const v11 = d[iz1 * verts + ix1] || 0;
  const top = v00 + (v10 - v00) * fx;
  const bottom = v01 + (v11 - v01) * fx;
  return top + (bottom - top) * fz;
}

// The one and only place base terrain height is computed, procedural OR
// sculpted -- every consumer in the engine (render mesh generation below,
// collision/grounding, slope-normal sampling, the public Opus.Terrain query
// API) already calls this single function, so folding the height-edit
// lookup in HERE rather than touching each of those 6 call sites
// individually is what guarantees rendering and physics can never disagree
// about a sculpted terrain's shape -- there was no other way to accidentally
// wire up a visual-only deformation even if someone tried.
function islandHeight(x, z, opts) {
  const {
    seed = 1,
    radius = 9.5,
    amplitude = 1.6,
    islandBase = 0.4,
    oceanFloor = -2.4,
  } = opts;

  const dist = Math.sqrt(x * x + z * z);
  const falloff = 1 - smoothstepJS(radius * 0.3, radius, dist);
  const n = fbm2D(x * 0.18, z * 0.18, seed, 5);
  const peak = islandBase + (n * 2 - 1) * amplitude;
  // Beyond the island's radius, blend toward a gently undulating seafloor
  // instead of a perfectly flat oceanFloor constant. The terrain mesh is
  // always a full size x size square (see createTerrainMesh below) but the
  // island itself is circular, so a dead-flat height outside `radius` reads
  // as an artificial rectangular "platform" once rendered -- especially
  // where two terrain tiles sit close together. Inside the island (falloff
  // === 1) this term cancels out exactly, so on-land height/collision is
  // unaffected.
  const seafloorNoise = fbm2D(x * 0.06 + seed, z * 0.06 - seed, seed + 97, 3);
  const seafloor = oceanFloor + (seafloorNoise * 2 - 1) * 0.35;
  return seafloor + (peak - seafloor) * falloff + sampleHeightEdit(x, z, opts);
}

function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function terrainColor(h, slope, waterLevel) {
  const sand = [0.80, 0.72, 0.52];
  const grass = [0.28, 0.44, 0.20];
  const rock = [0.40, 0.38, 0.36];
  const scree = [0.55, 0.53, 0.50];
  const snow = [0.92, 0.94, 0.97];
  const snowline = waterLevel + 3.2;

  if (slope > 0.6) return lerp3(rock, scree, Math.min((slope - 0.6) / 0.4, 1));
  if (h < waterLevel + 0.35) return sand;
  if (h > snowline) return lerp3(rock, snow, Math.min((h - snowline) / 0.8, 1));

  const t = Math.min(Math.max((h - (waterLevel + 0.35)) / 0.9, 0), 1);
  return lerp3(sand, grass, t);
}

function createTerrainMesh(gl, opts = {}) {
  const {
    size = 22,
    segments = 56,
    waterLevel = -1.6,
  } = opts;

  const verts = segments + 1;
  const cellSize = size / segments;
  const heights = new Float32Array(verts * verts);
  const positions = new Float32Array(verts * verts * 3);

  for (let iz = 0; iz <= segments; iz++) {
    for (let ix = 0; ix <= segments; ix++) {
      const x = (ix / segments - 0.5) * size;
      const z = (iz / segments - 0.5) * size;
      const h = islandHeight(x, z, opts);
      const idx = iz * verts + ix;
      heights[idx] = h;
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = h;
      positions[idx * 3 + 2] = z;
    }
  }

  const normals = new Float32Array(verts * verts * 3);
  const colors = new Float32Array(verts * verts * 3);
  // Wave 6B (Priority D): per-vertex RAW paint weight for up to 3 layers
  // (matching the editor's own PAINT_MAX_LAYERS=3 cap), populated straight
  // from the SAME `opts.paintEdits.weights` grid the color blend below
  // already reads -- no second weight-map system. Left all-zero when there
  // is no paintEdits at all, which the terrain fragment shader's own
  // `u_terrainHasTexN` gate already treats as a complete no-op.
  const layerWeights = new Float32Array(verts * verts * 3);
  for (let iz = 0; iz <= segments; iz++) {
    for (let ix = 0; ix <= segments; ix++) {
      const idx = iz * verts + ix;
      const hL = heights[iz * verts + Math.max(ix - 1, 0)];
      const hR = heights[iz * verts + Math.min(ix + 1, segments)];
      const hD = heights[Math.max(iz - 1, 0) * verts + ix];
      const hU = heights[Math.min(iz + 1, segments) * verts + ix];
      const n = new Vec3((hL - hR) / (2 * cellSize), 1, (hD - hU) / (2 * cellSize)).normalize();
      normals[idx * 3] = n.x;
      normals[idx * 3 + 1] = n.y;
      normals[idx * 3 + 2] = n.z;

      const slope = 1 - n.y;
      let color = terrainColor(heights[idx], slope, waterLevel);
      // Wave 6 (Priority G): Terrain Painting -- an optional additive COLOR
      // layer on top of the procedural base, the exact same "dense edit
      // grid at the terrain's own render resolution" shape `heightEdits`
      // above already established (opts.paintEdits = { segments, layers,
      // weights }), so no second grid-sampling mechanism was invented for
      // it. `weights` is layer-major (`weights[layerIndex*verts*verts+idx]`)
      // and indexed DIRECTLY by this loop's own `idx` -- unlike
      // sampleHeightEdit, no bilinear resampling is needed here at all,
      // since paint edits are only ever authored (and only ever valid)
      // at this exact same `segments` resolution (ensurePaintEdits, the
      // editor-side brush, rebuilds the grid from scratch if segments ever
      // changes, the same "same-resolution, no second grid" reasoning
      // heightEdits' own comment gives). A vertex with zero total paint
      // weight renders its procedural color completely unchanged -- an
      // unpainted terrain (the overwhelming majority) is bit-identical to
      // before this priority existed.
      const paint = opts.paintEdits;
      if (paint && paint.segments === segments && paint.layers && paint.layers.length > 0) {
        const cellCount = verts * verts;
        let totalW = 0;
        for (let li = 0; li < paint.layers.length; li++) totalW += paint.weights[li * cellCount + idx] || 0;
        totalW = Math.min(1, totalW);
        if (totalW > 0) {
          const blended = [color[0] * (1 - totalW), color[1] * (1 - totalW), color[2] * (1 - totalW)];
          for (let li = 0; li < paint.layers.length; li++) {
            const w = paint.weights[li * cellCount + idx] || 0;
            const lc = paint.layers[li].color;
            blended[0] += lc[0] * w;
            blended[1] += lc[1] * w;
            blended[2] += lc[2] * w;
          }
          color = blended;
        }
        for (let li = 0; li < Math.min(paint.layers.length, 3); li++) {
          layerWeights[idx * 3 + li] = paint.weights[li * cellCount + idx] || 0;
        }
      }
      colors[idx * 3] = color[0];
      colors[idx * 3 + 1] = color[1];
      colors[idx * 3 + 2] = color[2];
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

  return createColoredMesh(gl, positions, normals, colors, indices, layerWeights);
}
