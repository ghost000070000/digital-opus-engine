'use strict';
const assert = require('assert');
const collider = require('../editor/src/00-collider-2d.js');
const body = require('../editor/src/00-body-2d.js');
const plumbing = require('../editor/src/00-authoring-plumbing.js');
const tileQuery = require('../editor/src/00-character-tile-query.js');
const seeds = 20, casesPerSeed = Number(process.env.PHASE046_FUZZ_CASES_PER_SEED || 25000);
function rng(seed) { let x = seed >>> 0; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }
function object(id, x, y, type, velocity, size = [1, 1]) {
  return { id, kind: 'cube', entity: { position: { x, y, z: 0 } }, worldMatrix: collider.composeMatrix({ position: [x, y, 0] }), components: {
    'body-2d': { version: 1, enabled: true, type, linearVelocity: velocity },
    'box-collider-2d': { version: 1, enabled: true, offset: [0, 0], size },
    ...(type === 'kinematic' ? { 'character-collision-2d': { version: 1, enabled: true, wallSlideEnabled: true, wallSlideMaxSpeed: 3 } } : { 'one-way-platform-2d': { version: 1, enabled: true } }),
  } };
}
const tileset = plumbing.createTileset({ id: 'tiles', cellSize: { width: 2, height: 1 }, tiles: [
  { id: 'full', name: 'Full', collision: { mode: 'full-cell', oneWay: true } },
  { id: 'custom', name: 'Custom', collision: { mode: 'custom-rect', oneWay: true, rect: { minX: .2, minY: .1, maxX: .8, maxY: .6 } } },
] });
const map = plumbing.createTilemapRecord({ id: 'map', tilesetRef: 'tiles', layers: [{ id: 'main', name: 'Main', cells: [{ x: 0, y: 0, tileId: 'full' }] }] });
map.entity = { position: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
function reference(x, y, dx, dy, top, minX, maxX) {
  if (!(dy < 0) || y - .5 < top - .000101) return null;
  const t = Math.max(0, (y - .5 - top) / -dy);
  if (t > 1 + 1e-9) return null;
  const crossingX = x + dx * t;
  return crossingX + .5 > minX + 1e-8 && crossingX - .5 < maxX - 1e-8 ? Math.min(1, t) : null;
}
let operations = 0, upward = 0, landings = 0, sides = 0, tileCases = 0, disabled = 0;
const started = performance.now();
for (let seed = 1; seed <= seeds; seed++) {
  const random = rng(seed * 0x9e3779b9);
  for (let i = 0; i < casesPerSeed; i++) {
    const source = i % 4;
    const x = -3 + random() * 7, y = -3 + random() * 9;
    const dx = -3 + random() * 6, dy = -6 + random() * 12;
    const mover = object('m', x, y, 'kinematic', [dx * 10, dy * 10]);
    const scene = source === 0 ? [object('p', 0, 0, 'static', [0, 0], [2, 1])] : [];
    const tileId = source === 2 ? 'custom' : 'full';
    if (source === 1 || source === 2 || source === 3) {
      map.layers[0].cells[0].tileId = tileId;
      map.layers[0].collisionEnabled = source !== 3;
    }
    const provider = source === 0 ? undefined : (item, bounds) => tileQuery.query([map], [tileset], item, bounds);
    const manager = body.createBody2DManager({ tileObstacles: provider });
    const move = manager.tick([mover, ...scene], .1)[0].result;
    const top = source === 0 ? .5 : source === 2 ? .6 : 1;
    const minX = source === 0 ? -1 : source === 2 ? .4 : 0;
    const maxX = source === 0 ? 1 : source === 2 ? 1.6 : 2;
    const t = source === 3 ? null : reference(x, y, dx, dy, top, minX, maxX);
    const expectedY = y + (t === null ? dy : dy * t);
    if (Math.abs(mover.entity.position.y - expectedY) > 1e-5 || Math.abs(mover.entity.position.x - (x + dx)) > 1e-5) throw Error(JSON.stringify({ seed, i, source, x, y, dx, dy, t, expectedY, actual: mover.entity.position, move }));
    const state = manager.getCharacterCollision2DState('m');
    if (dy > 0) { upward++; assert(!state.ceiling); }
    if (t !== null) { landings++; assert(move.blockedY); }
    if (dx !== 0) { sides++; assert(!move.blockedX); }
    if (source === 3) disabled++;
    if (source === 1 || source === 2) tileCases++;
    assert(!state.wallLeft && !state.wallRight && !state.wallSliding);
    operations++;
  }
}
console.log(JSON.stringify({ status: 'PASS', seeds, operations, upward, landings, sides, tileCases, disabled, durationMs: Math.round(performance.now() - started) }));
