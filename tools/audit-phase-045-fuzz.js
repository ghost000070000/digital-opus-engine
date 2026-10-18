'use strict';
const assert = require('assert');
const plumbing = require('../editor/src/00-authoring-plumbing.js');
const collider = require('../editor/src/00-collider-2d.js');
const body = require('../editor/src/00-body-2d.js');
const tileQuery = require('../editor/src/00-character-tile-query.js');
function rng(seed) { let value = seed >>> 0; return () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) / 4294967296; }; }
const tileset = plumbing.createTileset({ id: 'tiles', cellSize: { width: 1, height: 1 }, tiles: [{ id: 'solid', name: 'Solid', collision: { mode: 'full-cell' } }] });
const map = plumbing.createTilemapRecord({ id: 'map', tilesetRef: 'tiles', layers: [{ id: 'floor', name: 'Floor', cells: Array.from({ length: 8 }, (_, i) => ({ x: i - 2, y: 0, tileId: 'solid' })) }] });
map.entity = { position: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
function object(id, x, y, type, circle) { const shape = circle ? { 'circle-collider-2d': { version: 1, enabled: true, offset: [0, 0], radius: .25 } } : { 'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size: [.5, .5] } };
  return { id, kind: 'cube', entity: { position: { x, y, z: 0 } }, worldMatrix: collider.composeMatrix({ position: [x, y, 0] }), components: { 'body-2d': { version: 1, enabled: true, type, linearVelocity: [0, 0] }, ...shape,
    ...(type === 'kinematic' ? { 'character-collision-2d': { version: 1, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3 } } : {}) } }; }
let moves = 0, wallSlides = 0, tileCandidates = 0, narrowTests = 0;
const started = performance.now();
for (let seed = 1; seed <= 20; seed++) {
  const random = rng(seed * 0x9e3779b9), metrics = {};
  const manager = body.createBody2DManager({ tileObstacles: (mover, bounds) => tileQuery.query([map], [tileset], mover, bounds, metrics) });
  for (let i = 0; i < 25000; i++) {
    const mover = object('mover', 0, 2 + random() * 5, 'kinematic', random() < .5);
    const wall = object('wall', 3 + random() * 2, mover.entity.position.y + (random() - .5) * 2, 'static', random() < .5);
    const wallShapes = collider.enumerateCollider2DWorldShapes(wall), statics = [{ object: wall, shapes: wallShapes }];
    const delta = { x: random() * 10, y: -random() * 20 }, dt = .02 + random() * .2;
    const result = manager.moveCharacter2D(mover, delta, dt, statics);
    const moverShapes = collider.enumerateCollider2DWorldShapes(mover);
    for (const a of moverShapes) for (const b of wallShapes) assert(body.separation(a, b) >= -2e-6, `static penetration seed=${seed} case=${i}`);
    const bounds = moverShapes[0].aabb;
    for (const entry of tileQuery.query([map], [tileset], mover, bounds)) for (const a of moverShapes) for (const b of entry.shapes)
      assert(body.separation(a, b) >= -2e-6, `tile penetration seed=${seed} case=${i}`);
    assert(Number.isFinite(mover.entity.position.x) && Number.isFinite(mover.entity.position.y));
    assert(result.actualDelta.x >= -1e-8 && result.actualDelta.x <= delta.x + 1e-8);
    assert(result.actualDelta.y <= 1e-8 && result.actualDelta.y >= delta.y - 1e-8);
    if (result.wallSliding) { wallSlides++; assert(result.actualDelta.y >= -3 * dt - 1e-8); }
    assert.deepStrictEqual(mover.components['body-2d'].linearVelocity, [0, 0]);
    moves++;
  }
  tileCandidates += metrics.candidateCells || 0; narrowTests += manager.metrics.narrowTests;
  console.log(`seed ${seed}/20: ${moves} moves`);
}
console.log(JSON.stringify({ moves, seeds: 20, wallSlides, tileCandidates, narrowTests, elapsedMs: performance.now() - started }));
