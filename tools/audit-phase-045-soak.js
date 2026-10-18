'use strict';
const assert = require('assert');
const plumbing = require('../editor/src/00-authoring-plumbing.js');
const collider = require('../editor/src/00-collider-2d.js');
const body = require('../editor/src/00-body-2d.js');
const trigger = require('../editor/src/00-trigger-collider-2d.js');
const tileQuery = require('../editor/src/00-character-tile-query.js');
const minutes = Number(process.env.PHASE045_SOAK_MINUTES || 30);
assert(Number.isFinite(minutes) && minutes >= 0.1 && minutes <= 60);
const tileset = plumbing.createTileset({ id: 'tiles', cellSize: { width: 1, height: 1 }, tiles: [{ id: 'solid', name: 'Solid', collision: { mode: 'full-cell' } }] });
const map = plumbing.createTilemapRecord({ id: 'map', tilesetRef: 'tiles', layers: [
  { id: 'hidden-floor', name: 'Hidden Floor', visible: false, locked: true, collisionEnabled: true, cells: Array.from({ length: 12 }, (_, i) => ({ x: i - 6, y: 0, tileId: 'solid' })) },
  { id: 'disabled', name: 'Disabled', collisionEnabled: false, cells: [{ x: 0, y: 3, tileId: 'solid' }] },
] });
map.entity = { position: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
function object(id, x, y, type, velocity, size = [1, 1]) {
  return { id, kind: 'cube', entity: { position: { x, y, z: 0 } }, worldMatrix: collider.composeMatrix({ position: [x, y, 0] }), components: {
    'body-2d': { version: 1, enabled: true, type, linearVelocity: velocity },
    'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size },
    ...(type === 'kinematic' ? { 'character-collision-2d': { version: 1, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3 } } : {}),
  } };
}
const wall = object('wall', 2, 4, 'static', [0, 0], [.5, 6]);
const ceiling = object('ceiling', 0, 6, 'static', [0, 0], [5, .5]);
const sensor = { id: 'sensor', kind: 'cube', entity: { position: { x: -2, y: 3, z: 0 } }, worldMatrix: collider.composeMatrix({ position: [-2, 3, 0] }), components: {
  'trigger-collider-2d': { version: 1, enabled: true, shape: 'box', offset: [0, 0], size: [1, 2], radius: 1 },
} };
const events = [];
const lifecycle = trigger.createTriggerLifecycle({ emit: (event) => { if (events.length < 1000) events.push(event.eventType); } });
const queryMetrics = {};
const manager = body.createBody2DManager({ tileObstacles: (mover, bounds) => tileQuery.query([map], [tileset], mover, bounds, queryMetrics) });
const started = Date.now(), end = started + minutes * 60000;
if (global.gc) global.gc();
const memoryStart = process.memoryUsage().heapUsed;
let ticks = 0, groundedTicks = 0, wallTicks = 0, slideTicks = 0, blockedX = 0, blockedY = 0;
let nextHeartbeat = started + 10 * 60000;
function iteration() {
  const mode = ticks % 8;
  const configs = [
    [-3, 1.5, [0, -12]], [0, 4, [8, -12]], [1.25, 4, [0, -12]], [1.25, 4, [-12, -12]],
    [0, 4, [0, 12]], [0, 1.5, [0, -12]], [-2, 3, [0, -12]], [0, 4, [0, 0]],
  ];
  const [x, y, velocity] = configs[mode];
  const character = object('character', x, y, 'kinematic', velocity);
  const objects = mode === 0 || mode === 5 ? [character, sensor] : [character, wall, ceiling, sensor];
  const move = manager.tick(objects, 1 / 60, objects)[0].result;
  lifecycle.tick(objects);
  const state = manager.getCharacterCollision2DState('character');
  assert(Number.isFinite(character.entity.position.x) && Number.isFinite(character.entity.position.y));
  groundedTicks += Number(state.grounded); wallTicks += Number(state.wallLeft || state.wallRight); slideTicks += Number(state.wallSliding);
  blockedX += Number(move.blockedX); blockedY += Number(move.blockedY);
  if (ticks % 300 === 0) {
    const saved = plumbing.serializeTilemapLayers(map);
    assert.strictEqual(saved[0].collisionEnabled, true);
    assert.strictEqual(saved[1].collisionEnabled, false);
  }
  if (ticks % 600 === 0) { manager.clearCharacterCollision2DState(); lifecycle.reset(); }
  ticks++;
  if (Date.now() >= nextHeartbeat) { console.log(`heartbeat ${Math.round((Date.now() - started) / 60000)}m: ${ticks} ticks, ${slideTicks} wall slides`); nextHeartbeat += 10 * 60000; }
}
async function main() {
  while (Date.now() < end) { for (let batch = 0; batch < 10; batch++) iteration(); await new Promise((resolve) => setTimeout(resolve, 100)); }
  if (global.gc) global.gc();
  const result = { durationMs: Date.now() - started, ticks, groundedTicks, wallTicks, slideTicks, blockedX, blockedY,
    candidateSlots: queryMetrics.candidateCells || 0, collisionCells: queryMetrics.collisionCells || 0,
    staticCandidates: manager.metrics.candidates, narrowTests: manager.metrics.narrowTests, triggerEvents: events.length,
    heapStart: memoryStart, heapEnd: process.memoryUsage().heapUsed };
  console.log(JSON.stringify(result));
  assert(result.durationMs >= minutes * 60000);
  assert(ticks > 0 && wallTicks > 0 && slideTicks > 0 && groundedTicks > 0);
}
main().catch((error) => { console.error(error.stack); process.exitCode = 1; });
