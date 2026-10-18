'use strict';
const assert = require('assert');
const plumbing = require('../editor/src/00-authoring-plumbing.js');
const collider = require('../editor/src/00-collider-2d.js');
const query = require('../editor/src/00-character-tile-query.js');
function rng(seed) { let value = seed >>> 0; return () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) / 4294967296; }; }
const tileset = plumbing.createTileset({ id: 'ts', cellSize: { width: 1.7, height: .8 }, tiles: [
  { id: 'full', name: 'Full', collision: { mode: 'full-cell' } },
  { id: 'custom', name: 'Custom', collision: { mode: 'custom-rect', rect: { minX: .1, minY: .2, maxX: .8, maxY: .9 } } },
  { id: 'none', name: 'None', collision: { mode: 'none' } },
] });
let comparisons = 0, candidates = 0;
const started = performance.now();
for (let seed = 1; seed <= 20; seed++) {
  const random = rng(seed * 0x9e3779b9);
  const angle = (random() - .5) * Math.PI * 1.8, scaleX = (random() < .25 ? -1 : 1) * (.4 + random() * 2), scaleY = (random() < .25 ? -1 : 1) * (.4 + random() * 2);
  const position = { x: (random() - .5) * 10, y: (random() - .5) * 10, z: 0 };
  const layers = Array.from({ length: 2 }, (_, layerIndex) => ({ id: `layer-${layerIndex}`, name: `Layer ${layerIndex}`, collisionEnabled: layerIndex === 0 || seed % 3 !== 0,
    cells: Array.from({ length: 30 }, () => ({ x: Math.floor(random() * 15) - 7, y: Math.floor(random() * 15) - 7, tileId: ['full', 'custom', 'none'][Math.floor(random() * 3)] })) }));
  const map = plumbing.createTilemapRecord({ id: 'map', tilesetRef: 'ts', layers });
  map.entity = { position, right: { x: Math.cos(angle), y: Math.sin(angle), z: 0 }, up: { x: -Math.sin(angle), y: Math.cos(angle), z: 0 }, scale: { x: scaleX, y: scaleY, z: 1 } };
  const quadTransform = { position: [position.x, position.y, 0], rotationZ: angle, scale: [scaleX, scaleY, 1] };
  for (let i = 0; i < 5000; i++) {
    const x = position.x + (random() - .5) * 32, y = position.y + (random() - .5) * 32;
    const w = .1 + random() * 5, h = .1 + random() * 5;
    const bounds = { minX: x - w, maxX: x + w, minY: y - h, maxY: y + h };
    const metrics = {};
    const actual = query.query([map], [tileset], { id: 'mover' }, bounds, metrics).map((entry) => entry.object.id).sort();
    const expected = [];
    for (const layer of map.layers) {
      if (layer.collisionEnabled === false) continue;
      for (const cell of layer.cells) {
        const tile = plumbing.getTileById(tileset, cell.tileId);
        const quad = plumbing.tileCollisionWorldQuad(tile, tileset, cell.x, cell.y, quadTransform);
        if (!quad) continue;
        const aabb = { minX: Math.min(...quad.map((p) => p.x)), maxX: Math.max(...quad.map((p) => p.x)), minY: Math.min(...quad.map((p) => p.y)), maxY: Math.max(...quad.map((p) => p.y)) };
        if (collider.aabbOverlaps(bounds, aabb)) expected.push(`tile:map:${layer.id}:${cell.x}:${cell.y}`);
      }
    }
    expected.sort();
    assert.deepStrictEqual(actual, expected, `seed ${seed} query ${i}`);
    comparisons++; candidates += metrics.candidateCells || 0;
  }
  console.log(`seed ${seed}/20: ${comparisons} comparisons`);
}
console.log(JSON.stringify({ comparisons, seeds: 20, candidateSlots: candidates, elapsedMs: performance.now() - started }));
