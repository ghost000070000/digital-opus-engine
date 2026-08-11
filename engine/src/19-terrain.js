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
  return oceanFloor + (peak - oceanFloor) * falloff;
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
      const color = terrainColor(heights[idx], slope, waterLevel);
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

  return createColoredMesh(gl, positions, normals, colors, indices);
}
