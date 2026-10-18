'use strict';
const assert = require('assert');
const Plumbing = require('../editor/src/00-authoring-plumbing.js');
const Query = require('../editor/src/00-character-tile-query.js');
const tileset = Plumbing.createTileset({ id: 'tiles', cellSize: { width: 1, height: 1 }, tiles: [
  { id: 'r', collision: { mode: 'slope', slope: 'up-right', oneWay: false } },
  { id: 'l', collision: { mode: 'slope', slope: 'up-left', oneWay: false } },
] });
const cells = [];
for (let y = -50; y < 50; y++) for (let x = -50; x < 50; x++) cells.push({ x, y, tileId: (x + y & 1) ? 'l' : 'r' });
const map = Plumbing.createTilemapRecord({ id: 'map', tilesetRef: 'tiles', layers: [{ id: 'ground', collisionEnabled: true, cells }] });
map.entity = { position: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
assert.strictEqual(map.layers[0].cells.length, 10000);
const before = process.memoryUsage().heapUsed;
const started = performance.now();
const metrics = {};
let slopeHits = 0;
for (let i = 0; i < 10000; i++) {
  const x = i * 73 % 96 - 48, y = i * 37 % 96 - 48;
  const result = Query.query([map], [tileset], { id: 'm' }, { minX: x, minY: y, maxX: x + 2, maxY: y + 2 }, metrics);
  assert(result.length <= 25);
  slopeHits += result.length;
}
const ms = performance.now() - started;
const after = process.memoryUsage().heapUsed;
assert(metrics.candidateCells < 1000000, `local query scanned too many cells: ${metrics.candidateCells}`);
assert(slopeHits > 0 && metrics.collisionCells === slopeHits);
console.log(JSON.stringify({ audit: 'phase-047-10k-tile-slope', cells: 10000, queries: 10000, candidateCells: metrics.candidateCells,
  collisionCells: metrics.collisionCells, slopeHits, durationMs: Math.round(ms), heapBefore: before, heapAfter: after, passed: true }));
