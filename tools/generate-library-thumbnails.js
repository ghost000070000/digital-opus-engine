'use strict';
// Renders a thumbnail PNG for every Content Library model into
// assets/showcase/thumbs/<key>.png with a tiny dependency-free software
// rasterizer: three-quarter view, orthographic, z-buffered triangles coloured
// from the model's texture at each pixel's UV, simple directional lighting,
// 2x supersampling and a transparent background. Re-run after changing
// tools/showcase-assets.js output:  node tools/generate-library-thumbnails.js
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..', 'assets', 'showcase');
const SIZE = 112, SS = 2, W = SIZE * SS;

function crc32(buffer) { let c = 0xffffffff; for (const b of buffer) { c ^= b; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; }
function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  const chunk = (name, data) => { const n = Buffer.from(name), len = Buffer.alloc(4), crc = Buffer.alloc(4); len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([n, data]))); return Buffer.concat([len, n, data, crc]); };
  const head = Buffer.alloc(13); head.writeUInt32BE(width); head.writeUInt32BE(height, 4); head[8] = 8; head[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// Minimal 8-bit RGB/RGBA PNG decoder (the showcase textures are generated as such).
function decodePNG(buffer) {
  let offset = 8, width = 0, height = 0, colorType = 0; const idat = [];
  while (offset < buffer.length) {
    const len = buffer.readUInt32BE(offset), type = buffer.toString('ascii', offset + 4, offset + 8), data = buffer.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]; if (data[8] !== 8 || ![2, 6].includes(colorType)) throw new Error('Unsupported PNG'); }
    else if (type === 'IDAT') idat.push(data);
    offset += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : 3, stride = width * bpp, raw = zlib.inflateSync(Buffer.concat(idat)), out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      const pred = filter === 1 ? a : filter === 2 ? b : filter === 3 ? ((a + b) >> 1) : filter === 4 ? (() => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; })() : 0;
      line[x] = (line[x] + pred) & 255;
    }
    for (let x = 0; x < width; x++) { const s = x * bpp, d = (y * width + x) * 4; out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2]; out[d + 3] = bpp === 4 ? line[s + 3] : 255; }
    prev = line;
  }
  return { width, height, data: out };
}

function render(mesh, texture) {
  const P = mesh.positions, N = mesh.normals, UV = mesh.uvs, I = mesh.indices;
  const yaw = -Math.PI / 4.6, pitch = 0.42, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const view = (x, y, z) => { const rx = x * cy - z * sy, rz = x * sy + z * cy; return [rx, y * cp - rz * sp, y * sp + rz * cp]; };
  const count = P.length / 3, vx = new Float32Array(count), vy = new Float32Array(count), vz = new Float32Array(count);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < count; i++) { const v = view(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); vx[i] = v[0]; vy[i] = v[1]; vz[i] = v[2]; minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]); minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]); }
  const scale = (W * 0.84) / Math.max(maxX - minX, maxY - minY, 1e-6), ox = W / 2 - (minX + maxX) / 2 * scale, oy = W / 2 + (minY + maxY) / 2 * scale;
  const sx = new Float32Array(count), syy = new Float32Array(count);
  for (let i = 0; i < count; i++) { sx[i] = ox + vx[i] * scale; syy[i] = oy - vy[i] * scale; }
  const color = Buffer.alloc(W * W * 4), depth = new Float32Array(W * W).fill(-Infinity);
  const light = (() => { const l = [0.45, 0.85, 0.35], n = Math.hypot(...l); return l.map((v) => v / n); })();
  const sample = (u, v) => {
    if (!texture) return [200, 200, 205];
    const x = Math.min(texture.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * texture.width)));
    const y = Math.min(texture.height - 1, Math.max(0, Math.floor((1 - (v - Math.floor(v))) * texture.height)));
    const i = (y * texture.width + x) * 4; return [texture.data[i], texture.data[i + 1], texture.data[i + 2]];
  };
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const x0 = sx[a], y0 = syy[a], x1 = sx[b], y1 = syy[b], x2 = sx[c], y2 = syy[c];
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < 1e-9) continue;
    // Flat lighting per face from the averaged vertex normals (world space).
    let nx = N[a * 3] + N[b * 3] + N[c * 3], ny = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1], nz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2];
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const shade = 0.42 + 0.68 * Math.max(0, nx * light[0] + ny * light[1] + nz * light[2]);
    const bx0 = Math.max(0, Math.floor(Math.min(x0, x1, x2))), bx1 = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
    const by0 = Math.max(0, Math.floor(Math.min(y0, y1, y2))), by1 = Math.min(W - 1, Math.ceil(Math.max(y0, y1, y2)));
    for (let py = by0; py <= by1; py++) for (let px = bx0; px <= bx1; px++) {
      const cx = px + 0.5, cyy = py + 0.5;
      const w0 = ((x1 - cx) * (y2 - cyy) - (x2 - cx) * (y1 - cyy)) / area, w1 = ((x2 - cx) * (y0 - cyy) - (x0 - cx) * (y2 - cyy)) / area, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * vz[a] + w1 * vz[b] + w2 * vz[c], i = py * W + px;
      if (z <= depth[i]) continue;
      depth[i] = z;
      const rgb = UV ? sample(w0 * UV[a * 2] + w1 * UV[b * 2] + w2 * UV[c * 2], w0 * UV[a * 2 + 1] + w1 * UV[b * 2 + 1] + w2 * UV[c * 2 + 1]) : [200, 200, 205];
      color[i * 4] = Math.min(255, rgb[0] * shade); color[i * 4 + 1] = Math.min(255, rgb[1] * shade); color[i * 4 + 2] = Math.min(255, rgb[2] * shade); color[i * 4 + 3] = 255;
    }
  }
  // Downsample with premultiplied averaging for smooth, transparent edges.
  const out = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    let r = 0, g = 0, bl = 0, al = 0;
    for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) { const i = ((y * SS + dy) * W + (x * SS + dx)) * 4, alpha = color[i + 3] / 255; r += color[i] * alpha; g += color[i + 1] * alpha; bl += color[i + 2] * alpha; al += alpha; }
    const o = (y * SIZE + x) * 4;
    if (al > 0) { out[o] = Math.round(r / al); out[o + 1] = Math.round(g / al); out[o + 2] = Math.round(bl / al); }
    out[o + 3] = Math.round((al / (SS * SS)) * 255);
  }
  return encodePNG(SIZE, SIZE, out);
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const textures = new Map();
  const textureFor = (id) => {
    if (!id) return null;
    if (!textures.has(id)) { const entry = manifest.textures.find((t) => t.id === id); textures.set(id, entry ? decodePNG(fs.readFileSync(path.join(ROOT, entry.file))) : null); }
    return textures.get(id);
  };
  fs.mkdirSync(path.join(ROOT, 'thumbs'), { recursive: true });
  let written = 0;
  for (const entry of manifest.meshes) {
    if (entry.key.startsWith('hero-')) continue;
    const mesh = JSON.parse(fs.readFileSync(path.join(ROOT, entry.file), 'utf8'));
    const pngBytes = render(mesh, textureFor(mesh.textureAssetId));
    const target = path.join(ROOT, 'thumbs', entry.key + '.png');
    let current = null; try { current = fs.readFileSync(target); } catch (error) { /* new */ }
    if (!current || !current.equals(pngBytes)) { fs.writeFileSync(target + '.tmp', pngBytes); fs.renameSync(target + '.tmp', target); written++; }
  }
  console.log(`Library thumbnails: ${written} written, ${manifest.meshes.filter((m) => !m.key.startsWith('hero-')).length} total -> assets/showcase/thumbs`);
}
if (require.main === module) main();
module.exports = { decodePNG, render };
