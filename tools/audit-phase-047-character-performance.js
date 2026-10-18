'use strict';
// Supplemental post-endurance Character throughput probe on a 10,240-cell
// slope Tilemap. This does not replace the qualifying four-hour run.
const assert = require('assert');
const { performance } = require('perf_hooks');
const Collider = require('../editor/src/00-collider-2d.js');
const Body = require('../editor/src/00-body-2d.js');
const Plumbing = require('../editor/src/00-authoring-plumbing.js');
const Query = require('../editor/src/00-character-tile-query.js');

const tileset = Plumbing.createTileset({ id: 'phase-047-perf-tiles', cellSize: { width: 1, height: 1 },
  tiles: [{ id: 'slope', collision: { mode: 'slope', slope: 'up-right', oneWay: false } },
    { id: 'one-way-slope', collision: { mode: 'slope', slope: 'up-right', oneWay: true } },
    { id: 'rectangle', collision: { mode: 'full-cell', oneWay: false } }] });
const cells = [];
const tileIds = ['slope', 'one-way-slope', 'rectangle'];
function tileKind(x, y) { return ((x + y) % 3 + 3) % 3; }
for (let y = -40; y < 40; y++) for (let x = -64; x < 64; x++) cells.push({ x, y, tileId: tileIds[tileKind(x, y)] });
const map = Plumbing.createTilemapRecord({ id: 'phase-047-perf-map', tilesetRef: tileset.id,
  layers: [{ id: 'ground', collisionEnabled: true, cells }] });
map.entity = { position: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 },
  up: { x: 0, y: 1, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
assert.strictEqual(map.layers[0].cells.length, 10240);

function actor(i) {
  const cellX = -55 + i % 10 * 11, cellY = -35 + Math.floor(i / 10) * 7;
  const x = cellX + .25, y = cellY + (tileKind(cellX, cellY) === 2 ? 1.5 : 1.25);
  return { id: `character-${i}`, kind: 'cube', entity: { position: { x, y, z: 0 } },
    worldMatrix: Collider.composeMatrix({ position: [x, y, 0] }), components: {
      'body-2d': { version: 1, enabled: true, type: 'kinematic', linearVelocity: [.25, 0] },
      'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size: [1, 1] },
      'character-collision-2d': { version: 2, enabled: true, wallSlideEnabled: true,
        wallSlideMaxSpeed: 3, slopeHandlingEnabled: true, maxSlopeAngle: 50,
        stepHandlingEnabled: true, maxStepHeight: .5 } } };
}
function run(characterCount) {
  const actors = Array.from({ length: characterCount }, (_, i) => actor(i));
  const queryMetrics = {};
  const manager = Body.createBody2DManager({ tileObstacles: (mover, bounds) =>
    Query.query([map], [tileset], mover, bounds, queryMetrics) });
  const before = process.memoryUsage().heapUsed;
  const started = performance.now();
  let groundedTicks = 0; const samples = [];
  for (let tick = 0; tick < 120; tick++) {
    const tickStarted = performance.now();
    const results = manager.tick(actors, 1 / 60);
    samples.push(performance.now() - tickStarted);
    assert.strictEqual(results.length, characterCount);
    for (const moving of actors) if (manager.getCharacterCollision2DState(moving.id).grounded) groundedTicks++;
  }
  const durationMs = performance.now() - started;
  samples.sort((a, b) => a - b);
  return { characters: characterCount, ticks: 120, characterTicks: characterCount * 120,
    durationMs: Math.round(durationMs), msPerTick: +(durationMs / 120).toFixed(3),
    medianMs: +samples[59].toFixed(3), p95Ms: +samples[113].toFixed(3),
    groundedTicks, candidateCells: queryMetrics.candidateCells || 0,
    collisionCells: queryMetrics.collisionCells || 0,
    heapBefore: before, heapAfter: process.memoryUsage().heapUsed };
}
const single = run(1), hundred = run(100);
assert(single.groundedTicks > 0 && hundred.groundedTicks > 0);
assert(single.candidateCells < 1000000 && hundred.candidateCells < 10000000);
console.log(JSON.stringify({ audit: 'phase-047-character-10240-performance', mapCells: 10240,
  single, hundred, passed: true }));
