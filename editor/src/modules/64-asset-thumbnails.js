// ===== Thumbnails for your own models and prefabs =====
// Imported Models (Assets tab) and saved Prefabs (Objects tab) show a small
// three-quarter-view picture, drawn in the browser with the same tiny
// software rasterizer the Content Library thumbnails were generated with:
// z-buffered, texture-sampled, simply lit, 2x supersampled, transparent.
// Pictures are cached per asset/prefab and drawn a few at a time when idle.

const THUMB_SIZE = 56, THUMB_SS = 2;
const unitCubeArrays = (() => {
  const p = [], i = [];
  const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
  for (const [n, u, v] of faces) {
    const base = p.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) p.push(0.5 * (n[0] + a * u[0] + b * v[0]), 0.5 * (n[1] + a * u[1] + b * v[1]), 0.5 * (n[2] + a * u[2] + b * v[2]));
    i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions: p, indices: i, uvs: null };
})();

// parts: [{ positions, indices, uvs, texture: {width,height,data}|null, color: [r,g,b] 0..1, matrix: 16 numbers column-major }]
// Returns RGBA pixels (Uint8ClampedArray) of THUMB_SIZE x THUMB_SIZE.
function rasterizeThumbnail(parts, size = THUMB_SIZE, ss = THUMB_SS) {
  const W = size * ss;
  const yaw = -Math.PI / 4.6, pitch = 0.42, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const light = (() => { const l = [0.45, 0.85, 0.35], n = Math.hypot(...l); return l.map((v) => v / n); })();
  const tris = []; // world-space triangles with view coordinates
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const part of parts) {
    const P = part.positions, I = part.indices && part.indices.length ? part.indices : null, m = part.matrix;
    const count = I ? I.length : P.length / 3;
    const world = (k) => { const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2]; return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; };
    for (let t = 0; t + 2 < count; t += 3) {
      const ids = I ? [I[t], I[t + 1], I[t + 2]] : [t, t + 1, t + 2];
      const w = ids.map(world);
      const view = w.map(([x, y, z]) => { const rx = x * cy - z * sy, rz = x * sy + z * cy; return [rx, y * cp - rz * sp, y * sp + rz * cp]; });
      for (const v of view) { minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]); minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]); }
      const e1 = [w[1][0] - w[0][0], w[1][1] - w[0][1], w[1][2] - w[0][2]], e2 = [w[2][0] - w[0][0], w[2][1] - w[0][1], w[2][2] - w[0][2]];
      let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const nl = Math.hypot(...n) || 1; n = n.map((v) => v / nl);
      const uv = part.uvs && part.uvs.length ? ids.map((k) => [part.uvs[k * 2], part.uvs[k * 2 + 1]]) : null;
      tris.push({ view, n, uv, texture: part.texture, color: part.color || [0.8, 0.8, 0.82] });
    }
  }
  const color = new Uint8ClampedArray(W * W * 4), depth = new Float32Array(W * W).fill(-Infinity);
  if (!tris.length) return new Uint8ClampedArray(size * size * 4);
  const scale = (W * 0.84) / Math.max(maxX - minX, maxY - minY, 1e-6), ox = W / 2 - (minX + maxX) / 2 * scale, oy = W / 2 + (minY + maxY) / 2 * scale;
  for (const tri of tris) {
    const s = tri.view.map((v) => [ox + v[0] * scale, oy - v[1] * scale, v[2]]);
    const area = (s[1][0] - s[0][0]) * (s[2][1] - s[0][1]) - (s[2][0] - s[0][0]) * (s[1][1] - s[0][1]);
    if (Math.abs(area) < 1e-9) continue;
    // Two-sided: light the face as seen from the camera side.
    const viewDir = [-sy * cp, sp, cy * cp]; // camera looks toward -viewDir in world space
    const facing = tri.n[0] * viewDir[0] + tri.n[1] * viewDir[1] + tri.n[2] * viewDir[2] < 0 ? -1 : 1;
    const shade = 0.42 + 0.68 * Math.max(0, facing * (tri.n[0] * light[0] + tri.n[1] * light[1] + tri.n[2] * light[2]));
    const bx0 = Math.max(0, Math.floor(Math.min(s[0][0], s[1][0], s[2][0]))), bx1 = Math.min(W - 1, Math.ceil(Math.max(s[0][0], s[1][0], s[2][0])));
    const by0 = Math.max(0, Math.floor(Math.min(s[0][1], s[1][1], s[2][1]))), by1 = Math.min(W - 1, Math.ceil(Math.max(s[0][1], s[1][1], s[2][1])));
    for (let py = by0; py <= by1; py++) for (let px = bx0; px <= bx1; px++) {
      const cx = px + 0.5, cyy = py + 0.5;
      const w0 = ((s[1][0] - cx) * (s[2][1] - cyy) - (s[2][0] - cx) * (s[1][1] - cyy)) / area, w1 = ((s[2][0] - cx) * (s[0][1] - cyy) - (s[0][0] - cx) * (s[2][1] - cyy)) / area, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * s[0][2] + w1 * s[1][2] + w2 * s[2][2], i = py * W + px;
      if (z <= depth[i]) continue;
      depth[i] = z;
      let rgb = [tri.color[0] * 255, tri.color[1] * 255, tri.color[2] * 255];
      if (tri.texture && tri.uv) {
        const u = w0 * tri.uv[0][0] + w1 * tri.uv[1][0] + w2 * tri.uv[2][0], v = w0 * tri.uv[0][1] + w1 * tri.uv[1][1] + w2 * tri.uv[2][1];
        const T = tri.texture, tx = Math.min(T.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * T.width))), ty = Math.min(T.height - 1, Math.max(0, Math.floor((1 - (v - Math.floor(v))) * T.height)));
        const k = (ty * T.width + tx) * 4;
        rgb = [T.data[k] * tri.color[0], T.data[k + 1] * tri.color[1], T.data[k + 2] * tri.color[2]];
      }
      color[i * 4] = rgb[0] * shade; color[i * 4 + 1] = rgb[1] * shade; color[i * 4 + 2] = rgb[2] * shade; color[i * 4 + 3] = 255;
    }
  }
  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let dy = 0; dy < ss; dy++) for (let dx = 0; dx < ss; dx++) { const i = ((y * ss + dy) * W + (x * ss + dx)) * 4, al = color[i + 3] / 255; r += color[i] * al; g += color[i + 1] * al; b += color[i + 2] * al; a += al; }
    const o = (y * size + x) * 4;
    if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
    out[o + 3] = (a / (ss * ss)) * 255;
  }
  return out;
}

// Column-major model matrix from a saved record's position / rotation / scale.
function thumbnailRecordMatrix(record) {
  const p = record.position || [0, 0, 0], s = record.scale || [1, 1, 1];
  const q = Array.isArray(record.quaternion) && record.quaternion.length === 4 ? record.quaternion : (() => { const h = (record.rotationY || 0) / 2; return [0, Math.sin(h), 0, Math.cos(h)]; })();
  const [x, y, z, w] = q;
  const r = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)];
  return [r[0] * s[0], r[1] * s[0], r[2] * s[0], 0, r[3] * s[1], r[4] * s[1], r[5] * s[1], 0, r[6] * s[2], r[7] * s[2], r[8] * s[2], 0, p[0], p[1], p[2], 1];
}
const IDENTITY16 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// --- Browser side: textures, caching, decorating the lists ---
const thumbnailCache = new Map(); // key -> dataURL
const textureDataCache = new Map(); // texture id -> {width,height,data} | null (not decoded yet)
function thumbnailTextureData(textureId) {
  if (!textureId) return null;
  if (textureDataCache.has(textureId) && textureDataCache.get(textureId)) return textureDataCache.get(textureId);
  const texture = findTextureAssetById(textureId), image = texture && texture.image;
  if (!image || !(image.naturalWidth || image.width)) return null;
  const w = Math.min(256, image.naturalWidth || image.width), h = Math.min(256, image.naturalHeight || image.height);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(image, 0, 0, w, h);
  const data = { width: w, height: h, data: g.getImageData(0, 0, w, h).data };
  textureDataCache.set(textureId, data);
  return data;
}
function thumbnailTexturePending(textureId) {
  const texture = textureId ? findTextureAssetById(textureId) : null;
  return !!texture && !texture.decodeError && !thumbnailTextureData(textureId);
}
function thumbnailDataURL(parts) {
  const pixels = rasterizeThumbnail(parts);
  const c = document.createElement('canvas'); c.width = THUMB_SIZE; c.height = THUMB_SIZE;
  c.getContext('2d').putImageData(new ImageData(pixels, THUMB_SIZE, THUMB_SIZE), 0, 0);
  return c.toDataURL('image/png');
}
function assetThumbnailParts(asset) {
  if (!asset || !asset.positions || !asset.positions.length) return null;
  return [{ positions: asset.positions, indices: asset.indices, uvs: asset.uvs, texture: thumbnailTextureData(asset.textureAssetId), color: [1, 1, 1], matrix: IDENTITY16 }];
}
function prefabThumbnailParts(prefab) {
  const records = Array.isArray(prefab.records) && prefab.records.length ? prefab.records : prefab.record ? [prefab.record] : [];
  const parts = [];
  for (const record of records) {
    if (!record || record.kind !== 'cube') continue;
    const asset = record.assetId ? findAssetById(record.assetId) : null;
    const mesh = asset && asset.positions ? asset : unitCubeArrays;
    const color = Array.isArray(record.color) ? record.color.slice(0, 3) : [0.8, 0.8, 0.82];
    parts.push({ positions: mesh.positions, indices: mesh.indices, uvs: asset ? asset.uvs : null, texture: asset ? thumbnailTextureData(record.textureAssetId || asset.textureAssetId) : thumbnailTextureData(record.textureAssetId), color: asset ? [1, 1, 1] : color, matrix: thumbnailRecordMatrix(record) });
  }
  return parts.length ? parts : null;
}
function thumbnailKey(kind, id, parts) {
  return kind + '|' + id + '|' + parts.map((p) => p.positions.length + ':' + (p.texture ? 't' : '-') + ':' + p.matrix.map((v) => v.toFixed(2)).join(',') + ':' + p.color.join(',')).join(';');
}
let thumbnailQueue = [], thumbnailScheduled = false;
function queueThumbnail(img, kind, id, getParts, waitForTexture = () => false, tries = 0) {
  thumbnailQueue.push({ img, kind, id, getParts, waitForTexture, tries });
  if (thumbnailScheduled) return;
  thumbnailScheduled = true;
  const run = () => {
    const started = performance.now();
    while (thumbnailQueue.length && performance.now() - started < 12) {
      const job = thumbnailQueue.shift();
      if (!job.img.isConnected) continue;
      // A texture still decoding: draw later (up to ~5 s) instead of caching a grey picture.
      if (job.waitForTexture() && job.tries < 25) { setTimeout(() => queueThumbnail(job.img, job.kind, job.id, job.getParts, job.waitForTexture, job.tries + 1), 200); continue; }
      const parts = job.getParts();
      if (!parts) { job.img.remove(); continue; }
      const key = thumbnailKey(job.kind, job.id, parts);
      if (!thumbnailCache.has(key)) { try { thumbnailCache.set(key, thumbnailDataURL(parts)); } catch (error) { job.img.remove(); continue; } }
      job.img.src = thumbnailCache.get(key);
      job.img.classList.add('ready');
    }
    if (thumbnailQueue.length) setTimeout(run, 16); else thumbnailScheduled = false;
  };
  setTimeout(run, 0);
}
function decorateThumbnailRows() {
  for (const row of document.querySelectorAll('#asset-library-list .asset-row[data-asset-id]')) {
    if (row.querySelector('.asset-thumb')) continue;
    const img = document.createElement('img');
    img.className = 'asset-thumb'; img.alt = ''; img.width = THUMB_SIZE; img.height = THUMB_SIZE;
    row.querySelector('.asset-row-header')?.prepend(img);
    const id = row.dataset.assetId;
    queueThumbnail(img, 'asset', id, () => assetThumbnailParts(findAssetById(id)), () => thumbnailTexturePending(findAssetById(id)?.textureAssetId));
  }
  for (const row of document.querySelectorAll('#palette-prefabs .palette-item[id^="palette-prefab-"]')) {
    if (row.querySelector('.asset-thumb')) continue;
    const prefab = prefabs[Number(row.id.slice('palette-prefab-'.length))];
    if (!prefab) continue;
    const img = document.createElement('img');
    img.className = 'asset-thumb prefab-thumb'; img.alt = ''; img.width = 40; img.height = 40;
    row.prepend(img);
    queueThumbnail(img, 'prefab', prefab.name, () => prefabThumbnailParts(prefab));
  }
}
if (typeof MutationObserver !== 'undefined') {
  for (const id of ['asset-library-list', 'palette-prefabs']) {
    const el = document.getElementById(id);
    if (el) new MutationObserver(() => decorateThumbnailRows()).observe(el, { childList: true });
  }
  decorateThumbnailRows();
}
