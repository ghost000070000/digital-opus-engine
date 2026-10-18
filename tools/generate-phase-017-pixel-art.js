'use strict';

// Generates a dependency-free 16x16 RGBA PNG used by Phase 017 browser
// dogfood. Keeping the recipe checked in makes the binary fixture reproducible.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const width = 16;
const height = 16;
const bytes = Buffer.alloc((width * 4 + 1) * height);
for (let y = 0; y < height; y++) {
  const row = y * (width * 4 + 1);
  bytes[row] = 0;
  for (let x = 0; x < width; x++) {
    const offset = row + 1 + x * 4;
    const border = x === 1 || x === 14 || y === 1 || y === 14;
    const eye = y >= 5 && y <= 7 && (x === 5 || x === 10);
    const mouth = y === 11 && x >= 5 && x <= 10;
    const transparent = x === 0 || x === 15 || y === 0 || y === 15;
    const color = transparent ? [0, 0, 0, 0]
      : border ? [19, 37, 54, 255]
      : (eye || mouth) ? [255, 232, 152, 255]
      : ((x + y) % 2 ? [0, 206, 209, 255] : [0, 151, 167, 255]);
    bytes[offset] = color[0]; bytes[offset + 1] = color[1]; bytes[offset + 2] = color[2]; bytes[offset + 3] = color[3];
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); name.copy(out, 4); data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return out;
}

const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
header[8] = 8; header[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(bytes)), chunk('IEND', Buffer.alloc(0)),
]);
const output = path.join(__dirname, '..', 'tests', 'fixtures', 'phase-017-pixel-art.png');
fs.writeFileSync(output, png);
console.log(`Generated ${path.relative(path.join(__dirname, '..'), output)} (${png.length} bytes)`);
