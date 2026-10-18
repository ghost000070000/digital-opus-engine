'use strict';
const assert = require('assert');
const plumbing = require('../editor/src/00-authoring-plumbing.js');
const collider = require('../editor/src/00-collider-2d.js');
const body = require('../editor/src/00-body-2d.js');
const query = require('../editor/src/00-character-tile-query.js');
const tileset = plumbing.createTileset({ id: 'tiles', cellSize: { width: 1, height: 1 }, tiles: [
  { id: 'one-way', name: 'One-Way', collision: { mode: 'full-cell', oneWay: true } },
  { id: 'solid', name: 'Solid', collision: { mode: 'full-cell' } },
  { id: 'none', name: 'None', collision: { mode: 'none' } },
] });
const cells = Array.from({ length: 10240 }, (_, i) => ({ x: i % 128, y: Math.floor(i / 128), tileId: i < 128 ? 'one-way' : i % 5 === 0 ? 'one-way' : i % 7 === 0 ? 'solid' : 'none' }));
const map = plumbing.createTilemapRecord({ id: 'map', tilesetRef: 'tiles', layers: [{ id: 'base', name: 'Base', collisionEnabled: true, cells }] });
map.entity = { position: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
plumbing.ensureTilemapCellIndex(map, 'base');
function character(i) {
  const x = i + .5, y = 1.5;
  return { id: `char-${i}`, kind: 'cube', entity: { position: { x, y, z: 0 } }, worldMatrix: collider.composeMatrix({ position: [x, y, 0] }), components: {
    'body-2d': { version: 1, enabled: true, type: 'kinematic', linearVelocity: [1, -4] },
    'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size: [1, 1] },
    'character-collision-2d': { version: 1, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3 },
  } };
}
function platform(i) {
  const x = i * .1 - 5, y = i * .04 - 2;
  return { id: `platform-${i}`, kind: 'cube', entity: { position: { x, y, z: 0 } }, worldMatrix: collider.composeMatrix({ position: [x, y, 0] }), components: {
    'body-2d': { version: 1, enabled: true, type: 'static', linearVelocity: [0, 0] },
    'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size: [2, .1] },
    'one-way-platform-2d': { version: 1, enabled: true },
  } };
}
function measure(count, platformCount = 0) {
  const times = [], snapshots = [];
  for (let repeat = 0; repeat < 35; repeat++) {
    const chars = Array.from({ length: count }, (_, i) => character(i));
    const platforms = Array.from({ length: platformCount }, (_, i) => platform(i));
    const metrics = {};
    const manager = body.createBody2DManager({ tileObstacles: (mover, bounds) => query.query([map], [tileset], mover, bounds, metrics) });
    const start = performance.now(); manager.tick([...chars, ...platforms], .1); const elapsed = performance.now() - start;
    if (repeat >= 5) { times.push(elapsed); snapshots.push({ ...metrics, ...manager.metrics }); }
  }
  times.sort((a, b) => a - b);
  return { count, platformCount, medianMs: times[15], p95Ms: times[28], metrics: snapshots[15] };
}
const result = { cells: cells.length, oneWayCells: cells.filter((cell) => cell.tileId === 'one-way').length,
  zero: measure(0), one: measure(1), hundred: measure(100), stacked: measure(1, 100) };
assert.strictEqual(result.zero.metrics.candidateCells || 0, 0);
assert(result.one.metrics.candidateCells < 500 && result.one.medianMs < 2 && result.one.p95Ms < 5, JSON.stringify(result.one));
assert(result.hundred.metrics.candidateCells < 50000 && result.hundred.medianMs < 50, JSON.stringify(result.hundred));
assert(result.stacked.medianMs < 50, JSON.stringify(result.stacked));
console.log(JSON.stringify(result, null, 2));
