'use strict';

// Reproducible 4x4 atlas: every 32px cell has a dramatically different
// solid field, border, and binary index marks for orientation/bleed proofs.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const cell = 32; const width = cell * 4; const height = cell * 4;
const palette = [
  [240,45,45], [35,215,80], [35,90,245], [250,210,30],
  [240,55,205], [30,220,220], [245,125,25], [135,65,235],
  [100,220,45], [240,85,120], [30,135,220], [220,220,220],
  [125,75,35], [30,80,55], [80,40,110], [20,20,25],
];
const bytes = Buffer.alloc((width * 4 + 1) * height);
for (let y = 0; y < height; y++) {
  const row = y * (width * 4 + 1); bytes[row] = 0;
  for (let x = 0; x < width; x++) {
    const cx = Math.floor(x / cell); const cy = Math.floor(y / cell); const index = cy * 4 + cx;
    const lx = x % cell; const ly = y % cell; const base = palette[index];
    const border = lx < 2 || ly < 2 || lx >= cell - 2 || ly >= cell - 2;
    const bitMark = ly >= 10 && ly < 22 && lx >= 5 && lx < 27 && ((index + 1) & (1 << Math.floor((lx - 5) / 6)));
    const color = border ? [255,255,255] : bitMark ? [5,5,8] : base;
    const offset = row + 1 + x * 4; bytes[offset] = color[0]; bytes[offset + 1] = color[1]; bytes[offset + 2] = color[2]; bytes[offset + 3] = 255;
  }
}
function crc32(buffer) { let crc = 0xffffffff; for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const name = Buffer.from(type, 'ascii'); const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); name.copy(out, 4); data.copy(out, 8); out.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length); return out; }
const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(bytes)), chunk('IEND', Buffer.alloc(0))]);
const output = path.join(__dirname, '..', 'tests', 'fixtures', 'phase-018-atlas.png'); fs.writeFileSync(output, png);
console.log(`Generated ${path.relative(path.join(__dirname, '..'), output)} (${png.length} bytes)`);
