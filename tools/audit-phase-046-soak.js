'use strict';
const assert = require('assert');
const collider = require('../editor/src/00-collider-2d.js');
const plumbing = require('../editor/src/00-authoring-plumbing.js');
const body = require('../editor/src/00-body-2d.js');
const tileQuery = require('../editor/src/00-character-tile-query.js');
const trigger = require('../editor/src/00-trigger-collider-2d.js');
const minutes = Number(process.env.PHASE046_SOAK_MINUTES || 30);
assert(Number.isFinite(minutes) && minutes >= .1 && minutes <= 60);
const tileset = plumbing.createTileset({ id: 'tiles', cellSize: { width: 2, height: 1 }, tiles: [
  { id: 'full', name: 'Full', collision: { mode: 'full-cell', oneWay: true } },
  { id: 'custom', name: 'Custom', collision: { mode: 'custom-rect', oneWay: true, rect: { minX: .2, minY: .1, maxX: .8, maxY: .6 } } },
] });
const map = plumbing.createTilemapRecord({ id: 'map', tilesetRef: 'tiles', layers: [
  { id: 'hidden', name: 'Hidden', visible: false, locked: true, collisionEnabled: true, cells: [{ x: 4, y: 0, tileId: 'full' }, { x: 6, y: 0, tileId: 'custom', terrainBrushId: 'terrain', autoTileSetId: 'auto' }] },
  { id: 'disabled', name: 'Disabled', collisionEnabled: false, cells: [{ x: 8, y: 0, tileId: 'full' }] },
] });
map.entity = { position: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
function object(id, x, y, type, velocity, size = [1, 1], rotation = 0) {
  return { id, kind: 'cube', entity: { position: { x, y, z: 0 } }, worldMatrix: collider.composeMatrix({ position: [x, y, 0], rotation }), components: {
    'body-2d': { version: 1, enabled: true, type, linearVelocity: velocity },
    'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size },
    ...(type === 'kinematic' ? { 'character-collision-2d': { version: 1, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3 } } : { 'one-way-platform-2d': { version: 1, enabled: true } }),
  } };
}
const sensor = { id: 'sensor', kind: 'cube', entity: { position: { x: 0, y: 1, z: 0 } }, worldMatrix: collider.composeMatrix({ position: [0, 1, 0] }), components: {
  'trigger-collider-2d': { version: 1, enabled: true, shape: 'box', offset: [0, 0], size: [1, 1], radius: 1 },
} };
let triggerEvents = 0;
const lifecycle = trigger.createTriggerLifecycle({ emit: () => { triggerEvents++; } });
const queryMetrics = {};
const manager = body.createBody2DManager({ tileObstacles: (mover, bounds) => tileQuery.query([map], [tileset], mover, bounds, queryMetrics) });
const started = Date.now(), end = started + minutes * 60000;
if (global.gc) global.gc();
const heapStart = process.memoryUsage().heapUsed;
let ticks = 0, upwardPasses = 0, landings = 0, groundedTicks = 0, edgeDepartures = 0, highSpeed = 0, fallbackSolid = 0;
let nextHeartbeat = started + 10 * 60000;
function iteration() {
  const mode = ticks % 10;
  const cfg = [
    [0, -2, 0, 30], [0, 5, 0, -100], [9, -1, 0, 30], [9, 5, 0, -100], [0, 50, 0, -1000],
    [0, 1, -60, 0], [0, 6, 0, -100], [0, -3, 0, 40], [17, 5, 0, -100], [0, -2, 0, 30],
  ][mode];
  const mover = object('m', cfg[0], cfg[1], 'kinematic', [cfg[2], cfg[3]]);
  const scene = mode === 0 || mode === 1 || mode === 4 || mode === 5 || mode === 9 ? [object('platform', 0, 0, 'static', [0, 0], [4, 1])] :
    mode === 6 ? [object('upper', 0, 2, 'static', [0, 0], [4, 1]), object('lower', 0, 0, 'static', [0, 0], [4, 1])] :
      mode === 7 ? [object('rotated', 0, 0, 'static', [0, 0], [4, 1], .3)] : [];
  const objects = [mover, ...scene];
  const move = manager.tick(objects, .1)[0].result;
  const state = manager.getCharacterCollision2DState('m');
  assert(Number.isFinite(mover.entity.position.x) && Number.isFinite(mover.entity.position.y));
  if (mode === 0 || mode === 2 || mode === 9) { assert(!move.blockedY && !state.ceiling); upwardPasses++; }
  if (mode === 1 || mode === 3 || mode === 4 || mode === 6) { assert(move.blockedY && state.grounded); landings++; }
  if (mode === 4) highSpeed++;
  if (mode === 5) { assert(!state.grounded); edgeDepartures++; }
  if (mode === 7) { assert(move.blockedY && !state.grounded); fallbackSolid++; }
  if (mode === 8) assert(!state.grounded && !move.blockedY);
  groundedTicks += Number(state.grounded);
  if (mode === 9) lifecycle.tick([mover, sensor]);
  if (ticks % 300 === 0) {
    const saved = plumbing.createTileset(JSON.parse(JSON.stringify(tileset)));
    assert(saved.tiles[0].collision.oneWay && saved.tiles[1].collision.oneWay);
    const layers = plumbing.serializeTilemapLayers(map); assert(layers[0].collisionEnabled && !layers[1].collisionEnabled);
  }
  if (ticks % 600 === 0) { manager.clearCharacterCollision2DState(); lifecycle.reset(); }
  ticks++;
  if (Date.now() >= nextHeartbeat) { console.log(`heartbeat ${Math.round((Date.now() - started) / 60000)}m: ${ticks} ticks, ${landings} landings`); nextHeartbeat += 10 * 60000; }
}
async function main() {
  while (Date.now() < end) { for (let i = 0; i < 10; i++) iteration(); await new Promise((resolve) => setTimeout(resolve, 100)); }
  if (global.gc) global.gc();
  const result = { durationMs: Date.now() - started, ticks, upwardPasses, landings, groundedTicks, edgeDepartures, highSpeed,
    fallbackSolid, tileCandidateSlots: queryMetrics.candidateCells || 0, tileCollisionShapes: queryMetrics.collisionCells || 0,
    platformCandidates: manager.metrics.staticShapeResolutions, narrowTests: manager.metrics.narrowTests, triggerEvents,
    heapStart, heapEnd: process.memoryUsage().heapUsed };
  console.log(JSON.stringify(result));
  assert(result.durationMs >= minutes * 60000 && ticks > 0 && upwardPasses > 0 && landings > 0 && edgeDepartures > 0);
}
main().catch((error) => { console.error(error.stack); process.exitCode = 1; });
