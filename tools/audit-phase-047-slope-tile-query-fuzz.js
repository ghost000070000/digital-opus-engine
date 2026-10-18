'use strict';
const assert = require('assert');
const Plumbing = require('../editor/src/00-authoring-plumbing.js');
const Query = require('../editor/src/00-character-tile-query.js');
const Collider = require('../editor/src/00-collider-2d.js');
let seed = 0x47ca11ab;
function random() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }
function between(a, b) { return a + (b - a) * random(); }
const tileset = Plumbing.createTileset({ id: 'tiles', cellSize: { width: 1.7, height: .9 }, tiles: [
  { id: 'right', collision: { mode: 'slope', slope: 'up-right', oneWay: false } },
  { id: 'left', collision: { mode: 'slope', slope: 'up-left', oneWay: true } },
  { id: 'full', collision: { mode: 'full-cell', oneWay: false } },
  { id: 'empty', collision: { mode: 'none', oneWay: false } },
] });
const cells = [];
for (let y = -4; y < 4; y++) for (let x = -4; x < 4; x++) cells.push({ x, y, tileId: (x + y * 13 & 3) === 3 ? 'full' : (x & 1) ? 'left' : 'right' });
const map = Plumbing.createTilemapRecord({ id: 'map', tilesetRef: tileset.id, layers: [{ id: 'terrain', collisionEnabled: true, cells }] });
const cases = Number(process.argv[2]) || 200000;
let slopeHits = 0, mirrored = 0, rotated = 0;
for (let i = 0; i < cases; i++) {
  const angle = between(-Math.PI, Math.PI), sx = random() < .5 ? -1 : 1, sy = random() < .5 ? -1 : 1;
  if (sx * sy < 0) mirrored++;
  if (Math.abs(angle) > .01) rotated++;
  const c = Math.cos(angle), s = Math.sin(angle);
  map.entity = { position: { x: between(-2, 2), y: between(-2, 2), z: 0 }, right: { x: c, y: s, z: 0 }, up: { x: -s, y: c, z: 0 }, scale: { x: sx, y: sy, z: 1 } };
  const centerX = between(-8, 8), centerY = between(-8, 8), half = between(.2, 1.8);
  const bounds = { minX: centerX - half, minY: centerY - half, maxX: centerX + half, maxY: centerY + half };
  const found = Query.query([map], [tileset], { id: 'm' }, bounds);
  const actual = found.map((entry) => entry.object.id).sort();
  assert.strictEqual(new Set(actual).size, actual.length, `duplicates at ${i}`);
  const transform = { position: [map.entity.position.x, map.entity.position.y, 0], rotationZ: angle, scale: [sx, sy, 1] };
  const expected = [];
  for (const cell of cells) {
    const tile = Plumbing.getTileById(tileset, cell.tileId);
    const quad = Plumbing.tileCollisionWorldQuad(tile, tileset, cell.x, cell.y, transform);
    if (!quad) continue;
    const collision = Plumbing.resolveTileCollision(tile);
    const points = collision.mode === 'slope' ? collision.slope === 'up-right' ? [quad[0], quad[1], quad[2]] : [quad[0], quad[1], quad[3]] : quad;
    const aabb = { minX: Math.min(...points.map((p) => p.x)), minY: Math.min(...points.map((p) => p.y)),
      maxX: Math.max(...points.map((p) => p.x)), maxY: Math.max(...points.map((p) => p.y)) };
    if (Collider.aabbOverlaps(bounds, aabb)) expected.push(`tile:map:terrain:${cell.x}:${cell.y}`);
  }
  expected.sort();
  assert.deepStrictEqual(actual, expected, `query ${i}: angle=${angle} scale=${sx},${sy}`);
  slopeHits += found.filter((entry) => entry.collisionMode === 'slope').length;
}
console.log(JSON.stringify({ audit: 'phase-047-slope-tile-query', seed: '0x47ca11ab', cases, slopeHits, mirrored, rotated, passed: true }));
